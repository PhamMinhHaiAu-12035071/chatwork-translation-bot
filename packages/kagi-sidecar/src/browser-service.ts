import { buildSimpleKagiUrl, KAGI_STYLE_PRESETS } from '@chatwork-bot/provider-kagi'
import type { KagiStyle } from '@chatwork-bot/provider-kagi'

import {
  FORMALITY_LABELS,
  FORMALITY_TO_URL_PARAM,
  KAGI_SELECTORS,
  KAGI_TIMING,
  KAGI_UI_LABELS,
  READING_LEVEL_TO_STEP,
} from './constants/kagi-ui.js'

/** Handle returned by waitForSelector for elements that can be clicked. */
export interface ElementHandleLike {
  click(): Promise<void>
}

interface PageLike {
  goto(
    url: string,
    options?: {
      waitUntil?: 'networkidle2' | 'load' | 'domcontentloaded'
      timeout?: number
    },
  ): Promise<unknown>
  waitForSelector(
    selector: string,
    options?: {
      timeout?: number
      visible?: boolean
    },
  ): Promise<ElementHandleLike | null>
  evaluate<TArg, TResult>(fn: (arg: TArg) => TResult, arg: TArg): Promise<TResult>
  /** Current page URL (address bar). Used for two-phase URL verification. */
  url(): string
  /** Focus element matching selector (e.g. translation context textarea). */
  focus(selector: string): Promise<void>
  /** Wait for function to return truthy in page context (polling with timeout). */
  waitForFunction<TArg>(
    fn: (arg: TArg) => boolean,
    options: { timeout: number; polling: number },
    arg: TArg,
  ): Promise<unknown>
  /** Evaluate function with selector and return result ($eval pattern). */
  $eval<TResult>(selector: string, fn: (el: Element) => TResult): Promise<TResult>
}

interface BrowserLike {
  close(): Promise<void>
}

interface BrowserSession {
  browser: BrowserLike
  page: PageLike
}

interface BrowserAutomationConnectOptions {
  headless: boolean
  args: string[]
  customConfig: Record<string, never>
  turnstile: boolean
  connectOption: Record<string, never>
  disableXvfb: boolean
  ignoreAllFlags: boolean
}

type BrowserConnect = (options: BrowserAutomationConnectOptions) => Promise<BrowserSession>

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
    options?: {
      retryable?: boolean
      status?: number
      cause?: unknown
    },
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

export interface KagiBrowserServiceOptions {
  minIntervalMs: number
  maxQueueDepth: number
  maxQueueWaitMs: number
  maxRetries: number
  retryBaseMs: number
  requestTimeoutMs: number
  sleep(ms: number): Promise<void>
  now(): number
  random(): number
  connect: BrowserConnect
}

async function loadBrowserConnect(): Promise<BrowserConnect> {
  const mod = (await import('puppeteer-real-browser')) as {
    connect: BrowserConnect
  }
  return mod.connect
}

function isRetryableError(error: unknown): boolean {
  return error instanceof KagiSidecarError && error.retryable
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new KagiSidecarError(
              'TIMEOUT',
              `Kagi request timed out after ${timeoutMs.toString()}ms`,
              {
                retryable: true,
                status: 504,
              },
            ),
          )
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer)
    }
  }
}

export class KagiBrowserService {
  private readonly options: KagiBrowserServiceOptions
  private browser: BrowserLike | null = null
  private page: PageLike | null = null
  private activeCount = 0
  private queuedCount = 0
  private lastRequestStartedAt = 0
  private queueTail: Promise<void> = Promise.resolve()

  constructor(options: Partial<KagiBrowserServiceOptions> = {}) {
    this.options = {
      minIntervalMs: options.minIntervalMs ?? 1500,
      maxQueueDepth: options.maxQueueDepth ?? 10,
      maxQueueWaitMs: options.maxQueueWaitMs ?? 15000,
      maxRetries: options.maxRetries ?? 2,
      retryBaseMs: options.retryBaseMs ?? 1000,
      requestTimeoutMs: options.requestTimeoutMs ?? 30000,
      sleep: options.sleep ?? ((ms) => Bun.sleep(ms)),
      now: options.now ?? (() => Date.now()),
      random: options.random ?? (() => Math.random()),
      connect:
        options.connect ??
        (async (connectOptions) => {
          const connect = await loadBrowserConnect()
          return connect(connectOptions)
        }),
    }
  }

  getHealthSnapshot(): KagiHealthSnapshot {
    return {
      ready: this.page !== null,
      activeCount: this.activeCount,
      queuedCount: this.queuedCount,
    }
  }

  async close(): Promise<void> {
    await this.resetBrowserState()
  }

