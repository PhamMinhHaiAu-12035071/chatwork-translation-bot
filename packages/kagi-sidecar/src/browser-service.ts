/* eslint-disable @typescript-eslint/no-unnecessary-condition */

/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/prefer-optional-chain */
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium, type BrowserContext, type Page } from 'patchright'

import { KAGI_STYLE_PRESETS, type KagiStyle } from '@chatwork-bot/provider-kagi'

import { clampInputText, MAX_INPUT_TEXT_LENGTH } from './constants/input-clamping.js'
import {
  BROWSER_CONFIG,
  computeScaledDelay,
  HUMAN_INPUT_THRESHOLD,
} from './constants/delay-config.js'
import {
  KAGI_ORIGIN_URL,
  KAGI_SELECTORS,
  KAGI_SESSION_FILE_ENV,
  KAGI_SESSION_FILE_NAME,
  clampTranslationContext,
  ADDRESSEE_GENDER_UI_LABELS,
  FORMALITY_UI_LABELS,
  SPEAKER_GENDER_UI_LABELS,
  TRANSLATION_STYLE_UI_LABELS,
  getReadingLevelSliderValue,
  type ReadingLevel,
} from './constants/kagi-ui.js'
import type {
  IBrowserConnection,
  IBrowserService,
  KagiTranslateUiRequest,
  TranslateResult,
} from './types/browser.interface.js'
import type { IHumanInteraction } from './types/human-interaction.interface.js'
import { HumanInteractionService } from './services/human-interaction.service.js'

export type KagiSidecarErrorCode =
  | 'ANTI_ABUSE'
  | 'BACKPRESSURE'
  | 'PAYLOAD_TOO_LARGE'
  | 'TIMEOUT'
  | 'TRANSPORT'
  | 'INVALID_RESPONSE'
  | 'UI_INTERACTION'

export class KagiSidecarError extends Error {
  constructor(
    public readonly code: KagiSidecarErrorCode,
    message: string,
    options?: { retryable?: boolean; status?: number; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'KagiSidecarError'
    this.retryable = options?.retryable ?? false
    this.status = options?.status ?? 502
  }

  public readonly retryable: boolean
  public readonly status: number
}

export interface KagiTranslateRequest {
  text: string
  style: KagiStyle
  context?: string
}

export interface KagiTranslationResult {
  translated: string
  attempts: number
  queueWaitMs: number
  transportLatencyMs: number
}

export interface KagiHealthSnapshot {
  ready: boolean
  activeCount: number
  queuedCount: number
}

type LaunchContext = (
  userDataDir: string,
  options: Parameters<typeof chromium.launchPersistentContext>[1],
) => Promise<BrowserContext>

export interface KagiBrowserServiceOptions {
  minIntervalMs: number
  maxQueueDepth: number
  maxQueueWaitMs: number
  maxRetries: number
  retryBaseMs: number
  requestTimeoutMs: number
  userDataDir: string
  headless: boolean
  sessionFile?: string
  sleep(ms: number): Promise<void>
  now(): number
  random(): number
  /** Override for tests — defaults to patchright's `chromium.launchPersistentContext`. */
  launchContext: LaunchContext
  /** Ensures the user-data dir exists before launch. Injectable for tests. */
  ensureUserDataDir(path: string): Promise<void>
  humanInteraction?: IHumanInteraction
}

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

  setPage(page: Page): void {
    this.page = page
  }
}

export class KagiBrowserService implements IBrowserService {
  private readonly options: KagiBrowserServiceOptions
  private readonly humanInteraction: IHumanInteraction
  private connection: BrowserConnection | null = null
  private isLoginVerified = false
  private hasServedFirstRequest = false

  private activeCount = 0
  private queuedCount = 0
  private lastRequestStartedAt = 0
  private queueTail: Promise<void> = Promise.resolve()

