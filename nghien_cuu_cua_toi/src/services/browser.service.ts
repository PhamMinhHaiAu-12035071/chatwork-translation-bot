/**
 * Browser Service for Kagi Translate automation
 *
 * Implements IBrowserService interface (DIP)
 * Single Responsibility: Browser automation and content scraping
 */

import { connect } from 'puppeteer-real-browser'
import type { Browser, Page } from 'puppeteer-core'
import type {
  IBrowserService,
  IBrowserConnection,
  TranslateResult,
} from './interfaces/browser.interface'
import type { ReadingLevel, TranslationOptions } from '~/types'
import { BrowserAutomationError } from '~/errors'
import {
  BROWSER_CONFIG,
  KAGI_SELECTORS,
  TRANSLATION_STYLE_UI_LABELS,
  FORMALITY_UI_LABELS,
  SPEAKER_GENDER_UI_LABELS,
  ADDRESSEE_GENDER_UI_LABELS,
  getDefaultTranslationOptions,
  getReadingLevelSliderValue,
  clampTranslationContext,
} from '~/config'

/**
 * Browser connection wrapper
 * @remarks Uses Puppeteer core types for type safety
 */
class BrowserConnection implements IBrowserConnection {
  constructor(
    private browser: Browser,
    private page: Page,
  ) {}

  async close(): Promise<void> {
    await this.browser.close()
  }

  getBrowser(): Browser {
    return this.browser
  }

  getPage(): Page {
    return this.page
  }
}

