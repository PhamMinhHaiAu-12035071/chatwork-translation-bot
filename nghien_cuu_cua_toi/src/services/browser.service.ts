/**
 * Browser Service for Kagi Translate automation
 *
 * Implements IBrowserService interface (DIP)
 * Single Responsibility: Browser automation and content scraping
 */

import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium, type BrowserContext, type Page } from 'patchright'
import type {
  IBrowserService,
  IBrowserConnection,
  TranslateResult,
} from './interfaces/browser.interface'
import type { IHumanInteraction } from '~/services/interfaces/human-interaction.interface'
import { HumanInteractionService } from '~/services/human-interaction.service'
import type { ReadingLevel, TranslationOptions } from '~/types'
import { BrowserAutomationError } from '~/errors'
import {
  BROWSER_CONFIG,
  KAGI_ORIGIN_URL,
  KAGI_SELECTORS,
  KAGI_SESSION_FILE_ENV,
  KAGI_SESSION_FILE_NAME,
  SPEAKER_GENDER_UI_LABELS,
  ADDRESSEE_GENDER_UI_LABELS,
  TRANSLATION_STYLE_UI_LABELS,
  FORMALITY_UI_LABELS,
  getDefaultTranslationOptions,
  getReadingLevelSliderValue,
  clampTranslationContext,
  MAX_INPUT_TEXT_LENGTH,
  computeScaledDelay,
  HUMAN_INPUT_THRESHOLD,
} from '~/config'
import { visitKagiOriginAndInjectSessionCookies } from '~/utils/kagi-session-cookies'

/**
 * Browser connection wrapper (patchright persistent context + primary page).
 */
class BrowserConnection implements IBrowserConnection {
  constructor(
    private context: BrowserContext,
    private page: Page,
  ) {}

  async close(): Promise<void> {
    await this.context.close()
  }

  getContext(): BrowserContext {
    return this.context
  }

  getPage(): Page {
    return this.page
  }
}

/**
 * Kagi Browser Service implementation using patchright (patched Playwright / Chromium).
 *
 * Handles:
 * - Browser launch with anti-detection
 * - Navigation to Kagi Translate
 * - Content scraping with fallback selectors
 * - Cleanup and error handling
 *
 * @example
 * const service = new KagiBrowserService();
 * await service.launch();
 * const { translated, finalUrl } = await service.translate(url);
 * await service.close();
 */
export class KagiBrowserService implements IBrowserService {
  private connection: BrowserConnection | null = null
  /**
   * True after the first successful login verification. Subsequent translate() calls
   * (new tabs in a batch) skip cookie injection + /settings check since the persistent
   * context already holds the authenticated session.
   */
  private isLoginVerified = false

  constructor(
    private readonly humanInteraction: IHumanInteraction = new HumanInteractionService(),
  ) {}

  /**
   * Simulates the human delay of focusing the URL bar and typing a URL before Enter.
   * Real browsers can't receive keyboard events into the address bar via Playwright —
   * this is a pre-navigate pacing stand-in that keeps goto() from looking instantaneous.
   */
  private async humanDelayBeforeNavigate(targetUrl: string): Promise<void> {
    const minMs = 800
    const maxMs = 1500
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
    console.log(`⌨️  Simulating URL entry (${delay}ms) → ${targetUrl}`)
    await this.delayMs(delay)
  }

  /**
   * Resolves a Chrome/Chromium binary for launchPersistentContext (system browser or env).
   */
  private resolveChromiumExecutablePath(): string | undefined {
    const candidates: string[] = []
    const fromPptr = process.env.PUPPETEER_EXECUTABLE_PATH?.trim()
    if (fromPptr !== undefined && fromPptr !== '') {
      candidates.push(fromPptr)
    }
    const fromChrome = process.env.CHROME_PATH?.trim()
    if (fromChrome !== undefined && fromChrome !== '') {
      candidates.push(fromChrome)
    }

    if (process.platform === 'darwin') {
      candidates.push(
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
      )
    } else if (process.platform === 'linux') {
      candidates.push(
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
      )
    } else if (process.platform === 'win32') {
      candidates.push(
        `${process.env.PROGRAMFILES ?? 'C:\\Program Files'}\\Google\\Chrome\\Application\\chrome.exe`,
        `${process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)'}\\Google\\Chrome\\Application\\chrome.exe`,
      )
    }

    for (const p of candidates) {
      if (p !== '' && existsSync(p)) {
        return p
      }
    }
    return undefined
  }