  constructor(options: Partial<KagiBrowserServiceOptions> = {}) {
    const baseOptions = {
      minIntervalMs: options.minIntervalMs ?? 1_500,
      maxQueueDepth: options.maxQueueDepth ?? 10,
      maxQueueWaitMs: options.maxQueueWaitMs ?? 15_000,
      maxRetries: options.maxRetries ?? 2,
      retryBaseMs: options.retryBaseMs ?? 1_000,
      requestTimeoutMs: options.requestTimeoutMs ?? 120_000,
      userDataDir: options.userDataDir ?? join(process.cwd(), 'user-data'),
      headless: options.headless ?? BROWSER_CONFIG.HEADLESS,
      sleep: options.sleep ?? ((ms) => Bun.sleep(ms)),
      now: options.now ?? (() => Date.now()),
      random: options.random ?? (() => Math.random()),
      launchContext:
        options.launchContext ?? ((dir, opts) => chromium.launchPersistentContext(dir, opts)),
      ensureUserDataDir:
        options.ensureUserDataDir ??
        ((path) => mkdir(path, { recursive: true }).then(() => undefined)),
    }

    // Conditionally add sessionFile only if provided
    this.options =
      options.sessionFile !== undefined
        ? { ...baseOptions, sessionFile: options.sessionFile }
        : baseOptions

    this.humanInteraction = options.humanInteraction ?? new HumanInteractionService()
  }

  getHealthSnapshot(): KagiHealthSnapshot {
    return {
      ready: this.connection !== null && this.isLoginVerified,
      activeCount: this.activeCount,
      queuedCount: this.queuedCount,
    }
  }

  async launch(): Promise<IBrowserConnection> {
    if (this.connection !== null) return this.connection

    await this.options.ensureUserDataDir(this.options.userDataDir)

    const context = await this.options.launchContext(this.options.userDataDir, {
      headless: this.options.headless,
      viewport: null,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--start-maximized',
      ],
    })

