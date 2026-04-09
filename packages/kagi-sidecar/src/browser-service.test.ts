import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { KagiStyle } from '@chatwork-bot/provider-kagi'
import type {
  KagiBrowserService as KagiBrowserServiceType,
  KagiSidecarError as KagiSidecarErrorType,
} from './browser-service'

interface Deferred {
  promise: Promise<void>
  resolve(): void
  reject(error: unknown): void
}

function createDeferred(): Deferred {
  let resolve!: () => void
  let reject!: (error: unknown) => void

  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

const mockPage = {
  setRequestInterception: mock((_enabled: boolean) => Promise.resolve()),
  on: mock((_event: string, _handler: unknown) => undefined),
  goto: mock((_url: string) => Promise.resolve()),
  waitForSelector: mock((_selector: string) => Promise.resolve()),
  evaluate: mock((_fn: unknown, _arg?: unknown) => Promise.resolve('Xin chao')),
  content: mock(() => Promise.resolve('<main>translated</main>')),
  close: mock(() => Promise.resolve()),
}

const mockBrowser = {
  close: mock(() => Promise.resolve()),
}

const mockConnect = mock(() =>
  Promise.resolve({
    browser: mockBrowser,
    page: mockPage,
  }),
)

void mock.module('puppeteer-real-browser', () => ({
  connect: mockConnect,
}))

describe('KagiBrowserService', () => {
  let KagiBrowserService: typeof KagiBrowserServiceType
  let KagiSidecarError: typeof KagiSidecarErrorType

  beforeEach(async () => {
    mockConnect.mockClear()
    mockPage.setRequestInterception.mockClear()
    mockPage.on.mockClear()
    mockPage.goto.mockClear()
    mockPage.waitForSelector.mockClear()
    mockPage.evaluate.mockClear()
    mockPage.content.mockClear()
    mockPage.close.mockClear()
    mockBrowser.close.mockClear()

    const mod = await import('./browser-service')
    KagiBrowserService = mod.KagiBrowserService
    KagiSidecarError = mod.KagiSidecarError
  })

  function createService(overrides: ConstructorParameters<typeof KagiBrowserService>[0] = {}) {
    return new KagiBrowserService({
      minIntervalMs: 0,
      maxQueueDepth: 10,
      maxQueueWaitMs: 10_000,
      maxRetries: 0,
      sleep: (_ms) => Promise.resolve(),
      ...overrides,
    })
  }

  it('serializes translation requests through one warm browser session', async () => {
    const firstGoto = createDeferred()
    const secondGoto = createDeferred()

    mockPage.goto
      .mockImplementationOnce(() => firstGoto.promise)
      .mockImplementationOnce(() => secondGoto.promise)

    const service = createService()

    const first = service.translate({ text: 'Agenda', style: 'Clear' })

    await Bun.sleep(0)

    expect(mockPage.goto).toHaveBeenCalledTimes(1)

    const second = service.translate({ text: 'Please review', style: 'Clear' })

    await Bun.sleep(0)
    expect(mockPage.goto).toHaveBeenCalledTimes(1)

    firstGoto.resolve()
    await first
    await Bun.sleep(0)

    expect(mockPage.goto).toHaveBeenCalledTimes(2)

    secondGoto.resolve()
    await second
  })

  it('rejects requests when queue depth exceeds the configured budget', async () => {
    const firstGoto = createDeferred()

    mockPage.goto.mockImplementationOnce(() => firstGoto.promise)

    const service = createService({
      maxQueueDepth: 0,
    })

    const first = service.translate({ text: 'Agenda', style: 'Clear' })

    await Bun.sleep(0)

    try {
      await service.translate({ text: 'Please review', style: 'Clear' })
      expect.unreachable('expected backpressure rejection')
    } catch (error) {
      expect(error).toMatchObject({
        code: 'BACKPRESSURE',
      })
    }

    firstGoto.resolve()
    await first
  })

  it('surfaces anti-abuse detection as a typed failure', async () => {
    mockPage.evaluate
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('Verify you are human before continuing')

    const service = createService()
    const translation = service.translate({ text: 'Agenda', style: 'Clear' })

    try {
      await translation
      expect.unreachable('expected anti-abuse rejection')
    } catch (error) {
      expect(error).toBeInstanceOf(KagiSidecarError)
      expect(error).toMatchObject({
        code: 'ANTI_ABUSE',
        status: 429,
      })
    }
  })

  it('does not classify regular Kagi html with turnstile bootstrap markup as anti-abuse', async () => {
    mockPage.content.mockResolvedValueOnce(
      '<html><body><!-- Ensure Cloudflare Turnstile is loaded --></body></html>',
    )

    const service = createService()
    const result = await service.translate({ text: 'Hello', style: 'Clear' })

    expect(result.translated).toBe('Xin chao')
  })

  it('launches the browser in headful mode without resource interception', async () => {
    const service = createService()

    await service.translate({ text: 'Hello', style: 'Clear' })

    expect(mockConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        headless: false,
      }),
    )
    expect(mockPage.setRequestInterception).not.toHaveBeenCalled()
    expect(mockPage.on).not.toHaveBeenCalled()
  })

  it('waits for rendered translation output to stabilize before returning it', async () => {
    mockPage.evaluate
      .mockResolvedValueOnce('Bản dịch đang render dang dở')
      .mockResolvedValueOnce('Bản dịch hoàn chỉnh')
      .mockResolvedValueOnce('Bản dịch hoàn chỉnh')

    const service = createService()
    const result = await service.translate({ text: 'Hello world', style: 'Clear' })

    expect(result.translated).toBe('Bản dịch hoàn chỉnh')
  })
})

type _CompileOnly = KagiStyle
