import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium, type BrowserContext, type Page } from 'patchright'

import { KAGI_STYLE_PRESETS, type KagiStyle } from '@chatwork-bot/provider-kagi'

import { clampInputText } from './constants/input-clamping.js'
import { BROWSER_CONFIG, computeScaledDelay, HUMAN_INPUT_THRESHOLD } from './constants/delay-config.js'
import {
  KAGI_ORIGIN_URL,
  KAGI_SELECTORS,
  KAGI_SESSION_FILE_ENV,
  KAGI_SESSION_FILE_NAME,
  clampTranslationContext,
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
  constructor(private context: BrowserContext, private page: Page) {}

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
    this.options = {
      minIntervalMs: options.minIntervalMs ?? 1_500,
      maxQueueDepth: options.maxQueueDepth ?? 10,
      maxQueueWaitMs: options.maxQueueWaitMs ?? 15_000,
      maxRetries: options.maxRetries ?? 2,
      retryBaseMs: options.retryBaseMs ?? 1_000,
      requestTimeoutMs: options.requestTimeoutMs ?? 120_000,
      userDataDir: options.userDataDir ?? join(process.cwd(), 'user-data'),
      headless: options.headless ?? BROWSER_CONFIG.HEADLESS,
      sessionFile: options.sessionFile ?? undefined,
      sleep: options.sleep ?? ((ms) => Bun.sleep(ms)),
      now: options.now ?? (() => Date.now()),
      random: options.random ?? (() => Math.random()),
      launchContext: options.launchContext ?? ((dir, opts) =>
        chromium.launchPersistentContext(dir, opts)
      ),
      ensureUserDataDir:
        options.ensureUserDataDir ?? ((path) => mkdir(path, { recursive: true }).then(() => undefined)),
    }
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

  // translate(): implemented in Task 10
  async translate(_request: KagiTranslateUiRequest): Promise<TranslateResult> {
    throw new KagiSidecarError('UI_INTERACTION', 'translate not implemented yet (Task 10)', {
      status: 500,
    })
  }
}