    const existing = context.pages()[0]
    const page = existing ?? (await context.newPage())
    this.connection = new BrowserConnection(context, page)
    return this.connection
  }

  async openNewTab(): Promise<void> {
    if (this.connection === null) {
      throw new KagiSidecarError(
        'UI_INTERACTION',
        'openNewTab called before launch; no browser connection',
        { status: 502 },
      )
    }
    const context = this.connection.getContext()
    const oldPage = this.connection.getPage()
    const newPage = await context.newPage()
    this.connection.setPage(newPage)
    if (typeof oldPage.close === 'function') {
      await oldPage.close()
    }
  }

  async close(): Promise<void> {
    if (this.connection !== null) {
      await this.connection.close()
      this.connection = null
    }
    this.isLoginVerified = false
    this.hasServedFirstRequest = false
  }

  async verifyStartupSession(): Promise<void> {
    if (this.connection === null) {
      throw new KagiSidecarError('UI_INTERACTION', 'verifyStartupSession called before launch', {
        status: 500,
      })
    }

    const context = this.connection.getContext()
    const page = this.connection.getPage()

    // 1) Optional cookie injection
    const sessionFilePath = this.resolveKagiSessionFilePath()
    if (sessionFilePath !== undefined && existsSync(sessionFilePath)) {
      const { visitKagiOriginAndInjectSessionCookies } =
        await import('./utils/kagi-session-cookies.js')
      await visitKagiOriginAndInjectSessionCookies(page, context, {
        sessionFilePath,
        timeoutMs: BROWSER_CONFIG.TIMEOUT,
        defaultOriginUrl: KAGI_ORIGIN_URL,
      })
    }

    // 2) Hit /settings and read DOM
    const settingsUrl = 'https://kagi.com/settings'
    try {
      await page.goto(settingsUrl, {
        waitUntil: 'domcontentloaded',
        timeout: BROWSER_CONFIG.TIMEOUT,
      })
    } catch (error) {
      throw new KagiSidecarError(
        'UI_INTERACTION',
        `Login verify navigation failed: ${error instanceof Error ? error.message : String(error)}`,
        { status: 502, cause: error },
      )
    }

    const currentUrl = page.url()
    if (!currentUrl.startsWith(settingsUrl)) {
      throw new KagiSidecarError(
        'UI_INTERACTION',
        `Login verify failed — redirected away from /settings to ${currentUrl}`,
        { status: 502 },
      )
    }

    const state = (await page.evaluate(
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
    )) as { hasLogout: boolean; hasSigninEmail: boolean; hasSigninQr: boolean }

    if (state.hasSigninEmail || state.hasSigninQr) {
      throw new KagiSidecarError(
        'UI_INTERACTION',
        `Login verify failed — signin DOM present at ${currentUrl}`,
        { status: 502 },
      )
    }
    if (!state.hasLogout) {
      throw new KagiSidecarError(
        'UI_INTERACTION',
        `Login verify failed — logout link absent at ${currentUrl}`,
        { status: 502 },
      )
    }

    this.isLoginVerified = true
  }

  private resolveKagiSessionFilePath(): string | undefined {
    const fromOptions = this.options.sessionFile?.trim()
    if (fromOptions !== undefined && fromOptions !== '') return fromOptions
    const fromEnv = process.env[KAGI_SESSION_FILE_ENV]?.trim()
    if (fromEnv !== undefined && fromEnv !== '') return fromEnv

    const candidates = [
      join(process.cwd(), 'secrets', KAGI_SESSION_FILE_NAME),
      join('/app', 'secrets', KAGI_SESSION_FILE_NAME),
    ]
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate
    }
    return undefined
  }

  async translate(request: KagiTranslateUiRequest): Promise<TranslateResult> {
    if (this.connection === null) {
      throw new KagiSidecarError('UI_INTERACTION', 'translate called before launch', {
        status: 500,
      })
    }
    if (!this.isLoginVerified) {
      throw new KagiSidecarError('UI_INTERACTION', 'translate called before verifyStartupSession', {
        status: 500,
      })
    }

    if (this.hasServedFirstRequest) {
      await this.openNewTab()
    } else {
      this.hasServedFirstRequest = true
    }

    const page = this.connection.getPage()
    const preset = KAGI_STYLE_PRESETS[request.style]
    const clampedText = clampInputText(request.text)
    const charCount = clampedText.length
    const navUrl = 'https://translate.kagi.com/?from=auto&to=vi'

    try {
      await this.humanDelayBeforeNavigate(navUrl)
      await page.goto(navUrl, { waitUntil: 'networkidle', timeout: BROWSER_CONFIG.TIMEOUT })
      await this.waitForCloudflareReady(page)

      await this.clearSourceTextInput(page)
      await this.fillSourceTextInput(page, clampedText, charCount)

      await this.clickTranslationSettingsButton(page)

      // PHASE 1: baseline reset
      await this.clearTranslationContext(page)
      await this.clickSpeakerGenderOption(page, SPEAKER_GENDER_UI_LABELS.UNKNOWN)
      await this.clickAddresseeGenderOption(page, ADDRESSEE_GENDER_UI_LABELS.UNKNOWN)
      await this.setReadingLevel(page, 'standard')
      await this.clickTranslationStyleOption(page, TRANSLATION_STYLE_UI_LABELS.NATURAL)

      // PHASE 2: apply target settings
      if (request.context !== undefined && request.context.trim() !== '') {
        await this.fillTranslationContext(page, request.context)
        await this.options.sleep(
          computeScaledDelay(BROWSER_CONFIG.CONTEXT_URL_SETTLE_MS, charCount),
        )
      }
      if (preset.readingLevel !== 'standard') {
        await this.setReadingLevel(page, preset.readingLevel)
        await this.verifyReadingLevelInAddressBar(page, preset.readingLevel)
      }
      if (preset.translationType !== 'natural') {
        await this.clickTranslationStyleOption(page, TRANSLATION_STYLE_UI_LABELS.LITERAL)
      }
      if (preset.formality !== 'standard') {
        const formalityLabel =
          preset.formality === 'vietnamese_formal'
            ? FORMALITY_UI_LABELS.VIETNAMESE_FORMAL
            : FORMALITY_UI_LABELS.VIETNAMESE_CASUAL
        await this.clickFormalityOption(page, formalityLabel)
        const formalityValue = preset.formality === 'vietnamese_formal' ? 'more' : 'less'
        const formalityContext =
          preset.formality === 'vietnamese_formal' ? 'vi_formal' : 'vi_casual'
        await this.verifyFormalityInAddressBar(page, formalityValue, formalityContext)
      }

      await this.waitForTranslationOutputStable(page, charCount)
      const finalUrl = page.url()
      const translated = await this.scrapeTranslatedText(page)
      if (translated === '' || translated.includes('[No translation result found')) {
        throw new KagiSidecarError('INVALID_RESPONSE', 'Kagi returned empty translation', {
          status: 502,
        })
      }

      return { translated, finalUrl }
    } catch (error) {
      if (error instanceof KagiSidecarError) throw error
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.includes('Target page, context or browser has been closed')) {
        throw new KagiSidecarError('UI_INTERACTION', `Browser died mid-translate: ${msg}`, {
          status: 502,
          cause: error,
        })
      }
      throw new KagiSidecarError('UI_INTERACTION', `translate flow failed: ${msg}`, {
        status: 502,
        cause: error,
      })
    }
  }

  private async humanDelayBeforeNavigate(targetUrl: string): Promise<void> {
    const minMs = 800
    const maxMs = 1500
    const delay = Math.floor(this.options.random() * (maxMs - minMs + 1)) + minMs
    console.log(`⌨️  Simulating URL entry (${String(delay)}ms) → ${targetUrl}`)
    await this.options.sleep(delay)
  }

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
    const state = (await handle.jsonValue()) as unknown
    if (state === 'failed') {
      throw new KagiSidecarError('UI_INTERACTION', 'Cloudflare verification failed', {
        status: 502,
      })
    }
  }

  private async clearSourceTextInput(page: Page): Promise<void> {
    const selector = KAGI_SELECTORS.SOURCE_TEXT_INPUT
    const timeout = BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT

    try {
      console.log('🧹 Clearing source text...')
      const existingText = await this.getSourceTextInputPlain(page)
      if (existingText.length > MAX_INPUT_TEXT_LENGTH) {
        console.warn(
          `⚠️ [clearSourceTextInput] Clearing text exceeds limit: ${existingText.length} > ${MAX_INPUT_TEXT_LENGTH} chars`,
        )
      }

      await page.waitForSelector(selector, { timeout, state: 'visible' })
      await page.click(selector)
      await this.options.sleep(BROWSER_CONFIG.STYLE_OPTION_CLICK_GAP_MS)
      await page.focus(selector)
      await this.options.sleep(BROWSER_CONFIG.STYLE_OPTION_CLICK_GAP_MS)

      await page.evaluate((sel: string) => {
        const el = document.querySelector(sel)
        if (el === null) return
        ;(el as HTMLElement).focus()
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

  private async getSourceTextInputPlain(page: Page): Promise<string> {
    const raw = (await page.evaluate((sel: string) => {
      const el = document.querySelector(sel)
      if (el === null) return ''
      return el.textContent ?? ''
    }, KAGI_SELECTORS.SOURCE_TEXT_INPUT)) as unknown
    return typeof raw === 'string' ? raw : ''
  }

  private async fillSourceTextInput(page: Page, rawText: string, charCount = 0): Promise<void> {
    const selector = KAGI_SELECTORS.SOURCE_TEXT_INPUT
    const timeout = BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT

    try {
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

  private async clickTranslationSettingsButton(page: Page): Promise<void> {
    const selector = KAGI_SELECTORS.TRANSLATION_SETTINGS_BUTTON
    const clickTimeout = BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT

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

  private async clearTranslationContext(page: Page): Promise<void> {
    const selector = KAGI_SELECTORS.TRANSLATION_CONTEXT_TEXTAREA
    const timeout = BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT

    try {
      await page.waitForFunction(
        (sel: string) => {
          const el =
            document.querySelector<HTMLTextAreaElement>(sel) ??
            Array.from(document.querySelectorAll<HTMLTextAreaElement>('textarea')).find((t) =>
              /context/i.test(t.placeholder ?? ''),
            ) ??
            null
          if (el === null) return false
          el.scrollIntoView({ block: 'center', inline: 'nearest' })
          return true
        },
        selector,
        { timeout },
      )

      await this.options.sleep(BROWSER_CONFIG.STYLE_OPTION_CLICK_GAP_MS)

      await page.evaluate((sel: string) => {
        const el =
          document.querySelector<HTMLTextAreaElement>(sel) ??
          Array.from(document.querySelectorAll<HTMLTextAreaElement>('textarea')).find((t) =>
            /context/i.test(t.placeholder ?? ''),
          ) ??
          null
        if (el) el.value = ''
      }, selector)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      // Non-fatal
    }
  }

  private async clickSpeakerGenderOption(page: Page, label: string): Promise<void> {
    await this.clickSettingsOptionBySpanLabel(
      page,
      KAGI_SELECTORS.SPEAKER_GENDER_OPTION_LABEL_SPAN,
      label,
      'speaker gender',
      0,
    )
  }

  private async clickAddresseeGenderOption(page: Page, label: string): Promise<void> {
    await this.clickSettingsOptionBySpanLabel(
      page,
      KAGI_SELECTORS.ADDRESSEE_GENDER_OPTION_LABEL_SPAN,
      label,
      'addressee gender',
      1,
    )
  }

  private async setReadingLevel(page: Page, readingLevel: ReadingLevel): Promise<void> {
    const selector = KAGI_SELECTORS.READING_LEVEL_SLIDER
    const timeout = BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT
    const targetValue = getReadingLevelSliderValue(readingLevel)
    const expectedSearchFragment =
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
          if (slider === null) return false

          const ariaRaw = slider.getAttribute('aria-valuenow')
          if (ariaRaw === null || Number(ariaRaw) !== nextValue) return false

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

  private async clickTranslationStyleOption(page: Page, label: string): Promise<void> {
    await this.clickSettingsOptionBySpanLabel(
      page,
      KAGI_SELECTORS.TRANSLATION_STYLE_OPTION_LABEL_SPAN,
      label,
      'translation style',
      0,
    )
  }

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
      throw new KagiSidecarError('UI_INTERACTION', 'reading-level-url-verification failed', {
        status: 502,
        cause: error,
      })
    }
  }

  private async clickFormalityOption(page: Page, label: string): Promise<void> {
    const timeout = BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT
    const spanSelector = KAGI_SELECTORS.FORMALITY_OPTION_LABEL_SPAN
    const threeLabels: readonly [string, string, string] = [
      FORMALITY_UI_LABELS.STANDARD,
      FORMALITY_UI_LABELS.VIETNAMESE_FORMAL,
      FORMALITY_UI_LABELS.VIETNAMESE_CASUAL,
    ]

    try {
      console.log(`⚙️  Clicking formality "${label}"…`)
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

          const target = Array.from(root.querySelectorAll<HTMLElement>(sel)).find(
            (s) => trim(s) === targetLabel,
          )
          if (!target) return false
          const btn = target.closest('button')
          if (!btn) return false
          const rect = target.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0
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
          `❌ formality verification failed: URL does not contain formality=${expectedFormality}&${String(expectedFormalityContext)}`,
        )
      }
      console.error(`Current URL: ${currentUrl}`)
      throw new KagiSidecarError('UI_INTERACTION', 'formality-url-verification failed', {
        status: 502,
        cause: error,
      })
    }
  }

  private async fillTranslationContext(page: Page, rawContext: string | undefined): Promise<void> {
    const text = clampTranslationContext(rawContext)
    if (text === '') return

    const primarySel = KAGI_SELECTORS.TRANSLATION_CONTEXT_TEXTAREA
    const timeout = BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT

    try {
      console.log(`⚙️  Setting translation context (${text.length} chars)…`)
      await page.waitForFunction(
        (sel: string) => {
          const el =
            document.querySelector<HTMLTextAreaElement>(sel) ??
            Array.from(document.querySelectorAll<HTMLTextAreaElement>('textarea')).find((t) =>
              /context/i.test(t.placeholder ?? ''),
            ) ??
            null
          if (el === null) return false
          el.scrollIntoView({ block: 'center', inline: 'nearest' })
          return true
        },
        primarySel,
        { timeout },
      )

      await this.options.sleep(BROWSER_CONFIG.STYLE_OPTION_CLICK_GAP_MS)
      await this.humanInteraction.typeIntoTextarea(page, primarySel, text)
    } catch (error) {
      console.warn(
        `⚠️  Could not set translation context (${primarySel}):`,
        error instanceof Error ? error.message : error,
      )
    }
  }

  private async waitForTranslationOutputStable(page: Page, charCount = 0): Promise<void> {
    const selector = KAGI_SELECTORS.TRANSLATION_CONTENT
    const stableMs = computeScaledDelay(BROWSER_CONFIG.TRANSLATION_OUTPUT_STABLE_MS, charCount)
    const maxMs = computeScaledDelay(BROWSER_CONFIG.TRANSLATION_OUTPUT_MAX_WAIT_MS, charCount)
    const pollMs = BROWSER_CONFIG.TRANSLATION_OUTPUT_POLL_MS

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

        if (len === 0) return false

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

    await this.options.sleep(BROWSER_CONFIG.POST_STABLE_EXTRA_MS)
  }

  private async scrapeTranslatedText(page: Page): Promise<string> {
    const selectors = {
      TRANSLATION_CONTENT: KAGI_SELECTORS.TRANSLATION_CONTENT ?? '.translation-content',
      TEXT_SPAN: KAGI_SELECTORS.TEXT_SPAN ?? 'span',
      TEXTAREA_PLACEHOLDER: KAGI_SELECTORS.TEXTAREA_PLACEHOLDER ?? 'textarea[placeholder]',
    }

    const result = await page.evaluate(
      (sels: { TRANSLATION_CONTENT: string; TEXT_SPAN: string; TEXTAREA_PLACEHOLDER: string }) => {
        const translationContent = document.querySelector(sels.TRANSLATION_CONTENT)
        if (translationContent !== null) {
          const textSpan = translationContent.querySelector(sels.TEXT_SPAN)
          if (textSpan !== null) {
            const text = textSpan.textContent
            if (text && text.trim() !== '') {
              return text.trim()
            }
          }

          const fullText = translationContent.textContent
          if (fullText && fullText.trim() !== '') {
            return fullText.trim()
          }
        }

        const outputArea = document.querySelector<HTMLTextAreaElement>(sels.TEXTAREA_PLACEHOLDER)
        if (outputArea !== null && outputArea.value) {
          return outputArea.value
        }

        const allTextareas = document.querySelectorAll('textarea')
        if (allTextareas.length >= 2) {
          const secondTextarea = allTextareas.item(1)
          if (secondTextarea !== null && secondTextarea.value !== '') {
            return secondTextarea.value
          }
        }

        return '[No translation result found - please check DOM structure]'
      },
      selectors,
    )

    return result
  }

  private async clickSettingsOptionBySpanLabel(
    page: Page,
    spanSelector: string,
    label: string,
    logKind: string,
    matchIndex = 0,
  ): Promise<void> {
    const timeout = BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT

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
          if (el === undefined) return false
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
}