  async translate(request: KagiTranslateRequest): Promise<KagiTranslationResult> {
    const willQueue = this.activeCount > 0 || this.queuedCount > 0

    if (willQueue && this.queuedCount >= this.options.maxQueueDepth) {
      throw new KagiSidecarError('BACKPRESSURE', 'Kagi translation queue is full', {
        status: 429,
      })
    }

    const enqueuedAt = this.options.now()
    const previous = this.queueTail
    let releaseQueue!: () => void

    this.queuedCount += 1
    this.queueTail = new Promise<void>((resolve) => {
      releaseQueue = resolve
    })

    await previous.catch(() => undefined)
    this.queuedCount -= 1

    const queueWaitMs = this.options.now() - enqueuedAt
    if (queueWaitMs > this.options.maxQueueWaitMs) {
      releaseQueue()
      throw new KagiSidecarError(
        'BACKPRESSURE',
        `Kagi queue wait exceeded ${this.options.maxQueueWaitMs.toString()}ms`,
        { status: 429 },
      )
    }

    this.activeCount += 1

    try {
      return await this.translateWithRetries(request, queueWaitMs)
    } finally {
      this.activeCount -= 1
      releaseQueue()
    }
  }

  private async translateWithRetries(
    request: KagiTranslateRequest,
    queueWaitMs: number,
  ): Promise<KagiTranslationResult> {
    let attempt = 0
    let lastError: unknown

    while (attempt <= this.options.maxRetries) {
      attempt += 1

      try {
        await this.applyMinInterval()

        const startedAt = this.options.now()
        const translated = await withTimeout(
          this.executeTranslation(request),
          this.options.requestTimeoutMs,
        )
        const transportLatencyMs = this.options.now() - startedAt

        return {
          translated,
          attempts: attempt,
          queueWaitMs,
          transportLatencyMs,
        }
      } catch (error) {
        lastError = error

        if (!isRetryableError(error) || attempt > this.options.maxRetries) {
          throw error
        }

        const backoffMs = this.computeBackoffMs(attempt)
        await this.options.sleep(backoffMs)
        await this.resetBrowserState()
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }

  private computeBackoffMs(attempt: number): number {
    const exponent = Math.max(0, attempt - 1)
    const jitter = Math.floor(this.options.random() * this.options.retryBaseMs)

    return this.options.retryBaseMs * 2 ** exponent + jitter
  }

  private async applyMinInterval(): Promise<void> {
    const now = this.options.now()
    const elapsed = now - this.lastRequestStartedAt
    const remaining = this.options.minIntervalMs - elapsed

    if (remaining > 0) {
      await this.options.sleep(remaining)
    }

    this.lastRequestStartedAt = this.options.now()
  }

  /**
   * Verify URL contains expected fragment (two-phase verification).
   */
  private verifyUrlContains(page: PageLike, expectedFragment: string, errorContext: string): void {
    const currentUrl = page.url()

    if (!currentUrl.includes(expectedFragment)) {
      console.error('[UI_INTERACTION] URL verification failed', {
        expectedFragment,
        actualUrl: currentUrl,
        context: errorContext,
        phase: 'contains-check',
        timestamp: new Date().toISOString(),
      })

      throw new KagiSidecarError(
        'UI_INTERACTION',
        `${errorContext}. Expected URL to contain "${expectedFragment}", got: ${currentUrl}`,
        {
          status: 502,
        },
      )
    }
  }

  /**
   * Verify URL does not contain forbidden fragment (baseline checks).
   */
  private verifyUrlNotContains(
    page: PageLike,
    forbiddenFragment: string,
    errorContext: string,
  ): void {
    const currentUrl = page.url()

    if (currentUrl.includes(forbiddenFragment)) {
      console.error('[UI_INTERACTION] URL verification failed', {
        forbiddenFragment,
        actualUrl: currentUrl,
        context: errorContext,
        phase: 'not-contains-check',
        timestamp: new Date().toISOString(),
      })

      throw new KagiSidecarError(
        'UI_INTERACTION',
        `${errorContext}. Expected URL NOT to contain "${forbiddenFragment}", got: ${currentUrl}`,
        {
          status: 502,
        },
      )
    }
  }

  /**
   * Verify URL reflects expected reading level (standard vs explicit step).
   */
  private verifyUrlMatchesReadingLevel(page: PageLike, level: string, errorContext: string): void {
    const currentUrl = page.url()
    const searchParams = new URL(currentUrl).searchParams
    const expectedStep = READING_LEVEL_TO_STEP[level]

    if (expectedStep === undefined) {
      throw new KagiSidecarError('UI_INTERACTION', `Unknown reading level: ${level}`, {
        status: 502,
      })
    }

    if (level === 'standard') {
      const actualValue = searchParams.get('language_complexity')
      if (actualValue !== null && actualValue !== '0') {
        console.error('[UI_INTERACTION] URL verification failed', {
          expectedLevel: 'standard (0 or absent)',
          actualUrl: currentUrl,
          context: errorContext,
          timestamp: new Date().toISOString(),
        })

        throw new KagiSidecarError(
          'UI_INTERACTION',
          `${errorContext}. Expected standard reading level, got: ${currentUrl}`,
          {
            status: 502,
          },
        )
      }
      return
    }

    const actualValue = searchParams.get('language_complexity')
    const acceptedValues = new Set([level, String(expectedStep)])

    if (actualValue === null || !acceptedValues.has(actualValue)) {
      console.error('[UI_INTERACTION] URL verification failed', {
        expectedLevel: level,
        acceptedValues: Array.from(acceptedValues),
        actualUrl: currentUrl,
        context: errorContext,
        timestamp: new Date().toISOString(),
      })

      throw new KagiSidecarError(
        'UI_INTERACTION',
        `${errorContext}. Expected language_complexity to be one of "${Array.from(acceptedValues).join('", "')}", got: ${currentUrl}`,
        {
          status: 502,
        },
      )
    }
  }

  /**
   * Click Translation Settings button to open settings dialog.
   */
  private async clickTranslationSettingsButton(page: PageLike): Promise<void> {
    try {
      const handle = await page.waitForSelector(KAGI_SELECTORS.TRANSLATION_SETTINGS_BUTTON, {
        visible: true,
        timeout: 30_000,
      })

      if (handle === null) {
        throw new Error('Translation Settings button not found')
      }

      await handle.click()
      console.log('⚙️  Clicked Translation Settings button')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[UI_INTERACTION] Failed to click Translation Settings button', {
        step: 'clickTranslationSettingsButton',
        selector: KAGI_SELECTORS.TRANSLATION_SETTINGS_BUTTON,
        error: message,
        timestamp: new Date().toISOString(),
      })

      throw new KagiSidecarError(
        'UI_INTERACTION',
        `Failed to click Translation Settings button: ${message}`,
        {
          status: 502,
          cause: error,
        },
      )
    }
  }