  /**
   * Resolve Kagi session cookie file.
   * Priority:
   * 1) explicit env override KAGI_SESSION_FILE
   * 2) fallback to common local/container paths with a fixed filename.
   */
  private resolveKagiSessionFilePath(): string | undefined {
    const explicitSessionFile = process.env[KAGI_SESSION_FILE_ENV]?.trim()
    if (explicitSessionFile !== undefined && explicitSessionFile !== '') {
      return explicitSessionFile
    }

    const candidates: string[] = [
      join(process.cwd(), 'secrets', KAGI_SESSION_FILE_NAME),
      join('/app', 'secrets', KAGI_SESSION_FILE_NAME),
    ]

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate
      }
    }

    return undefined
  }

  /**
   * Launches Chromium via patchright `launchPersistentContext` (session in userDataDir).
   * @returns Browser connection handle
   * @throws {BrowserAutomationError} If browser fails to launch
   */
  async launch(): Promise<IBrowserConnection> {
    try {
      const headless: boolean = BROWSER_CONFIG.HEADLESS
      const userDataDir = process.env.USER_DATA_DIR?.trim() ?? join(process.cwd(), 'user-data')
      await mkdir(userDataDir, { recursive: true })

      const executablePath = this.resolveChromiumExecutablePath()

      const launchOpts: NonNullable<Parameters<typeof chromium.launchPersistentContext>[1]> = {
        headless,
        viewport: null,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--start-maximized',
        ],
      }

      if (executablePath !== undefined) {
        launchOpts.executablePath = executablePath
      }

      const context: BrowserContext = await chromium.launchPersistentContext(
        userDataDir,
        launchOpts,
      )
      const pages: Page[] = context.pages()
      const existing: Page | undefined = pages[0]
      const page: Page = existing ?? (await context.newPage())

      this.connection = new BrowserConnection(context, page)
      return this.connection
    } catch (error) {
      throw new BrowserAutomationError(
        'launch',
        'patchright',
        error instanceof Error ? error : undefined,
      )
    }
  }

  /**
   * Opens a new browser tab and closes the previous one.
   * Used for batch translation to ensure each message runs in a clean tab state.
   * Updates the internal page reference to the new tab.
   * @throws {BrowserAutomationError} If browser not launched or tab creation fails
   */
  async openNewTab(): Promise<void> {
    if (this.connection === null) {
      throw new BrowserAutomationError(
        'open-new-tab',
        'Browser not launched. Call launch() first.',
        undefined,
      )
    }

    const context = this.connection.getContext()
    if (context === undefined) {
      throw new BrowserAutomationError('open-new-tab', 'Browser context not available', undefined)
    }

    const oldPage = this.connection.getPage()
    const newPage = await context.newPage()

    // Update connection to use new page
    this.connection = new BrowserConnection(context, newPage)

    // Close old page to free resources
    if (oldPage && typeof oldPage.close === 'function') {
      await oldPage.close()
    }
  }

  /**
   * Navigates to Kagi Translate URL and extracts translated text
   * @param url - Complete Kagi Translate URL with parameters
   * @returns Translated text and the tab URL when the run finishes (before {@link close})
   * @throws {BrowserAutomationError} If navigation or scraping fails
   */
  async translate(
    url: string,
    options: TranslationOptions = getDefaultTranslationOptions(),
    sourceText?: string,
  ): Promise<TranslateResult> {
    if (!this.connection) {
      throw new BrowserAutomationError(
        'translate',
        'No active browser connection. Call launch() first.',
        undefined,
      )
    }

    const page: Page = this.connection.getPage()
    const inputCharCount = sourceText?.length ?? 0

    try {
      const timeout: number = BROWSER_CONFIG.TIMEOUT
      // UI label maps
      const speakerLabelMap: Record<string, string> = {
        unknown: SPEAKER_GENDER_UI_LABELS.UNKNOWN,
        neutral: SPEAKER_GENDER_UI_LABELS.NEUTRAL,
        feminine: SPEAKER_GENDER_UI_LABELS.FEMININE,
        masculine: SPEAKER_GENDER_UI_LABELS.MASCULINE,
      }
      const styleToLabel: Record<string, string> = {
        natural: TRANSLATION_STYLE_UI_LABELS.NATURAL,
        literal: TRANSLATION_STYLE_UI_LABELS.LITERAL,
      }
      const formalityToLabel: Record<string, string> = {
        standard: FORMALITY_UI_LABELS.STANDARD,
        vietnamese_formal: FORMALITY_UI_LABELS.VIETNAMESE_FORMAL,
        vietnamese_casual: FORMALITY_UI_LABELS.VIETNAMESE_CASUAL,
      }
      const formalityToUrlFragment: Record<
        string,
        {
          value: string | null
          context: string | null
        }
      > = {
        standard: { value: null, context: null },
        vietnamese_formal: { value: 'more', context: 'vi_formal' },
        vietnamese_casual: { value: 'less', context: 'vi_casual' },
      }

      // ── BƯỚC 1+2: Login phase — run ONCE per browser lifetime ──
      // Session cookie injection + /settings verification are identity-establishment steps.
      // Patchright persists the authenticated session in userDataDir, so subsequent
      // translate() calls (new tabs in a batch) reuse it without repeating this work.
      const navUrl = new URL(url)
      if (!this.isLoginVerified) {
        const explicitSessionFile = process.env[KAGI_SESSION_FILE_ENV]?.trim()
        const sessionFile = this.resolveKagiSessionFilePath()
        if (sessionFile !== undefined && sessionFile !== '') {
          if (!existsSync(sessionFile)) {
            if (explicitSessionFile !== undefined && explicitSessionFile !== '') {
              throw new BrowserAutomationError(
                'kagi-session-file',
                sessionFile,
                new Error(
                  `KAGI_SESSION_FILE not found: ${sessionFile}. ` +
                    'Set it to a valid absolute path (local host path or in-container path depending on run mode).',
                ),
              )
            }

            console.warn(
              `[kagi-session] Auto session file not found, continuing without injected session cookies: ${sessionFile}`,
            )
          } else {
            const context = this.connection.getContext()
            await visitKagiOriginAndInjectSessionCookies(page, context, {
              sessionFilePath: sessionFile,
              timeoutMs: timeout,
              defaultOriginUrl: KAGI_ORIGIN_URL,
            })
          }
        }

        // Fail-fast here prevents the heavy translation workflow from running unauthenticated.
        await this.verifyLoginSuccess(page, timeout)
        this.isLoginVerified = true
      } else {
        console.log('🔐 Login already verified — skipping re-auth for this tab')
      }

      // ── BƯỚC 3: Navigate to translate URL and wait for Cloudflare verification to complete ──
      await this.humanDelayBeforeNavigate(navUrl.toString())
      await page.goto(navUrl.toString(), { waitUntil: 'networkidle', timeout })

      await this.waitForCloudflareReady(page)

      // ── BƯỚC 4 (legacy fixed sleep; replaced by waitForCloudflareReady + CLOUDFLARE_* config) ──
      // await this.delayMs(5000)

      // ── BƯỚC 5: Fill source text (if provided) ──
      if (sourceText !== undefined) {
        await this.clearSourceTextInput(page)
        await this.fillSourceTextInput(page, sourceText, inputCharCount)
      }

      // ── BƯỚC 6: Open Translation Settings dialog ──
      await this.clickTranslationSettingsButton(page)

      // ── BƯỚC 7: Fill context (if provided) ──
      const contextText = clampTranslationContext(options.translationContext)
      if (contextText !== '') {
        await this.fillTranslationContext(page, options.translationContext)
        // Note: Kagi stores context in textarea but doesn't reflect it in URL params,
        // so we can't verify via address bar. fillTranslationContext() already validates
        // that the textarea was filled successfully.
        await this.delayMs(computeScaledDelay(BROWSER_CONFIG.CONTEXT_URL_SETTLE_MS, inputCharCount))
      }

      // ── BƯỚC 8: Click speaker gender option ──
      await this.clickSpeakerGenderOption(
        page,
        speakerLabelMap[options.speakerGender] ?? SPEAKER_GENDER_UI_LABELS.UNKNOWN,
      )
      await this.delayMs(computeScaledDelay(1_000, inputCharCount))

      // ── BƯỚC 9: Click addressee gender option ──
      await this.clickAddresseeGenderOption(
        page,
        speakerLabelMap[options.addresseeGender] ?? ADDRESSEE_GENDER_UI_LABELS.UNKNOWN,
      )
      await this.delayMs(computeScaledDelay(1_000, inputCharCount))

      // ── BƯỚC 10: Chọn style "Natural" ──
      const styleLabel = styleToLabel.natural
      await this.clickTranslationStyleOption(page, styleLabel)
      await this.delayMs(computeScaledDelay(1_500, inputCharCount))

      // ── BƯỚC 11: Set reading level theo options.readingLevel ──
      const readingLevel = options.readingLevel
      await this.setReadingLevel(page, readingLevel)
      await this.verifyReadingLevelInAddressBar(page, readingLevel)
      await this.delayMs(computeScaledDelay(2_000, inputCharCount))

      // ── BƯỚC 12: Set formality theo options.formality ──
      const formality: string = options.formality
      const targetLabel = formalityToLabel[formality] ?? FORMALITY_UI_LABELS.STANDARD
      const formalityUrlFragment = formalityToUrlFragment[formality] ?? {
        value: null,
        context: null,
      }
      await this.clickFormalityOption(page, targetLabel)
      await this.verifyFormalityInAddressBar(
        page,
        formalityUrlFragment.value,
        formalityUrlFragment.context,
      )
      await this.delayMs(computeScaledDelay(2_000, inputCharCount))

      await this.waitForTranslationOutputStable(page, inputCharCount)
      const finalUrl: string = page.url()
      const translated = await this.scrapeTranslatedText(page)
      console.log(`Final translation output: ${translated}`)

      return { translated, finalUrl }
    } catch (error) {
      if (error instanceof BrowserAutomationError) {
        throw error
      }
      throw new BrowserAutomationError('translate', url, error instanceof Error ? error : undefined)
    }
  }

  /**
   * Verifies logged-in session status by loading kagi.com/settings and inspecting the DOM.
   *
   * Fails fast when:
   *   1) navigation throws
   *   2) Kagi redirects away from /settings (typically to /signin or landing)
   *   3) the /signin DOM is rendered inline (#signInEmailBox or #qr-code-auth present)
   *   4) the authenticated-only Sign Out link (a[href="/logout"]) is absent
   *
   * URL-only checks are not sufficient — Kagi can return a login-gated page with
   * the URL still starting with `/settings`, so we must read the DOM.
   */
  private async verifyLoginSuccess(page: Page, timeoutMs: number): Promise<void> {
    const settingsUrl = 'https://kagi.com/settings'
    await this.humanDelayBeforeNavigate(settingsUrl)
    try {
      await page.goto(settingsUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
    } catch (error) {
      throw new BrowserAutomationError(
        'login-verification-navigation-failed',
        settingsUrl,
        error instanceof Error ? error : undefined,
      )
    }

    const currentUrl = page.url()
    if (!currentUrl.startsWith(settingsUrl)) {
      console.error(
        `❌ login verification failed — redirected away from ${settingsUrl} to ${currentUrl}`,
      )
      throw new BrowserAutomationError('login-verification-failed', currentUrl)
    }

    const state: { hasLogout: boolean; hasSigninEmail: boolean; hasSigninQr: boolean } =
      await page.evaluate(
        (selectors: { loggedIn: string; signinEmail: string; signinQr: string }) => ({
          hasLogout: document.querySelector(selectors.loggedIn) !== null,
          hasSigninEmail: document.querySelector(selectors.signinEmail) !== null,
          hasSigninQr: document.querySelector(selectors.signinQr) !== null,
        }),
        {
          loggedIn: KAGI_SELECTORS.LOGGED_IN_INDICATOR,
          signinEmail: KAGI_SELECTORS.SIGNIN_EMAIL_INPUT,
          signinQr: KAGI_SELECTORS.SIGNIN_QR_AUTH,
        },
      )

    if (state.hasSigninEmail || state.hasSigninQr) {
      console.error(
        `❌ login verification failed — signin page DOM rendered at ${currentUrl} ` +
          `(signInEmailBox=${state.hasSigninEmail}, qr-code-auth=${state.hasSigninQr})`,
      )
      throw new BrowserAutomationError('login-verification-failed', currentUrl)
    }

    if (!state.hasLogout) {
      console.error(
        `❌ login verification failed — "${KAGI_SELECTORS.LOGGED_IN_INDICATOR}" not found at ${currentUrl}. ` +
          'Session is not authenticated.',
      )
      throw new BrowserAutomationError('login-verification-failed', currentUrl)
    }

    console.log(`✅ login verified at ${currentUrl}`)
  }

  /**
   * Verifies the address bar includes the expected language_complexity param.
   * Fail-fast nếu reading level không được phản ánh lên URL.
   */
  private async verifyReadingLevelInAddressBar(
    page: Page,
    expectedReadingLevel: ReadingLevel,
  ): Promise<void> {
    try {
      await page.waitForFunction(
        (expected: string) => {
          const params = new URLSearchParams(location.search)
          const actual = params.get('language_complexity')
          if (expected === 'standard') {
            return actual == null || actual === ''
          }
          return actual === expected
        },
        expectedReadingLevel,
        {
          timeout: BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT,
          polling: BROWSER_CONFIG.TRANSLATION_OUTPUT_POLL_MS,
        },
      )
    } catch (error) {
      const currentUrl = page.url()
      console.error(
        `❌ reading level verification failed: URL does not contain language_complexity=${expectedReadingLevel}`,
      )
      console.error(`Current URL: ${currentUrl}`)
      throw new BrowserAutomationError(
        'reading-level-url-verification',
        currentUrl,
        error instanceof Error ? error : undefined,
      )
    }
  }

  /**
   * Verifies the address bar includes the expected formality query values.
   * Fail-fast nếu formality context không được phản ánh lên URL.
   */
  private async verifyFormalityInAddressBar(
    page: Page,
    expectedFormality: string | null,
    expectedFormalityContext: string | null,
  ): Promise<void> {
    try {
      await page.waitForFunction(
        (pair: { a: string | null; b: string | null }) => {
          const expectedFormalityValue = pair.a
          const expectedContextValue = pair.b
          const params = new URLSearchParams(location.search)
          if (expectedFormalityValue === null && expectedContextValue === null) {
            return params.get('formality') === null && params.get('formality_context') === null
          }
          return (
            params.get('formality') === expectedFormalityValue &&
            params.get('formality_context') === expectedContextValue
          )
        },
        { a: expectedFormality, b: expectedFormalityContext },
        {
          timeout: BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT,
          polling: BROWSER_CONFIG.TRANSLATION_OUTPUT_POLL_MS,
        },
      )
    } catch (error) {
      const currentUrl = page.url()
      if (expectedFormality === null && expectedFormalityContext === null) {
        console.error(
          '❌ formality verification failed: URL should not contain formality/formality_context',
        )
      } else {
        console.error(
          `❌ formality verification failed: URL does not contain formality=${expectedFormality}&${expectedFormalityContext}`,
        )
      }
      console.error(`Current URL: ${currentUrl}`)
      throw new BrowserAutomationError(
        'formality-url-verification',
        currentUrl,
        error instanceof Error ? error : undefined,
      )
    }
  }

  /**
   * Waits until `.translation-content` has non-empty text.
   * Avoids strict visibility checks that can false-fail under Docker/Xvfb while Kagi has
   * already rendered output.
   */
  private async waitForTranslationVisible(
    page: Page,
    selector: string,
    selectorTimeout: number,
    fallbackDelay: number,
  ): Promise<void> {
    try {
      await page.waitForFunction(
        (sel: string) => {
          const el = document.querySelector(sel)
          return (el?.textContent ?? '').trim().length > 0
        },
        selector,
        { timeout: selectorTimeout, polling: BROWSER_CONFIG.TRANSLATION_OUTPUT_POLL_MS },
      )
    } catch {
      console.warn(`Timeout waiting for ${selector} — continuing with fallback delay…`)
      await this.delayMs(fallbackDelay)
    }
  }

  /*
   * Snapshot helpers (disabled — re-enable together with the call site in
   * clickFormalityOption when debugging the Formality panel layout).
   *
   * private getScreenshotOutputDir(): string {
   *   const fromEnv = process.env.SCREENSHOT_DIR?.trim()
   *   if (fromEnv !== undefined && fromEnv !== '') {
   *     return fromEnv
   *   }
   *   return join(process.cwd(), 'screenshot')
   * }
   *
   * private async capturePageSnapshot(page: Page, stem: string): Promise<void> {
   *   try {
   *     const dir = this.getScreenshotOutputDir()
   *     await mkdir(dir, { recursive: true })
   *     const ts = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
   *     const filePath = join(dir, `${stem}-${ts}.png`)
   *     await page.screenshot({ path: filePath, type: 'png', fullPage: true })
   *     console.log(`📸 Snapshot saved: ${filePath}`)
   *   } catch (error) {
   *     console.warn(
   *       `⚠️  Snapshot "${stem}" failed:`,
   *       error instanceof Error ? error.message : error,
   *     )
   *   }
   * }
   */

  /**
   * Closes Translation Settings so the result pane is unobstructed.
   * Repeats Escape while the reading-level slider is still visible — under Docker/Xvfb a single
   * Escape can miss focus, leaving the panel open; the next toolbar click then toggles it closed
   * and the context textarea never appears.
   */
  private async dismissTranslationSettingsDialog(page: Page): Promise<void> {
    try {
      const sliderSel: string = KAGI_SELECTORS.READING_LEVEL_SLIDER
      const settle: number = BROWSER_CONFIG.POST_DISMISS_SETTINGS_MS

      for (let attempt = 0; attempt < 5; attempt++) {
        const panelOpen: boolean = await page.evaluate((sel: string) => {
          const el = document.querySelector(sel)
          if (el === null) {
            return false
          }
          const rect = el.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0
        }, sliderSel)

        if (!panelOpen) {
          break
        }

        await page.keyboard.press('Escape')
        await this.delayMs(settle)
      }
    } catch {
      // Non-fatal: dialog may already be closed
    }
  }

  /**
   * Clicks the target formality option (Standard / Vietnamese Formal / Vietnamese Casual).
   * Uses root-finding to avoid the ambiguous "Standard" label that appears in other rows.
   * Non-fatal: logs a warning on timeout or missing control.
   */
  private async clickFormalityOption(page: Page, label: string): Promise<void> {
    const timeout: number = BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT
    const spanSelector: string = KAGI_SELECTORS.FORMALITY_OPTION_LABEL_SPAN
    const threeLabels: readonly [string, string, string] = [
      FORMALITY_UI_LABELS.STANDARD,
      FORMALITY_UI_LABELS.VIETNAMESE_FORMAL,
      FORMALITY_UI_LABELS.VIETNAMESE_CASUAL,
    ]

    try {
      console.log(`⚙️  Clicking formality "${label}"…`)
      // Debug snapshot (disabled): uncomment to capture the settings panel state
      // at the moment Vietnamese Casual is about to be clicked.
      // if (label === FORMALITY_UI_LABELS.VIETNAMESE_CASUAL) {
      //   await this.capturePageSnapshot(page, 'clicking-formality-vietnamese-casual')
      // }
      await page.waitForFunction(
        (box: { sel: string; targetLabel: string; labels: readonly string[] }) => {
          const sel = box.sel
          const targetLabel = box.targetLabel
          const labels = box.labels
          const trim = (el: HTMLElement): string => el.textContent?.trim() ?? ''
          const labelList = labels
          const all = Array.from(document.querySelectorAll<HTMLElement>(sel))
          const anchor = all.find((s) => trim(s) === labels[2])
          if (!anchor) return false
          const rowFromCasual = anchor.closest('button')?.parentElement ?? null
          let root: HTMLElement | null = null
          if (rowFromCasual) {
            const rowSpans = Array.from(rowFromCasual.querySelectorAll<HTMLElement>(sel)).filter(
              (s) => labelList.includes(trim(s)),
            )
            const distinct = new Set(rowSpans.map((s) => trim(s)))
            if (
              rowSpans.length === 3 &&
              distinct.size === 3 &&
              labels.every((l) => distinct.has(l))
            )
              root = rowFromCasual
          }
          if (!root) {
            let node: HTMLElement | null =
              anchor.closest('button')?.parentElement ?? anchor.parentElement
            for (let i = 0; i < 14 && node; i++) {
              const spans = Array.from(node.querySelectorAll<HTMLElement>(sel)).filter((s) =>
                labelList.includes(trim(s)),
              )
              const distinct = new Set(spans.map((s) => trim(s)))
              if (
                spans.length === 3 &&
                labels.every((l) => distinct.has(l)) &&
                distinct.size === 3
              ) {
                root = node
                break
              }
              node = node.parentElement
            }
          }
          if (!root) return false
          const span = Array.from(root.querySelectorAll<HTMLElement>(sel)).find(
            (s) => trim(s) === targetLabel,
          )
          if (!span) return false
          const btn = span.closest('button')
          const rect = span.getBoundingClientRect()
          return btn !== null && rect.width > 0 && rect.height > 0
        },
        { sel: spanSelector, targetLabel: label, labels: threeLabels },
        { timeout },
      )

      await this.humanInteraction.clickByTextContent(page, spanSelector, label, 0)
    } catch (error) {
      console.warn(
        `⚠️  Could not click formality "${label}":`,
        error instanceof Error ? error.message : error,
      )
    }
  }

  /**
   * Sets Reading Level via the settings slider.
   * Non-fatal: logs a warning if the slider is missing or interaction fails.
   */
  private async setReadingLevel(page: Page, readingLevel: ReadingLevel): Promise<void> {
    const selector: string = KAGI_SELECTORS.READING_LEVEL_SLIDER
    const timeout: number = BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT
    const targetValue: number = getReadingLevelSliderValue(readingLevel)
    const expectedSearchFragment: string =
      readingLevel === 'standard' ? '' : `language_complexity=${readingLevel}`

    const logStepFail = (step: string, error: unknown): void => {
      console.warn(
        `[reading-level] Could not set "${readingLevel}" (${step}):`,
        error instanceof Error ? error.message : error,
      )
    }

    try {
      console.log(`[reading-level] Setting "${readingLevel}" -> step ${targetValue}`)
      console.log('[reading-level] 1/3 Waiting for slider (non-zero layout)…')
      await page.waitForFunction(
        (sel: string) => {
          for (const slider of Array.from(document.querySelectorAll<HTMLInputElement>(sel))) {
            const rect = slider.getBoundingClientRect()
            if (rect.width > 0 && rect.height > 0) {
              return true
            }
          }
          return false
        },
        selector,
        { timeout },
      )
      console.log('[reading-level] 1/3 OK')
    } catch (error) {
      logStepFail('step 1/3: slider not found or zero-size', error)
      return
    }

    try {
      console.log('[reading-level] 2/3 Dragging slider…')
      const currentValue = 0
      await this.humanInteraction.dragSlider(page, selector, currentValue, targetValue)
      console.log('[reading-level] 2/3 OK')
    } catch (error) {
      logStepFail('step 2/3: dragSlider', error)
      return
    }

    try {
      console.log('[reading-level] 3/3 Waiting for aria-valuenow + URL…')
      await page.waitForFunction(
        (box: { sel: string; nextValue: number; searchFragment: string }) => {
          const sel = box.sel
          const nextValue = box.nextValue
          const searchFragment = box.searchFragment
          let slider: HTMLInputElement | null = null
          for (const el of Array.from(document.querySelectorAll<HTMLInputElement>(sel))) {
            const r = el.getBoundingClientRect()
            if (r.width > 0 && r.height > 0) {
              slider = el
              break
            }
          }
          if (slider === null) {
            return false
          }

          const ariaRaw = slider.getAttribute('aria-valuenow')
          if (ariaRaw === null || Number(ariaRaw) !== nextValue) {
            return false
          }

          if (searchFragment === '') {
            return !location.search.includes('language_complexity')
          }

          return location.search.includes(searchFragment)
        },
        {
          sel: selector,
          nextValue: targetValue,
          searchFragment: expectedSearchFragment,
        },
        { timeout },
      )
      console.log('[reading-level] 3/3 OK')
    } catch (error) {
      logStepFail('step 3/3: aria/URL sync', error)
    }
  }

  /**
   * Clicks the Kagi toolbar "Translation Settings" control (opens settings dialog).
   * Non-fatal: logs a warning if the control is missing or times out.
   */
  private async clickTranslationSettingsButton(page: Page): Promise<void> {
    const selector: string = KAGI_SELECTORS.TRANSLATION_SETTINGS_BUTTON
    const clickTimeout: number = BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT

    try {
      console.log('⚙️  Clicking Translation Settings…')
      await page.waitForSelector(selector, { timeout: clickTimeout, state: 'visible' })
      await this.humanInteraction.click(page, selector)
    } catch (error) {
      console.warn(
        `⚠️  Could not click Translation Settings (${selector}):`,
        error instanceof Error ? error.message : error,
      )
    }
  }

  /**
   * Clicks Natural or Literal in Translation Settings by matching the label span text.
   * Non-fatal: logs a warning on timeout or missing control.
   */
  private async clickTranslationStyleOption(page: Page, label: string): Promise<void> {
    await this.clickSettingsOptionBySpanLabel(
      page,
      KAGI_SELECTORS.TRANSLATION_STYLE_OPTION_LABEL_SPAN,
      label,
      'translation style',
      0,
    )
  }

  /**
   * Clicks Unknown / Neutral / Feminine / Masculine for Speaker gender (`span.flex-grow.text-start`).
   * Non-fatal: logs a warning on timeout or missing control.
   */
  private async clickSpeakerGenderOption(page: Page, label: string): Promise<void> {
    await this.clickSettingsOptionBySpanLabel(
      page,
      KAGI_SELECTORS.SPEAKER_GENDER_OPTION_LABEL_SPAN,
      label,
      'speaker gender',
      0,
    )
  }

  /**
   * Addressee gender: same labels as speaker; uses the second matching `span.flex-grow.text-start` per label.
   */
  private async clickAddresseeGenderOption(page: Page, label: string): Promise<void> {
    await this.clickSettingsOptionBySpanLabel(
      page,
      KAGI_SELECTORS.ADDRESSEE_GENDER_OPTION_LABEL_SPAN,
      label,
      'addressee gender',
      1,
    )
  }

  /**
   * Fills the optional "Brief context for translation" textarea in Translation Settings.
   * Skips when empty; {@link clampTranslationContext} enforces a 100-character limit.
   */
  private async fillTranslationContext(page: Page, rawContext: string | undefined): Promise<void> {
    const text = clampTranslationContext(rawContext)
    if (text === '') {
      return
    }

    const primarySel: string = KAGI_SELECTORS.TRANSLATION_CONTEXT_TEXTAREA
    const timeout: number = BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT

    try {
      console.log(`⚙️  Setting translation context (${text.length} chars)…`)
      // Do not use strict visibility checks here: under Docker + smaller Xvfb (e.g. 1024×768)
      // the textarea can sit in a scrollable modal below the fold and fail the visibility check
      // even though it exists (same rationale as waitForTranslationVisible).
      await page.waitForFunction(
        (sel: string) => {
          const el =
            document.querySelector<HTMLTextAreaElement>(sel) ??
            Array.from(document.querySelectorAll<HTMLTextAreaElement>('textarea')).find((t) =>
              /context/i.test(t.placeholder ?? ''),
            ) ??
            null
          if (el === null) {
            return false
          }
          el.scrollIntoView({ block: 'center', inline: 'nearest' })
          return true
        },
        primarySel,
        { timeout },
      )

      await this.delayMs(BROWSER_CONFIG.STYLE_OPTION_CLICK_GAP_MS)

      await this.humanInteraction.typeIntoTextarea(page, primarySel, text)
    } catch (error) {
      console.warn(
        `⚠️  Could not set translation context (${primarySel}):`,
        error instanceof Error ? error.message : error,
      )
    }
  }

  /**
   * Fills the CodeMirror source pane.
   * Inserts text into the current source text value without clearing it.
   */
  private async fillSourceTextInput(page: Page, rawText: string, charCount = 0): Promise<void> {
    const selector: string = KAGI_SELECTORS.SOURCE_TEXT_INPUT
    const timeout: number = BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT

    try {
      // Defensive clamp — primary guard is in index.ts; this is a silent safety net
      const text =
        rawText.length <= MAX_INPUT_TEXT_LENGTH ? rawText : rawText.slice(0, MAX_INPUT_TEXT_LENGTH)
      console.log(`Setting source text (${text.length} chars)...`)
      await page.waitForSelector(selector, { timeout, state: 'visible' })

      if (charCount <= HUMAN_INPUT_THRESHOLD) {
        await this.humanInteraction.typeIntoContentEditable(page, selector, text)
      } else {
        await this.humanInteraction.chunkPaste(page, selector, text)
      }
    } catch (error) {
      console.warn(
        `Could not set source text (${selector}):`,
        error instanceof Error ? error.message : error,
      )
    }
  }

  /**
   * Clears the source text input completely.
   * Used as a single explicit pre-step before setting new text.
   */
  private async clearSourceTextInput(page: Page): Promise<void> {
    const selector: string = KAGI_SELECTORS.SOURCE_TEXT_INPUT
    const timeout: number = BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT

    try {
      console.log('🧹 Clearing source text...')

      // Defensive check: warn if existing content exceeds limit (pre-existing data)
      const existingText = await this.getSourceTextInputPlain(page)
      if (existingText.length > MAX_INPUT_TEXT_LENGTH) {
        console.warn(
          `⚠️ [clearSourceTextInput] Clearing text exceeds limit: ${existingText.length} > ${MAX_INPUT_TEXT_LENGTH} chars`,
        )
      }

      await page.waitForSelector(selector, { timeout, state: 'visible' })
      await page.click(selector)
      await this.delayMs(BROWSER_CONFIG.STYLE_OPTION_CLICK_GAP_MS)
      await page.focus(selector)
      await this.delayMs(BROWSER_CONFIG.STYLE_OPTION_CLICK_GAP_MS)

      await page.evaluate((sel: string) => {
        const el = document.querySelector(sel) as HTMLElement | null
        if (el === null) {
          return
        }
        el.focus()
        /* eslint-disable-next-line @typescript-eslint/no-deprecated */
        document.execCommand('selectAll', false)
        /* eslint-disable-next-line @typescript-eslint/no-deprecated */
        document.execCommand('delete', false)
      }, selector)
    } catch (error) {
      console.warn(
        `Could not clear source text (${selector}):`,
        error instanceof Error ? error.message : error,
      )
    }
  }

  private normalizeSourceTextForCompare(value: unknown): string {
    if (typeof value !== 'string') {
      return ''
    }
    return value.replace(/\r\n/g, '\n').trim()
  }

  private async getSourceTextInputPlain(page: Page): Promise<string> {
    const raw: unknown = await page.evaluate((sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null
      if (el === null) {
        return ''
      }
      return el.textContent ?? ''
    }, KAGI_SELECTORS.SOURCE_TEXT_INPUT)
    return typeof raw === 'string' ? raw : ''
  }

  /**
   * Shared: find a settings row by span label and click its parent button.
   * @param matchIndex - Which occurrence to click when several spans share the same label (0 = first, e.g. Speaker; 1 = Addressee)
   */
  private async clickSettingsOptionBySpanLabel(
    page: Page,
    spanSelector: string,
    label: string,
    logKind: string,
    matchIndex = 0,
  ): Promise<void> {
    const timeout: number = BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT

    try {
      console.log(`⚙️  Clicking ${logKind} "${label}"…`)
      await page.waitForFunction(
        (box: { sel: string; text: string; index: number }) => {
          const sel = box.sel
          const text = box.text
          const index = box.index
          const spans = Array.from(document.querySelectorAll<HTMLElement>(sel))
          const matches = spans.filter((el) => el.textContent?.trim() === text)
          const el = matches[index]
          if (el === undefined) {
            return false
          }
          const btn = el.closest('button')
          const rect = el.getBoundingClientRect()
          return btn !== null && rect.width > 0 && rect.height > 0
        },
        { sel: spanSelector, text: label, index: matchIndex },
        { timeout },
      )

      await this.humanInteraction.clickByTextContent(page, spanSelector, label, matchIndex)
    } catch (error) {
      console.warn(
        `⚠️  Could not click ${logKind} "${label}":`,
        error instanceof Error ? error.message : error,
      )
    }
  }

  /**
   * DOM-based readiness after navigation: Kagi UI visible or explicit Cloudflare failure text.
   * Replaces a fixed post-goto sleep so slow Turnstile does not race the automation.
   */
  private async waitForCloudflareReady(page: Page): Promise<void> {
    const handle = await page.waitForFunction(
      (pair: { sourceSel: string; settingsSel: string }) => {
        const sourceSel = pair.sourceSel
        const settingsSel = pair.settingsSel
        const text = (document.body?.innerText ?? '').toLowerCase()
        const sourceReady = document.querySelector(sourceSel) !== null
        const settingsReady = document.querySelector(settingsSel) !== null
        if (sourceReady || settingsReady) {
          return 'ready'
        }
        if (text.includes('verification failed')) {
          return 'failed'
        }
        return false
      },
      {
        sourceSel: KAGI_SELECTORS.SOURCE_TEXT_INPUT,
        settingsSel: KAGI_SELECTORS.TRANSLATION_SETTINGS_BUTTON,
      },
      {
        timeout: BROWSER_CONFIG.CLOUDFLARE_VERIFICATION_TIMEOUT_MS,
        polling: BROWSER_CONFIG.CLOUDFLARE_VERIFICATION_POLL_MS,
      },
    )
    const state: unknown = await handle.jsonValue()
    if (state === 'failed') {
      throw new BrowserAutomationError(
        'cloudflare-readiness',
        page.url(),
        new Error('Cloudflare verification failed (page text)'),
      )
    }
  }

  private async delayMs(ms: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Waits for the URL to contain the expected fragment after a formality click.
   * Mirrors the URL-verification pattern used in {@link setReadingLevel}.
   * Non-fatal: logs a warning if the URL does not update within timeout.
   */
  private async waitForFormalityUrlUpdate(page: Page, expectedFragment: string): Promise<void> {
    const timeout: number = BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT
    try {
      await page.waitForFunction(
        (fragment: string) => location.search.includes(fragment),
        expectedFragment,
        { timeout },
      )
    } catch {
      console.warn(`⚠️  URL did not update with "${expectedFragment}" within ${timeout}ms`)
    }
  }

  /**
   * Waits until `.translation-content` text length stops increasing for {@link BROWSER_CONFIG.TRANSLATION_OUTPUT_STABLE_MS}.
   * Avoids scraping partial streamed output. Uses `window` state so a single `waitForFunction` can poll.
   */
  private async waitForTranslationOutputStable(page: Page, charCount = 0): Promise<void> {
    const selector: string = KAGI_SELECTORS.TRANSLATION_CONTENT
    const stableMs: number = computeScaledDelay(
      BROWSER_CONFIG.TRANSLATION_OUTPUT_STABLE_MS,
      charCount,
    )
    const maxMs: number = computeScaledDelay(
      BROWSER_CONFIG.TRANSLATION_OUTPUT_MAX_WAIT_MS,
      charCount,
    )
    const pollMs: number = BROWSER_CONFIG.TRANSLATION_OUTPUT_POLL_MS

    await page.evaluate(() => {
      const w = window as unknown as { __kagiTranslationStable?: unknown }
      delete w.__kagiTranslationStable
    })

    await page.waitForFunction(
      (pair: { sel: string; stable: number }) => {
        const sel = pair.sel
        const stable = pair.stable
        const w = window as unknown as {
          __kagiTranslationStable?: { lastLen: number; stableAt: number }
        }
        w.__kagiTranslationStable ??= { lastLen: -1, stableAt: 0 }
        const o = w.__kagiTranslationStable
        const el = document.querySelector(sel)
        const len = (el?.textContent ?? '').trim().length
        const now = Date.now()

        if (len === 0) {
          return false
        }

        if (len !== o.lastLen) {
          o.lastLen = len
          o.stableAt = now
          return false
        }

        return now - o.stableAt >= stable
      },
      { sel: selector, stable: stableMs },
      { timeout: maxMs, polling: pollMs },
    )

    await this.delayMs(BROWSER_CONFIG.POST_STABLE_EXTRA_MS)
  }

  /**
   * Scrapes translated text from Kagi page with multiple fallback strategies
   * @param page - Patchright page instance
   * @returns Translated text or error message
   */
  private async scrapeTranslatedText(page: Page): Promise<string> {
    /** Plain record so `page.evaluate` accepts it as a serializable argument */
    const selectors: Record<string, string> = {
      TRANSLATION_CONTENT: KAGI_SELECTORS.TRANSLATION_CONTENT,
      TEXT_SPAN: KAGI_SELECTORS.TEXT_SPAN,
      TEXTAREA_PLACEHOLDER: KAGI_SELECTORS.TEXTAREA_PLACEHOLDER,
    }

    const result = await page.evaluate((sels: Record<string, string>) => {
      // Strategy 1: Primary selector (.translation-content > span)
      const translationContent = document.querySelector(sels.TRANSLATION_CONTENT)
      if (translationContent !== null) {
        const textSpan = translationContent.querySelector(sels.TEXT_SPAN)
        if (textSpan !== null) {
          const text = textSpan.textContent
          if (text && text.trim() !== '') {
            return text.trim()
          }
        }

        // Strategy 2: Full text in .translation-content
        const fullText = translationContent.textContent
        if (fullText && fullText.trim() !== '') {
          return fullText.trim()
        }
      }

      // Strategy 3: Textarea with placeholder
      const outputArea = document.querySelector<HTMLTextAreaElement>(sels.TEXTAREA_PLACEHOLDER)
      if (outputArea?.value) {
        return outputArea.value
      }

      // Strategy 4: Second textarea (older implementation)
      const allTextareas = document.querySelectorAll('textarea')
      if (allTextareas.length >= 2) {
        const secondTextarea = allTextareas.item(1)
        if (secondTextarea.value !== '') {
          return secondTextarea.value
        }
      }

      return '[No translation result found - please check DOM structure]'
    }, selectors)

    return result
  }

  /**
   * Closes the browser instance.
   */
  async close(): Promise<void> {
    if (this.connection) {
      console.log('✅ Complete!\n')
      await this.connection.close()
      this.connection = null
    }
    this.isLoginVerified = false
  }
}