/**
 * Kagi Browser Service implementation using Puppeteer Real Browser
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
   * Launches a Puppeteer Real Browser instance
   * @returns Browser connection handle
   * @throws {BrowserAutomationError} If browser fails to launch
   */
  async launch(): Promise<IBrowserConnection> {
    try {
      const headless: boolean = BROWSER_CONFIG.HEADLESS
      const { browser, page } = (await connect({
        headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        customConfig: {},
        turnstile: true,
        connectOption: {},
        disableXvfb: false,
        ignoreAllFlags: false,
      })) as unknown as { browser: Browser; page: Page }

      this.connection = new BrowserConnection(browser, page)
      return this.connection
    } catch (error) {
      throw new BrowserAutomationError(
        'launch',
        'puppeteer-real-browser',
        error instanceof Error ? error : undefined,
      )
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
  ): Promise<TranslateResult> {
    if (!this.connection) {
      throw new BrowserAutomationError(
        'translate',
        'No active browser connection. Call launch() first.',
        undefined,
      )
    }

    const page: Page = this.connection.getPage()

    try {
      const timeout: number = BROWSER_CONFIG.TIMEOUT
      const selectorTimeout: number = BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT
      const renderDelay: number = BROWSER_CONFIG.POST_RENDER_DELAY
      const translationSelector: string = KAGI_SELECTORS.TRANSLATION_CONTENT

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
      const formalityToUrlFragment: Record<string, string | null> = {
        standard: null,
        vietnamese_formal: 'formality_context=vi_formal',
        vietnamese_casual: 'formality_context=vi_casual',
      }

      // ── BƯỚC 1: Navigate WITHOUT formality params → Kagi starts with Standard ──
      const navUrl = new URL(url)
      navUrl.searchParams.delete('formality')
      navUrl.searchParams.delete('formality_context')
      await page.goto(navUrl.toString(), { waitUntil: 'networkidle2', timeout })

      await this.clickTranslationSettingsButton(page)
      await this.delayMs(BROWSER_CONFIG.POST_DIALOG_SETTLE_MS)

      // Configure all settings except formality
      await this.fillTranslationContext(page, options.translationContext)
      await this.delayMs(BROWSER_CONFIG.STYLE_OPTION_CLICK_GAP_MS)
      await this.clickSpeakerGenderOption(
        page,
        speakerLabelMap[options.speakerGender] ?? SPEAKER_GENDER_UI_LABELS.UNKNOWN,
      )
      await this.delayMs(BROWSER_CONFIG.STYLE_OPTION_CLICK_GAP_MS)
      await this.clickAddresseeGenderOption(
        page,
        speakerLabelMap[options.addresseeGender] ?? ADDRESSEE_GENDER_UI_LABELS.UNKNOWN,
      )
      await this.delayMs(BROWSER_CONFIG.STYLE_OPTION_CLICK_GAP_MS)
      await this.setReadingLevel(page, options.readingLevel)
      await this.delayMs(BROWSER_CONFIG.STYLE_OPTION_CLICK_GAP_MS)
      await this.clickTranslationStyleOption(
        page,
        styleToLabel[options.style] ?? TRANSLATION_STYLE_UI_LABELS.NATURAL,
      )

      // ── BƯỚC 2: Chờ Standard translation hoàn tất ──
      await this.waitForTranslationVisible(page, translationSelector, selectorTimeout, renderDelay)
      await this.waitForTranslationOutputStable(page).catch((err: unknown) => {
        console.warn(
          `⚠️  Standard translation did not stabilize: ${err instanceof Error ? err.message : err}`,
        )
      })

      // ── BƯỚC 3 & 4: Nếu target không phải Standard → click formality rồi chờ output mới ──
      const formalityUrlFragment = formalityToUrlFragment[options.formality] ?? null
      if (formalityUrlFragment !== null) {
        const targetLabel = formalityToLabel[options.formality] ?? FORMALITY_UI_LABELS.STANDARD

        // Snapshot text hiện tại để detect content change
        const textBeforeSwitch = await this.scrapeTranslatedText(page)

        await this.clickFormalityOption(page, targetLabel)
        await this.waitForFormalityUrlUpdate(page, formalityUrlFragment)

        // Chờ content thực sự thay đổi (Kagi bắt đầu re-translate)
        await this.waitForTranslationContentChange(page, translationSelector, textBeforeSwitch)

        // ── BƯỚC 4: Chờ Vietnamese Casual translation hoàn tất ──
        await this.waitForTranslationOutputStable(page).catch((err: unknown) => {
          console.warn(
            `⚠️  Target formality translation did not stabilize: ${err instanceof Error ? err.message : err}`,
          )
        })
      } else {
        await this.delayMs(BROWSER_CONFIG.POST_FORMALITY_CASUAL_SETTLE_MS)
      }

      // ── BƯỚC 5: Lấy URL sau khi tất cả đã ổn định ──
      const finalUrl: string = page.url()
      const translated = await this.scrapeTranslatedText(page)

      return { translated, finalUrl }
    } catch (error) {
      throw new BrowserAutomationError('translate', url, error instanceof Error ? error : undefined)
    }
  }

  /** Waits for .translation-content to appear; falls back to a fixed delay. */
  private async waitForTranslationVisible(
    page: Page,
    selector: string,
    selectorTimeout: number,
    fallbackDelay: number,
  ): Promise<void> {
    try {
      await page.waitForSelector(selector, { timeout: selectorTimeout, visible: true })
    } catch {
      console.warn(`⚠️  Timeout waiting for ${selector} - continuing with fallback delay…`)
      await this.delayMs(fallbackDelay)
    }
  }

  /**
   * Waits until .translation-content text differs from textBefore.
   * Confirms Kagi has started a new translation after a settings change.
   * Non-fatal: logs a warning on timeout.
   */
  private async waitForTranslationContentChange(
    page: Page,
    selector: string,
    textBefore: string,
  ): Promise<void> {
    const timeout: number = BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT
    try {
      await page.waitForFunction(
        (sel: string, prev: string) => {
          const el = document.querySelector(sel)
          const current = (el?.textContent ?? '').trim()
          return current.length > 0 && current !== prev
        },
        { timeout },
        selector,
        textBefore,
      )
    } catch {
      console.warn(
        `⚠️  Translation content did not change after formality switch within ${timeout}ms`,
      )
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
      await page.waitForFunction(
        (sel: string, targetLabel: string, labels: readonly string[]) => {
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
        { timeout },
        spanSelector,
        label,
        threeLabels as unknown as readonly string[],
      )

      const clicked = await page.evaluate(
        (sel: string, targetLabel: string, labels: readonly string[]) => {
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
          if (btn) {
            btn.click()
            return true
          }
          return false
        },
        spanSelector,
        label,
        threeLabels as unknown as readonly string[],
      )

      if (!clicked) throw new Error(`formality "${label}" not found or not clickable`)
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

    try {
      console.log(`⚙️  Setting reading level "${readingLevel}" → step ${targetValue}…`)
      await page.waitForFunction(
        (sel: string) => {
          const slider = document.querySelector<HTMLInputElement>(sel)
          if (slider === null) {
            return false
          }

          const rect = slider.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0
        },
        { timeout },
        selector,
      )

      const applied: boolean = await page.evaluate(
        (sel: string, nextValue: number) => {
          const slider = document.querySelector<HTMLInputElement>(sel)
          if (slider === null) {
            return false
          }

          slider.focus()
          slider.value = String(nextValue)
          slider.style.setProperty('--slider-position', String(nextValue))
          slider.dispatchEvent(new Event('input', { bubbles: true }))
          slider.dispatchEvent(new Event('change', { bubbles: true }))

          return slider.value === String(nextValue)
        },
        selector,
        targetValue,
      )

      await page.waitForFunction(
        (sel: string, nextValue: number, searchFragment: string) => {
          const slider = document.querySelector<HTMLInputElement>(sel)
          if (slider === null) {
            return false
          }

          const ariaNow = slider.getAttribute('aria-valuenow')
          if (ariaNow !== String(nextValue)) {
            return false
          }

          if (searchFragment === '') {
            return !location.search.includes('language_complexity')
          }

          return location.search.includes(searchFragment)
        },
        { timeout },
        selector,
        targetValue,
        expectedSearchFragment,
      )

      if (!applied) {
        throw new Error(`reading level "${readingLevel}" not applied`)
      }
    } catch (error) {
      console.warn(
        `⚠️  Could not set reading level "${readingLevel}":`,
        error instanceof Error ? error.message : error,
      )
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
      // puppeteer-real-browser may not expose Page#click; use handle click after wait
      const handle = await page.waitForSelector(selector, {
        timeout: clickTimeout,
        visible: true,
      })
      if (handle != null) {
        await handle.click()
      }
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

    const selector: string = KAGI_SELECTORS.TRANSLATION_CONTEXT_TEXTAREA
    const timeout: number = BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT

    try {
      console.log(`⚙️  Setting translation context (${text.length} chars)…`)
      await page.waitForSelector(selector, { timeout, visible: true })

      // Two-step focus: click activates the control in the settings dialog (React / modal),
      // then explicit focus before assigning value so frameworks observe the sequence.
      await page.click(selector)
      await this.delayMs(BROWSER_CONFIG.STYLE_OPTION_CLICK_GAP_MS)
      await page.focus(selector)
      await this.delayMs(BROWSER_CONFIG.STYLE_OPTION_CLICK_GAP_MS)

      await page.evaluate(
        (sel: string, value: string) => {
          const el = document.querySelector<HTMLTextAreaElement>(sel)
          if (el === null) {
            return
          }
          el.focus()
          el.value = value
          el.dispatchEvent(
            new InputEvent('input', { bubbles: true, data: value, inputType: 'insertFromPaste' }),
          )
          el.dispatchEvent(new Event('change', { bubbles: true }))
        },
        selector,
        text,
      )
    } catch (error) {
      console.warn(
        `⚠️  Could not set translation context (${selector}):`,
        error instanceof Error ? error.message : error,
      )
    }
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
        (sel: string, text: string, index: number) => {
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
        { timeout },
        spanSelector,
        label,
        matchIndex,
      )

      const clicked: boolean = await page.evaluate(
        (sel: string, text: string, index: number) => {
          const spans = Array.from(document.querySelectorAll<HTMLElement>(sel))
          const matches = spans.filter((el) => el.textContent?.trim() === text)
          const el = matches[index]
          if (el === undefined) {
            return false
          }
          const btn = el.closest('button')
          if (btn !== null) {
            btn.click()
            return true
          }
          return false
        },
        spanSelector,
        label,
        matchIndex,
      )

      if (!clicked) {
        throw new Error(`${logKind} "${label}" not found or not clickable`)
      }
    } catch (error) {
      console.warn(
        `⚠️  Could not click ${logKind} "${label}":`,
        error instanceof Error ? error.message : error,
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
        { timeout },
        expectedFragment,
      )
    } catch {
      console.warn(`⚠️  URL did not update with "${expectedFragment}" within ${timeout}ms`)
    }
  }

  /**
   * Waits until `.translation-content` text length stops increasing for {@link BROWSER_CONFIG.TRANSLATION_OUTPUT_STABLE_MS}.
   * Avoids scraping partial streamed output. Uses `window` state so a single `waitForFunction` can poll.
   */
  private async waitForTranslationOutputStable(page: Page): Promise<void> {
    const selector: string = KAGI_SELECTORS.TRANSLATION_CONTENT
    const stableMs: number = BROWSER_CONFIG.TRANSLATION_OUTPUT_STABLE_MS
    const maxMs: number = BROWSER_CONFIG.TRANSLATION_OUTPUT_MAX_WAIT_MS
    const pollMs: number = BROWSER_CONFIG.TRANSLATION_OUTPUT_POLL_MS

    await page.evaluate(() => {
      const w = window as unknown as { __kagiTranslationStable?: unknown }
      delete w.__kagiTranslationStable
    })

    await page.waitForFunction(
      (sel: string, stable: number) => {
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
      { timeout: maxMs, polling: pollMs },
      selector,
      stableMs,
    )

    await this.delayMs(BROWSER_CONFIG.POST_STABLE_EXTRA_MS)
  }

  /**
   * Scrapes translated text from Kagi page with multiple fallback strategies
   * @param page - Puppeteer page instance
   * @returns Translated text or error message
   */
  private async scrapeTranslatedText(page: Page): Promise<string> {
    // Create typed copy for evaluate context (ESLint strict mode)
    interface Selectors {
      TRANSLATION_CONTENT: string
      TEXT_SPAN: string
      TEXTAREA_PLACEHOLDER: string
    }

    const selectors: Selectors = {
      TRANSLATION_CONTENT: KAGI_SELECTORS.TRANSLATION_CONTENT,
      TEXT_SPAN: KAGI_SELECTORS.TEXT_SPAN,
      TEXTAREA_PLACEHOLDER: KAGI_SELECTORS.TEXTAREA_PLACEHOLDER,
    }

    const result = await page.evaluate((sels: Selectors) => {
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
   * Closes the browser instance
   */
  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close()
      this.connection = null
    }
  }
}
