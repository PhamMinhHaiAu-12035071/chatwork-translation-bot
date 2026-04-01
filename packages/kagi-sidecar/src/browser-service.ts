import { buildKagiUrl } from './url-builder'
import type { KagiStyle } from './url-builder'

interface RequestLike {
  abort(): Promise<void> | void
  continue(): Promise<void> | void
  resourceType(): string
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
  ): Promise<unknown>
  evaluate<TArg, TResult>(fn: (arg: TArg) => TResult, arg: TArg): Promise<TResult>
  content(): Promise<string>
  setRequestInterception(enabled: boolean): Promise<void>
  on(event: 'request', handler: (request: RequestLike) => void): void
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

const BLOCKED_RESOURCE_TYPES = new Set<string>(['image', 'media', 'font'])
const TRANSLATION_SELECTOR = '.translation-content'
const TRANSLATION_SELECTORS = [
  '.translation-content .font-universal',
  '.translation-content .text-direction-auto',
  '.translation-content span[dir]',
  '.translation-content',
  'textarea[placeholder*="translation"]',
  'textarea[placeholder*="Translation"]',
] as const
const ANTI_ABUSE_PATTERN =
  /captcha|verify you are human|turnstile|attention required|too many requests/i

export type KagiSidecarErrorCode =
  | 'ANTI_ABUSE'
  | 'BACKPRESSURE'
  | 'PAYLOAD_TOO_LARGE'
  | 'TIMEOUT'
  | 'TRANSPORT'
  | 'INVALID_RESPONSE'

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

function detectAntiAbuse(content: string): boolean {
  return ANTI_ABUSE_PATTERN.test(content)
}

function ensureTranslatedContent(value: string): string {
  const trimmed = value.trim()

  if (trimmed.length === 0) {
    throw new KagiSidecarError('INVALID_RESPONSE', 'Kagi returned an empty translation payload', {
      status: 502,
    })
  }

  if (detectAntiAbuse(trimmed)) {
    throw new KagiSidecarError('ANTI_ABUSE', 'Kagi anti-abuse or captcha detected', {
      status: 429,
    })
  }

  return trimmed
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
  private interceptionReady = false
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

  private async executeTranslation(request: KagiTranslateRequest): Promise<string> {
    const page = await this.ensurePage()
    const url = buildKagiUrl(request.text, request.style, request.context)

    try {
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.options.requestTimeoutMs,
      })

      const html = await page.content()
      if (detectAntiAbuse(html)) {
        throw new KagiSidecarError('ANTI_ABUSE', 'Kagi anti-abuse or captcha detected', {
          status: 429,
        })
      }

      try {
        await page.waitForSelector(TRANSLATION_SELECTOR, {
          timeout: Math.floor(this.options.requestTimeoutMs / 2),
          visible: true,
        })
      } catch {
        // Best-effort: Kagi may render without the preferred selector.
      }

      const translated = await page.evaluate(
        (selectors) => {
          const doc = document

          for (const selector of selectors) {
            const node = doc.querySelector(selector)
            if (node instanceof HTMLTextAreaElement) {
              if (node.value.trim().length > 0) {
                return node.value.trim()
              }
              continue
            }

            const rawText = node?.textContent
            if (typeof rawText === 'string') {
              const text = rawText.trim()
              if (text.length > 0) {
                return text
              }
            }
          }

          const textareas = Array.from(doc.querySelectorAll('textarea'))
          for (const textarea of textareas) {
            if (textarea.value.trim().length > 0) {
              return textarea.value.trim()
            }
          }

          return ''
        },
        [...TRANSLATION_SELECTORS],
      )

      return ensureTranslatedContent(translated)
    } catch (error) {
      if (error instanceof KagiSidecarError) {
        if (error.code !== 'BACKPRESSURE') {
          await this.resetBrowserState()
        }
        throw error
      }

      await this.resetBrowserState()
      throw new KagiSidecarError(
        'TRANSPORT',
        error instanceof Error ? error.message : 'Unknown Kagi browser transport failure',
        {
          retryable: true,
          status: 502,
          cause: error,
        },
      )
    }
  }

  private async ensurePage(): Promise<PageLike> {
    if (this.page !== null && this.browser !== null) {
      return this.page
    }

    const session = await this.options.connect({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      customConfig: {},
      turnstile: true,
      connectOption: {},
      disableXvfb: false,
      ignoreAllFlags: false,
    })

    this.browser = session.browser
    this.page = session.page

    if (!this.interceptionReady) {
      await this.page.setRequestInterception(true)
      this.page.on('request', (pageRequest) => {
        if (BLOCKED_RESOURCE_TYPES.has(pageRequest.resourceType())) {
          void pageRequest.abort()
          return
        }

        void pageRequest.continue()
      })
      this.interceptionReady = true
    }

    return this.page
  }

  private async resetBrowserState(): Promise<void> {
    const browser = this.browser

    this.browser = null
    this.page = null
    this.interceptionReady = false

    if (browser !== null) {
      await browser.close().catch(() => undefined)
    }
  }
}