  /**
   * Clear translation context textarea (baseline reset).
   */
  private async clearTranslationContext(page: PageLike): Promise<void> {
    try {
      const selector = KAGI_SELECTORS.CONTEXT_TEXTAREA
      await page.focus(selector)

      await page.evaluate((sel) => {
        const textarea = document.querySelector<HTMLTextAreaElement>(sel)
        if (textarea) {
          textarea.value = ''
          textarea.dispatchEvent(new Event('input', { bubbles: true }))
          textarea.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }, selector)

      console.log('🧹 Cleared context textarea')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[UI_INTERACTION] Failed to clear context textarea', {
        step: 'clearTranslationContext',
        selector: KAGI_SELECTORS.CONTEXT_TEXTAREA,
        error: message,
        timestamp: new Date().toISOString(),
      })

      throw new KagiSidecarError('UI_INTERACTION', `Failed to clear context textarea: ${message}`, {
        status: 502,
        cause: error,
      })
    }
  }

  /**
   * Fill translation context textarea (target application).
   */
  private async fillTranslationContext(page: PageLike, context: string): Promise<void> {
    try {
      const selector = KAGI_SELECTORS.CONTEXT_TEXTAREA
      await page.focus(selector)

      await page.evaluate(
        (payload: { sel: string; text: string }) => {
          const textarea = document.querySelector<HTMLTextAreaElement>(payload.sel)
          if (textarea) {
            textarea.value = payload.text
            textarea.dispatchEvent(new Event('input', { bubbles: true }))
            textarea.dispatchEvent(new Event('change', { bubbles: true }))
          }
        },
        { sel: selector, text: context },
      )

      const preview = context.length > 50 ? `${context.slice(0, 50)}...` : context
      console.log(`📝 Filled context textarea: "${preview}"`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[UI_INTERACTION] Failed to fill context textarea', {
        step: 'fillTranslationContext',
        selector: KAGI_SELECTORS.CONTEXT_TEXTAREA,
        contextLength: context.length,
        error: message,
        timestamp: new Date().toISOString(),
      })

      throw new KagiSidecarError('UI_INTERACTION', `Failed to fill context textarea: ${message}`, {
        status: 502,
        cause: error,
      })
    }
  }

  private async clickSettingsOptionBySpanLabel(
    page: PageLike,
    payload: {
      selector: string
      labelText: string
      matchIndex: number
    },
    metadata: {
      step:
        | 'clickSpeakerGenderOption'
        | 'clickAddresseeGenderOption'
        | 'clickTranslationStyleOption'
      kind: string
      errorLabel: string
      successIcon: string
    },
  ): Promise<void> {
    try {
      await page.evaluate((option: { selector: string; labelText: string; matchIndex: number }) => {
        const labels = Array.from(document.querySelectorAll<HTMLElement>(option.selector))
        const matches = labels.filter((el) => el.textContent.trim() === option.labelText)
        const target = matches[option.matchIndex]

        if (!target) {
          throw new Error(`Label "${option.labelText}" not found`)
        }

        const button = target.closest('button')
        if (button) {
          button.click()
          return
        }

        target.click()
      }, payload)

      console.log(`${metadata.successIcon} Clicked ${metadata.kind}: "${payload.labelText}"`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[UI_INTERACTION] Failed to click settings option', {
        step: metadata.step,
        selector: payload.selector,
        label: payload.labelText,
        matchIndex: payload.matchIndex,
        kind: metadata.kind,
        error: message,
        timestamp: new Date().toISOString(),
      })

      throw new KagiSidecarError(
        'UI_INTERACTION',
        `Failed to click ${metadata.errorLabel} "${payload.labelText}": ${message}`,
        {
          status: 502,
          cause: error,
        },
      )
    }
  }

  /**
   * Click speaker gender label (first matching label span).
   */
  private async clickSpeakerGenderOption(page: PageLike, label: string): Promise<void> {
    await this.clickSettingsOptionBySpanLabel(
      page,
      {
        selector: KAGI_SELECTORS.GENDER_LABEL,
        labelText: label,
        matchIndex: 0,
      },
      {
        step: 'clickSpeakerGenderOption',
        kind: 'speaker gender',
        errorLabel: 'speaker gender',
        successIcon: '🗣️ ',
      },
    )
  }

  /**
   * Click addressee gender label (second matching label span).
   */
  private async clickAddresseeGenderOption(page: PageLike, label: string): Promise<void> {
    await this.clickSettingsOptionBySpanLabel(
      page,
      {
        selector: KAGI_SELECTORS.GENDER_LABEL,
        labelText: label,
        matchIndex: 1,
      },
      {
        step: 'clickAddresseeGenderOption',
        kind: 'addressee gender',
        errorLabel: 'addressee gender',
        successIcon: '👤 ',
      },
    )
  }

  /**
   * Set reading level slider to target step value.
   */
  private async setReadingLevel(page: PageLike, level: string): Promise<void> {
    try {
      const targetStep = READING_LEVEL_TO_STEP[level]
      if (targetStep === undefined) {
        throw new Error(`Unknown reading level: ${level}`)
      }

      await page.evaluate(
        (payload: { sel: string; step: number }) => {
          const slider = document.querySelector<HTMLInputElement>(payload.sel)
          if (!slider) {
            throw new Error('Reading level slider not found')
          }
          slider.value = String(payload.step)
          slider.dispatchEvent(new Event('input', { bubbles: true }))
          slider.dispatchEvent(new Event('change', { bubbles: true }))
        },
        { sel: KAGI_SELECTORS.READING_LEVEL_SLIDER, step: targetStep },
      )

      console.log(`📊 Set reading level: "${level}" (step ${String(targetStep)})`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      const targetStep = READING_LEVEL_TO_STEP[level]
      console.error('[UI_INTERACTION] Failed to set reading level', {
        step: 'setReadingLevel',
        level,
        targetStep,
        error: message,
        timestamp: new Date().toISOString(),
      })

      throw new KagiSidecarError(
        'UI_INTERACTION',
        `Failed to set reading level "${level}": ${message}`,
        {
          status: 502,
          cause: error,
        },
      )
    }
  }

  /**
   * Click translation style option label (Natural or Literal).
   */
  private async clickTranslationStyleOption(page: PageLike, label: string): Promise<void> {
    await this.clickSettingsOptionBySpanLabel(
      page,
      {
        selector: KAGI_SELECTORS.STYLE_LABEL,
        labelText: label,
        matchIndex: 0,
      },
      {
        step: 'clickTranslationStyleOption',
        kind: 'translation style',
        errorLabel: 'translation style',
        successIcon: '🎨 ',
      },
    )
  }

  /**
   * Click formality option label (Standard, Vietnamese Casual, Vietnamese Formal).
   */
  private async clickFormalityOption(page: PageLike, label: string): Promise<void> {
    try {
      await page.evaluate(
        (payload: {
          selector: string
          targetLabel: string
          labels: string[]
          anchorLabel: string
        }) => {
          const trim = (text: string | null | undefined): string => text?.trim() ?? ''
          const all = Array.from(document.querySelectorAll<HTMLElement>(payload.selector))
          const anchor = all.find((span) => trim(span.textContent) === payload.anchorLabel)

          if (!anchor) {
            throw new Error(`Formality anchor "${payload.anchorLabel}" not found`)
          }

          const isFormalityRoot = (candidate: ParentNode | null): boolean => {
            if (!candidate) {
              return false
            }

            const spans = Array.from(candidate.querySelectorAll(payload.selector)).filter((span) =>
              payload.labels.includes(trim(span.textContent)),
            )
            const distinctLabels = new Set(spans.map((span) => trim(span.textContent)))

            return payload.labels.every((value) => distinctLabels.has(value))
          }

          const rowFromAnchor = anchor.closest('button')?.parentElement ?? null
          let root = isFormalityRoot(rowFromAnchor) ? rowFromAnchor : null

          if (!root) {
            let node: HTMLElement | null = rowFromAnchor?.parentElement ?? null

            for (let index = 0; index < 14 && node; index += 1) {
              if (isFormalityRoot(node)) {
                root = node
                break
              }

              node = node.parentElement ?? null
            }
          }

          if (!root) {
            throw new Error('Formality option group not found')
          }

          const target = Array.from(root.querySelectorAll<HTMLElement>(payload.selector)).find(
            (span) => trim(span.textContent) === payload.targetLabel,
          )

          if (!target) {
            throw new Error(`Formality label "${payload.targetLabel}" not found`)
          }

          const button = target.closest<HTMLElement>('button')
          if (button) {
            button.click()
            return
          }

          target.click()
        },
        {
          selector: KAGI_SELECTORS.FORMALITY_LABEL,
          targetLabel: label,
          labels: [
            KAGI_UI_LABELS.FORMALITY.STANDARD,
            KAGI_UI_LABELS.FORMALITY.VIETNAMESE_FORMAL,
            KAGI_UI_LABELS.FORMALITY.VIETNAMESE_CASUAL,
          ],
          anchorLabel: KAGI_UI_LABELS.FORMALITY.VIETNAMESE_CASUAL,
        },
      )

      console.log(`💼 Clicked formality: "${label}"`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[UI_INTERACTION] Failed to click formality', {
        step: 'clickFormalityOption',
        selector: KAGI_SELECTORS.FORMALITY_LABEL,
        label,
        error: message,
        timestamp: new Date().toISOString(),
      })

      throw new KagiSidecarError(
        'UI_INTERACTION',
        `Failed to click formality "${label}": ${message}`,
        {
          status: 502,
          cause: error,
        },
      )
    }
  }

  /**
   * Wait for URL address bar to contain expected formality fragment.
   * Used after clicking formality to verify it took effect.
   */
  private async waitForFormalityUrlUpdate(page: PageLike, expectedFragment: string): Promise<void> {
    try {
      await page.waitForFunction(
        (fragment) => window.location.href.includes(fragment),
        { timeout: 3000, polling: 100 },
        expectedFragment,
      )

      console.log(`✅ URL updated with formality: "${expectedFragment}"`)
    } catch (error: unknown) {
      const currentUrl = page.url()
      const message = error instanceof Error ? error.message : String(error)
      console.error('[UI_INTERACTION] Formality URL update timeout', {
        step: 'waitForFormalityUrlUpdate',
        expectedFragment,
        actualUrl: currentUrl,
        timeout: 3000,
        error: message,
        timestamp: new Date().toISOString(),
      })

      throw new KagiSidecarError(
        'UI_INTERACTION',
        `Formality URL not updated. Expected fragment "${expectedFragment}", got: ${currentUrl}`,
        {
          status: 502,
          cause: error,
        },
      )
    }
  }

  /**
   * Wait for translation output to stabilize (text stops changing).
   * Polls output text and waits for it to remain unchanged for TRANSLATION_OUTPUT_STABLE_MS.
   */
  private async waitForTranslationOutputStable(page: PageLike): Promise<void> {
    try {
      const startTime = Date.now()
      let lastText = ''
      let lastChangeTime = Date.now()

      while (Date.now() - startTime < KAGI_TIMING.TRANSLATION_OUTPUT_MAX_WAIT_MS) {
        let currentText = ''
        try {
          currentText = await this.scrapeTranslatedText(page)
        } catch {
          await this.options.sleep(KAGI_TIMING.TRANSLATION_OUTPUT_POLL_MS)
          continue
        }

        if (currentText.length === 0) {
          await this.detectVerificationRequirement(page)
          await this.options.sleep(KAGI_TIMING.TRANSLATION_OUTPUT_POLL_MS)
          continue
        }

        if (currentText !== lastText) {
          lastText = currentText
          lastChangeTime = Date.now()
        }

        if (Date.now() - lastChangeTime >= KAGI_TIMING.TRANSLATION_OUTPUT_STABLE_MS) {
          await this.options.sleep(KAGI_TIMING.POST_STABLE_EXTRA_MS)
          console.log('⏱️  Translation output stabilized')
          return
        }

        await this.detectVerificationRequirement(page)
        await this.options.sleep(KAGI_TIMING.TRANSLATION_OUTPUT_POLL_MS)
      }

      throw new Error(
        `Output did not stabilize within ${String(KAGI_TIMING.TRANSLATION_OUTPUT_MAX_WAIT_MS)}ms`,
      )
    } catch (error: unknown) {
      if (error instanceof KagiSidecarError && error.code === 'ANTI_ABUSE') {
        throw error
      }

      const message = error instanceof Error ? error.message : String(error)
      console.error('[UI_INTERACTION] Translation output did not stabilize', {
        step: 'waitForTranslationOutputStable',
        maxTimeout: KAGI_TIMING.TRANSLATION_OUTPUT_MAX_WAIT_MS,
        error: message,
        timestamp: new Date().toISOString(),
      })

      throw new KagiSidecarError(
        'UI_INTERACTION',
        `Translation output did not stabilize: ${message}`,
        {
          status: 502,
          cause: error,
        },
      )
    }
  }

  /**
   * Wait for translation output to CHANGE from previous text.
   * Used after formality switch to detect when new output appears.
   */
  private async waitForTranslationContentChange(page: PageLike, beforeText: string): Promise<void> {
    try {
      const startTime = Date.now()

      while (Date.now() - startTime < KAGI_TIMING.TRANSLATION_OUTPUT_MAX_WAIT_MS) {
        let currentText = ''
        try {
          currentText = await this.scrapeTranslatedText(page)
        } catch {
          await this.options.sleep(KAGI_TIMING.TRANSLATION_OUTPUT_POLL_MS)
          continue
        }

        if (currentText !== beforeText && currentText.length > 0) {
          console.log('🔄 Translation output changed after formality switch')
          return
        }

        await this.detectVerificationRequirement(page)
        await this.options.sleep(KAGI_TIMING.TRANSLATION_OUTPUT_POLL_MS)
      }

      throw new Error(
        `Output did not change within ${String(KAGI_TIMING.TRANSLATION_OUTPUT_MAX_WAIT_MS)}ms`,
      )
    } catch (error: unknown) {
      if (error instanceof KagiSidecarError && error.code === 'ANTI_ABUSE') {
        throw error
      }

      const message = error instanceof Error ? error.message : String(error)
      console.error('[UI_INTERACTION] Translation output did not change', {
        step: 'waitForTranslationContentChange',
        beforeText: beforeText.substring(0, 100),
        maxTimeout: KAGI_TIMING.TRANSLATION_OUTPUT_MAX_WAIT_MS,
        error: message,
        timestamp: new Date().toISOString(),
      })

      throw new KagiSidecarError(
        'UI_INTERACTION',
        `Translation output did not change after formality switch: ${message}`,
        {
          status: 502,
          cause: error,
        },
      )
    }
  }

  /**
   * Execute translation via UI interaction approach.
   *
   * Two-phase verification:
   * 1. Baseline reset: Reset all settings to defaults, verify URL baseline
   * 2. Target application: Apply target settings, verify URL reflects changes
   *
   * "Chim mồi" (decoy) technique for non-standard formality:
   * - Let Standard formality translate first
   * - Then switch to target formality and wait for output change
   *
   * @param request - Translation request with text, style, optional context
   * @returns Translation result with translated text
   * @throws KagiSidecarError on any UI interaction failure (fail-fast)
   */
  private async executeTranslation(request: KagiTranslateRequest): Promise<string> {
    const startTime = Date.now()

    // Lookup preset for target style (guaranteed by KagiStyle type)
    const preset = KAGI_STYLE_PRESETS[request.style]

    console.log(`\n🎯 Translating with style: ${request.style}`)
    console.log(`Preset: ${JSON.stringify(preset, null, 2)}`)

    const page = await this.ensurePage()

    // 1. Navigate to simple URL (no style params)
    const simpleUrl = buildSimpleKagiUrl(request.text)
    console.log(`🌐 Navigating to: ${simpleUrl}`)
    await page.goto(simpleUrl, { waitUntil: 'networkidle2' })

    // 2. Open Translation Settings dialog
    await this.clickTranslationSettingsButton(page)
    await this.options.sleep(KAGI_TIMING.POST_DIALOG_SETTLE_MS)

    // ═══════════════════════════════════════════════════════════
    // PHASE 1: RESET TO BASELINE (Defaults) + VERIFY
    // ═══════════════════════════════════════════════════════════

    console.log('\n📌 PHASE 1: Resetting to baseline defaults...')

    // 3. Clear context textarea
    await this.clearTranslationContext(page)
    await this.options.sleep(KAGI_TIMING.STYLE_OPTION_CLICK_GAP_MS)
    this.verifyUrlNotContains(page, 'context=', 'Baseline: context should be cleared')

    // 4. Click speaker gender "Unknown" (default)
    await this.clickSpeakerGenderOption(page, KAGI_UI_LABELS.GENDER.UNKNOWN)
    await this.options.sleep(KAGI_TIMING.STYLE_OPTION_CLICK_GAP_MS)
    this.verifyUrlNotContains(page, 'speaker_gender=', 'Baseline: speaker gender (Unknown default)')

    // 5. Click addressee gender "Unknown" (default)
    await this.clickAddresseeGenderOption(page, KAGI_UI_LABELS.GENDER.UNKNOWN)
    await this.options.sleep(KAGI_TIMING.STYLE_OPTION_CLICK_GAP_MS)
    this.verifyUrlNotContains(
      page,
      'addressee_gender=',
      'Baseline: addressee gender (Unknown default)',
    )

    // 6. Set reading level "standard" (default)
    await this.setReadingLevel(page, 'standard')
    await this.options.sleep(KAGI_TIMING.STYLE_OPTION_CLICK_GAP_MS)
    this.verifyUrlMatchesReadingLevel(page, 'standard', 'Baseline: reading level')

    // 7. Click translation style "Natural" (default)
    await this.clickTranslationStyleOption(page, KAGI_UI_LABELS.TRANSLATION_STYLE.NATURAL)
    await this.options.sleep(KAGI_TIMING.STYLE_OPTION_CLICK_GAP_MS)
    this.verifyUrlNotContains(page, 'style=', 'Baseline: translation style (Natural default)')

    // 8. Verify formality "Standard" (implicit default, no param)
    this.verifyUrlNotContains(page, 'formality_context=', 'Baseline: formality (Standard default)')

    const baselineUrl = page.url()
    console.log(`✅ BASELINE VERIFIED: ${baselineUrl}`)

    // ═══════════════════════════════════════════════════════════
    // PHASE 2: APPLY TARGET SETTINGS + VERIFY
    // ═══════════════════════════════════════════════════════════

    console.log('\n🎯 PHASE 2: Applying target settings...')

    // 9. Fill context if provided
    if (request.context) {
      await this.fillTranslationContext(page, request.context)
      await this.options.sleep(KAGI_TIMING.STYLE_OPTION_CLICK_GAP_MS)
      this.verifyUrlContains(page, 'context=', 'Target: context')
    }

    // 10. Set target reading level if different from standard
    if (preset.readingLevel !== 'standard') {
      await this.setReadingLevel(page, preset.readingLevel)
      await this.options.sleep(KAGI_TIMING.STYLE_OPTION_CLICK_GAP_MS)
      this.verifyUrlMatchesReadingLevel(page, preset.readingLevel, 'Target: reading level')
    }

    // 11. Set target translation style if different from natural
    if (preset.translationType !== 'natural') {
      await this.clickTranslationStyleOption(page, KAGI_UI_LABELS.TRANSLATION_STYLE.LITERAL)
      await this.options.sleep(KAGI_TIMING.STYLE_OPTION_CLICK_GAP_MS)
      this.verifyUrlContains(page, 'style=literal', 'Target: translation style')
    }

    // 12. Handle formality with "Chim mồi" if non-standard
    if (preset.formality !== 'standard') {
      console.log('\n🐦 CHIM MỒI: Applying formality technique...')

      // 12a. Wait for Standard output to stabilize (baseline formality)
      console.log('  ⏳ Step 1: Waiting for Standard formality output...')
      await this.waitForTranslationOutputStable(page)
      const standardOutput = await this.requireTranslatedText(page)
      console.log(`  📄 Standard output: "${standardOutput.substring(0, 100)}..."`)

      // 12b. Click target formality
      const formalityLabel = FORMALITY_LABELS[preset.formality]
      if (!formalityLabel) {
        throw new KagiSidecarError('UI_INTERACTION', `Unknown formality: ${preset.formality}`, {
          status: 502,
        })
      }
      console.log(`  🔄 Step 2: Switching to formality "${formalityLabel}"...`)
      await this.clickFormalityOption(page, formalityLabel)

      // 12c. Verify URL updated with formality param
      const expectedParam = FORMALITY_TO_URL_PARAM[preset.formality]
      if (!expectedParam) {
        throw new KagiSidecarError(
          'UI_INTERACTION',
          `No URL param mapping for formality: ${preset.formality}`,
          { status: 502 },
        )
      }
      console.log(`  🔍 Step 3: Verifying URL contains "${expectedParam}"...`)
      await this.waitForFormalityUrlUpdate(page, `formality_context=${expectedParam}`)

      // 12d. Wait for output to CHANGE from Standard
      console.log('  🔄 Step 4: Waiting for output to change...')
      await this.waitForTranslationContentChange(page, standardOutput)

      // 12e. Wait for new output to stabilize
      console.log('  ⏳ Step 5: Waiting for new output to stabilize...')
      await this.waitForTranslationOutputStable(page)

      console.log('  ✅ CHIM MỒI Complete - formality applied correctly')
    } else {
      // Standard formality - just wait for output
      console.log('\n⏳ Waiting for translation output (Standard formality)...')
      await this.waitForTranslationOutputStable(page)
    }

    const finalUrl = page.url()
    console.log(`\n✅ TARGET VERIFIED: ${finalUrl}`)

    // 13. Scrape translated text
    const translated = await this.requireTranslatedText(page)

    const transportLatencyMs = Date.now() - startTime
    console.log(`\n🎉 Translation complete in ${String(transportLatencyMs)}ms`)
    console.log(
      `📝 Result: "${translated.substring(0, 150)}${translated.length > 150 ? '...' : ''}"`,
    )

    return translated
  }

  private async scrapeTranslatedText(page: PageLike): Promise<string> {
    interface TranslationSelectors {
      TRANSLATION_CONTENT: string
      TEXT_SPAN: string
      OUTPUT_TEXTAREA: string
    }

    const selectors: TranslationSelectors = {
      TRANSLATION_CONTENT: KAGI_SELECTORS.TRANSLATION_CONTENT,
      TEXT_SPAN: KAGI_SELECTORS.TEXT_SPAN,
      OUTPUT_TEXTAREA: KAGI_SELECTORS.OUTPUT_TEXTAREA,
    }

    return page.evaluate((currentSelectors: TranslationSelectors) => {
      const translationContent = document.querySelector(currentSelectors.TRANSLATION_CONTENT)
      if (translationContent !== null) {
        const textSpan = translationContent.querySelector(currentSelectors.TEXT_SPAN)
        const spanText = textSpan ? textSpan.textContent.trim() : ''
        if (spanText && spanText.length > 0) {
          return spanText
        }

        const fullText = translationContent.textContent.trim()
        if (fullText && fullText.length > 0) {
          return fullText
        }
      }

      const outputArea = document.querySelector<HTMLTextAreaElement>(
        currentSelectors.OUTPUT_TEXTAREA,
      )
      const outputAreaValue = outputArea ? outputArea.value.trim() : ''
      if (outputAreaValue && outputAreaValue.length > 0) {
        return outputAreaValue
      }

      const allTextareas = document.querySelectorAll<HTMLTextAreaElement>('textarea')
      if (allTextareas.length >= 2) {
        const secondTextarea = allTextareas.item(1)
        const secondTextareaValue = secondTextarea.value.trim()
        if (secondTextareaValue && secondTextareaValue.length > 0) {
          return secondTextareaValue
        }
      }

      return ''
    }, selectors)
  }

  private async detectVerificationRequirement(page: PageLike): Promise<void> {
    const messages = [
      'Please complete the verification step, then edit your text to retry.',
      'Verify you are human before continuing',
      "You've hit a rate limit",
      'Rate limit reached',
    ]

    const matchedMessage = await page.evaluate(
      (payload: { messages: string[] }) => {
        const bodyText = document.body.innerText

        return payload.messages.find((message) => bodyText.includes(message)) ?? ''
      },
      { messages },
    )

    if (!messages.includes(matchedMessage)) {
      return
    }

    throw new KagiSidecarError(
      'ANTI_ABUSE',
      `Kagi requires verification before translation can continue: ${matchedMessage}`,
      {
        status: 429,
      },
    )
  }

  private async requireTranslatedText(page: PageLike): Promise<string> {
    const translated = await this.scrapeTranslatedText(page)

    if (translated.length === 0) {
      throw new KagiSidecarError('INVALID_RESPONSE', 'Kagi returned an empty translation payload', {
        status: 502,
      })
    }

    return translated
  }

  private async ensurePage(): Promise<PageLike> {
    if (this.page !== null && this.browser !== null) {
      return this.page
    }

    const session = await this.options.connect({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      customConfig: {},
      turnstile: true,
      connectOption: {},
      disableXvfb: false,
      ignoreAllFlags: false,
    })

    this.browser = session.browser
    this.page = session.page

    return this.page
  }

  private async resetBrowserState(): Promise<void> {
    const browser = this.browser

    this.browser = null
    this.page = null

    if (browser !== null) {
      await browser.close().catch(() => undefined)
    }
  }
}
