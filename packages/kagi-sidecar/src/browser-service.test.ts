import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { KagiStyle } from '@chatwork-bot/provider-kagi'
import type {
  KagiBrowserService as KagiBrowserServiceType,
  KagiSidecarError as _KagiSidecarErrorType,
} from './browser-service'
import { KAGI_SELECTORS } from './constants/kagi-ui.js'
import type { PageLike } from './types/page.interface.js'

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

interface UrlVerificationService {
  verifyUrlContains(
    page: { url: () => string },
    expectedFragment: string,
    errorContext: string,
  ): void
  verifyUrlNotContains(
    page: { url: () => string },
    forbiddenFragment: string,
    errorContext: string,
  ): void
  verifyUrlMatchesReadingLevel(
    page: { url: () => string },
    level: string,
    errorContext: string,
  ): void
}

interface VerificationDetectionService {
  detectVerificationRequirement(page: {
    evaluate<TArg, TResult>(fn: (arg: TArg) => TResult, arg: TArg): Promise<TResult>
  }): Promise<void>
}

const mockElementHandle = {
  click: mock(() => Promise.resolve()),
}

const mockHumanInteraction = {
  click: mock(() => Promise.resolve()),
  clickByTextContent: mock(() => Promise.resolve()),
  typeIntoTextarea: mock(() => Promise.resolve()),
  typeIntoContentEditable: mock(() => Promise.resolve()),
  dragSlider: mock(() => Promise.resolve()),
  chunkPaste: mock(() => Promise.resolve()),
}

const mockPage = {
  setRequestInterception: mock((_enabled: boolean) => Promise.resolve()),
  on: mock((_event: string, _handler: unknown) => undefined),
  goto: mock((_url: string) => Promise.resolve()),
  waitForSelector: mock((_selector: string) => Promise.resolve(mockElementHandle)),
  focus: mock((_selector: string) => Promise.resolve()),
  // Type-safe generic evaluate mock compatible with VerificationDetectionService
  evaluate: mock(
    (_fn: unknown, _arg?: unknown): Promise<unknown> => Promise.resolve('Xin chao'),
  ) as (<TArg, TResult>(fn: (arg: TArg) => TResult, arg: TArg) => Promise<TResult>) &
    ReturnType<typeof mock>,
  content: mock(() => Promise.resolve('<main>translated</main>')),
  close: mock(() => Promise.resolve()),
  url: mock(() => 'https://translate.kagi.com/?from=auto&to=vi&text=test'),
  waitForFunction: mock((_fn: unknown, _options: unknown, _arg?: unknown) => Promise.resolve()),
  $eval: mock((_selector: string, _fn: unknown) => Promise.resolve('Xin chao')),
  click: mock((_selector: string) => Promise.resolve()),
  type: mock((_selector: string, _text: string, _options?: unknown) => Promise.resolve()),
  $: mock((_selector: string) => Promise.resolve(mockElementHandle)),
  mouse: {
    move: mock((_x: number, _y: number) => Promise.resolve()),
    down: mock(() => Promise.resolve()),
    up: mock(() => Promise.resolve()),
  },
  keyboard: {
    down: mock((_key: string) => Promise.resolve()),
    press: mock((_key: string) => Promise.resolve()),
    up: mock((_key: string) => Promise.resolve()),
  },
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

const mockCreateProfileDir = mock((_path: string) => Promise.resolve())
const mockRemoveProfileDir = mock((_path: string) => Promise.resolve())

void mock.module('puppeteer-real-browser', () => ({
  connect: mockConnect,
}))

describe('KagiBrowserService', () => {
  let KagiBrowserService: typeof KagiBrowserServiceType
  let _KagiSidecarError: typeof _KagiSidecarErrorType

  beforeEach(async () => {
    mockCreateProfileDir.mockReset()
    mockCreateProfileDir.mockImplementation(() => Promise.resolve())
    mockRemoveProfileDir.mockReset()
    mockRemoveProfileDir.mockImplementation(() => Promise.resolve())

    mockConnect.mockReset()
    mockConnect.mockImplementation(() =>
      Promise.resolve({
        browser: mockBrowser,
        page: mockPage,
      }),
    )

    mockElementHandle.click.mockReset()
    mockElementHandle.click.mockImplementation(() => Promise.resolve())

    mockPage.setRequestInterception.mockReset()
    mockPage.setRequestInterception.mockImplementation((_enabled: boolean) => Promise.resolve())

    mockPage.on.mockReset()
    mockPage.on.mockImplementation((_event: string, _handler: unknown) => undefined)

    mockPage.goto.mockReset()
    mockPage.goto.mockImplementation((_url: string) => Promise.resolve())

    mockPage.waitForSelector.mockReset()
    mockPage.waitForSelector.mockImplementation((_selector: string) =>
      Promise.resolve(mockElementHandle),
    )

    mockPage.focus.mockReset()
    mockPage.focus.mockImplementation((_selector: string) => Promise.resolve())

    mockPage.evaluate.mockReset()
    mockPage.evaluate.mockImplementation((_fn: unknown, _arg?: unknown) =>
      Promise.resolve('Xin chao'),
    )

    mockPage.content.mockReset()
    mockPage.content.mockImplementation(() => Promise.resolve('<main>translated</main>'))

    mockPage.close.mockReset()
    mockPage.close.mockImplementation(() => Promise.resolve())

    mockPage.url.mockReset()
    mockPage.url.mockImplementation(() => 'https://translate.kagi.com/?from=auto&to=vi&text=test')

    mockPage.waitForFunction.mockReset()
    mockPage.waitForFunction.mockImplementation((_fn: unknown, _options: unknown, _arg?: unknown) =>
      Promise.resolve(),
    )

    mockPage.$eval.mockReset()
    mockPage.$eval.mockImplementation((_selector: string, _fn: unknown) =>
      Promise.resolve('Xin chao'),
    )

    mockBrowser.close.mockReset()
    mockBrowser.close.mockImplementation(() => Promise.resolve())

    mockPage.click.mockReset()
    mockPage.click.mockImplementation(() => Promise.resolve())
    mockPage.type.mockReset()
    mockPage.type.mockImplementation(() => Promise.resolve())
    mockPage.$.mockReset()
    mockPage.$.mockImplementation(() => Promise.resolve(mockElementHandle))
    mockPage.mouse.move.mockReset()
    mockPage.mouse.move.mockImplementation(() => Promise.resolve())
    mockPage.mouse.down.mockReset()
    mockPage.mouse.down.mockImplementation(() => Promise.resolve())
    mockPage.mouse.up.mockReset()
    mockPage.mouse.up.mockImplementation(() => Promise.resolve())
    mockPage.keyboard.down.mockReset()
    mockPage.keyboard.down.mockImplementation(() => Promise.resolve())
    mockPage.keyboard.press.mockReset()
    mockPage.keyboard.press.mockImplementation(() => Promise.resolve())
    mockPage.keyboard.up.mockReset()
    mockPage.keyboard.up.mockImplementation(() => Promise.resolve())

    mockHumanInteraction.click.mockReset()
    mockHumanInteraction.click.mockImplementation(() => Promise.resolve())
    mockHumanInteraction.clickByTextContent.mockReset()
    mockHumanInteraction.clickByTextContent.mockImplementation(() => Promise.resolve())
    mockHumanInteraction.typeIntoTextarea.mockReset()
    mockHumanInteraction.typeIntoTextarea.mockImplementation(() => Promise.resolve())
    mockHumanInteraction.typeIntoContentEditable.mockReset()
    mockHumanInteraction.typeIntoContentEditable.mockImplementation(() => Promise.resolve())
    mockHumanInteraction.dragSlider.mockReset()
    mockHumanInteraction.dragSlider.mockImplementation(() => Promise.resolve())
    mockHumanInteraction.chunkPaste.mockReset()
    mockHumanInteraction.chunkPaste.mockImplementation(() => Promise.resolve())

    const mod = await import('./browser-service')
    KagiBrowserService = mod.KagiBrowserService
    _KagiSidecarError = mod.KagiSidecarError
  })

  function createService(overrides: ConstructorParameters<typeof KagiBrowserService>[0] = {}) {
    return new KagiBrowserService({
      minIntervalMs: 0,
      maxQueueDepth: 10,
      maxQueueWaitMs: 10_000,
      maxRetries: 0,
      sleep: (_ms) => Promise.resolve(),
      createProfileDir: mockCreateProfileDir,
      removeProfileDir: mockRemoveProfileDir,
      humanInteraction: mockHumanInteraction,
      ...overrides,
    })
  }

  it('serializes translation requests while launching and closing a fresh browser per request', async () => {
    const firstGoto = createDeferred()
    const secondGoto = createDeferred()
    const firstBrowser = {
      close: mock(() => Promise.resolve()),
    }
    const secondBrowser = {
      close: mock(() => Promise.resolve()),
    }

    mockConnect
      .mockImplementationOnce(() =>
        Promise.resolve({
          browser: firstBrowser,
          page: {
            ...mockPage,
            goto: mock((_url: string) => firstGoto.promise),
          },
        }),
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          browser: secondBrowser,
          page: {
            ...mockPage,
            goto: mock((_url: string) => secondGoto.promise),
          },
        }),
      )

    const service = createService()

    const first = service.translate({ text: 'Agenda', style: 'Clear' })

    await Bun.sleep(0)

    expect(mockConnect).toHaveBeenCalledTimes(1)

    const second = service.translate({ text: 'Please review', style: 'Clear' })

    await Bun.sleep(0)
    expect(mockConnect).toHaveBeenCalledTimes(1)

    firstGoto.resolve()
    await first
    await Bun.sleep(0)

    expect(mockConnect).toHaveBeenCalledTimes(2)
    expect(firstBrowser.close).toHaveBeenCalledTimes(1)

    secondGoto.resolve()
    await second
    expect(secondBrowser.close).toHaveBeenCalledTimes(1)
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

  it('surfaces verification timeout as a typed anti-abuse failure instead of a generic UI timeout', async () => {
    mockPage.evaluate.mockImplementation((_fn: unknown, arg?: unknown) => {
      if (typeof arg === 'object' && arg !== null && 'messages' in arg) {
        return Promise.resolve(
          'Please complete the verification step, then edit your text to retry.',
        )
      }

      return Promise.resolve('noop')
    })

    const service = createService()

    const promise = (
      service as unknown as VerificationDetectionService
    ).detectVerificationRequirement(mockPage)
    // eslint-disable-next-line @typescript-eslint/await-thenable, @typescript-eslint/no-confusing-void-expression
    await expect(promise).rejects.toMatchObject({
      code: 'ANTI_ABUSE',
      status: 429,
    })
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

  it('launches the browser with the PoC viewport profile so the settings slider stays reachable in Docker', async () => {
    const service = createService()

    await service.translate({ text: 'Hello', style: 'Clear' })

    expect(mockConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.arrayContaining([
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--start-maximized',
        ]) as unknown as string[],
        connectOption: {
          defaultViewport: null,
        },
        disableXvfb: true,
        headless: false,
      }),
    )
  })

  it('isolates the Chrome profile per request via a unique userDataDir and cleans it up after the browser closes', async () => {
    const service = createService()

    const capturedUserDataDirs: string[] = []
    mockConnect.mockImplementation((...args: unknown[]) => {
      const options = args[0] as { customConfig?: { userDataDir?: string } } | undefined
      const userDataDir = options?.customConfig?.userDataDir
      if (userDataDir !== undefined) {
        capturedUserDataDirs.push(userDataDir)
      }
      return Promise.resolve({
        browser: mockBrowser,
        page: mockPage,
      })
    })

    await service.translate({ text: 'Hello', style: 'Clear' })
    await service.translate({ text: 'Hello again', style: 'Clear' })

    expect(capturedUserDataDirs).toHaveLength(2)
    expect(capturedUserDataDirs[0]).toMatch(/kagi-profile-/u)
    expect(capturedUserDataDirs[1]).toMatch(/kagi-profile-/u)
    expect(capturedUserDataDirs[0]).not.toBe(capturedUserDataDirs[1])

    // Each userDataDir must have been created before connect() and removed after browser.close().
    expect(mockCreateProfileDir).toHaveBeenCalledWith(capturedUserDataDirs[0])
    expect(mockCreateProfileDir).toHaveBeenCalledWith(capturedUserDataDirs[1])
    expect(mockRemoveProfileDir).toHaveBeenCalledWith(capturedUserDataDirs[0])
    expect(mockRemoveProfileDir).toHaveBeenCalledWith(capturedUserDataDirs[1])
  })

  it('cleans up the isolated Chrome profile even when the translation fails', async () => {
    mockConnect.mockImplementation(() =>
      Promise.resolve({
        browser: mockBrowser,
        page: {
          ...mockPage,
          goto: mock(() => Promise.reject(new Error('network down'))),
        },
      }),
    )

    const service = createService()

    // eslint-disable-next-line @typescript-eslint/await-thenable, @typescript-eslint/no-confusing-void-expression
    await expect(service.translate({ text: 'Hello', style: 'Clear' })).rejects.toThrow()

    expect(mockCreateProfileDir).toHaveBeenCalledTimes(1)
    expect(mockRemoveProfileDir).toHaveBeenCalledTimes(1)
    expect(mockRemoveProfileDir).toHaveBeenCalledWith(
      expect.stringMatching(/kagi-profile-/u) as string,
    )
  })

  it('waits for Cloudflare Turnstile and Kagi bootstrap to settle after navigating before interacting with the page', async () => {
    const sleepCalls: number[] = []
    const service = createService({
      sleep: (ms) => {
        sleepCalls.push(ms)
        return Promise.resolve()
      },
    })

    await service.translate({ text: 'Hello', style: 'Clear' })

    // The post-navigation Cloudflare settle sleep (3000 ms) must happen at
    // least once during translate(). This guards against regressions that
    // would let UI interactions race Cloudflare verification on short inputs.
    expect(sleepCalls).toContain(3000)
  })

  it('accepts the minimal research baseline URL when translating Clear style', async () => {
    mockPage.url.mockImplementation(() => 'https://translate.kagi.com/?from=auto&to=vi&text=Hello')

    const service = createService()
    const result = await service.translate({ text: 'Hello', style: 'Clear' })

    expect(result.translated).toBe('Xin chao')
  })

  it('falls back to alternate output scraping when the primary translation selector never appears', async () => {
    // $eval rejects only for translation content (scrapeTranslatedText), resolves 0 for slider
    mockPage.$eval.mockImplementation((selector: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
      if (selector.includes('range')) return Promise.resolve(0) as any
      return Promise.reject(new Error('No translation container found'))
    })
    mockPage.evaluate.mockImplementation((_fn: unknown, arg?: unknown) => {
      if (
        typeof arg === 'object' &&
        arg !== null &&
        'TRANSLATION_CONTENT' in arg &&
        'OUTPUT_TEXTAREA' in arg
      ) {
        return Promise.resolve('Bản dịch từ fallback textarea')
      }

      return Promise.resolve('noop')
    })

    const service = createService()
    const result = await service.translate({ text: 'Hello', style: 'Clear' })

    expect(result.translated).toBe('Bản dịch từ fallback textarea')
  })

  it('applies Raw formality directly and returns the final fallback translation without a chim-moi phase', async () => {
    let readingLevelApplied = false
    let formality = 'standard'

    mockPage.url.mockImplementation(() => {
      const params = ['from=auto', 'to=vi', 'text=Hello']

      if (readingLevelApplied) {
        params.push('language_complexity=6')
      }

      if (formality === 'vietnamese_casual') {
        params.push('formality_context=vi_casual')
      }

      return `https://translate.kagi.com/?${params.join('&')}`
    })

    // $eval rejects only for translation content; resolves 0 for slider currentStep
    mockPage.$eval.mockImplementation((selector: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
      if (selector.includes('range')) return Promise.resolve(0) as any
      return Promise.reject(new Error('No translation container found'))
    })

    // Track dragSlider for reading level: spy on IHumanInteraction methods directly
    mockHumanInteraction.dragSlider = mock(
      (_page: unknown, _sel: string, _from: number, toStep: number) => {
        if (toStep === 6) readingLevelApplied = true
        return Promise.resolve()
      },
    ) as typeof mockHumanInteraction.dragSlider

    mockHumanInteraction.clickByTextContent = mock(
      (_page: unknown, _selector: string, label: string) => {
        if (label === 'Vietnamese Casual') formality = 'vietnamese_casual'
        return Promise.resolve()
      },
    ) as typeof mockHumanInteraction.clickByTextContent

    mockPage.evaluate.mockImplementation((_fn: unknown, arg?: unknown) => {
      if (
        typeof arg === 'object' &&
        arg !== null &&
        'TRANSLATION_CONTENT' in arg &&
        'OUTPUT_TEXTAREA' in arg
      ) {
        return Promise.resolve(
          formality === 'vietnamese_casual'
            ? 'Bản dịch casual cuối cùng'
            : 'Bản dịch chuẩn ban đầu',
        )
      }

      return Promise.resolve('noop')
    })

    const service = createService()
    const result = await service.translate({ text: 'Hello', style: 'Raw' })

    expect(result.translated).toBe('Bản dịch casual cuối cùng')
    expect(mockHumanInteraction.clickByTextContent).toHaveBeenCalledWith(
      mockPage,
      KAGI_SELECTORS.FORMALITY_LABEL,
      'Vietnamese Casual',
      0,
    )
    expect(mockPage.waitForFunction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ timeout: 15_000, polling: 100 }),
      'formality_context=vi_casual',
    )
  })

  it('truncates oversized input text and logs warning before translation', async () => {
    let fakeTime = 0
    const service = createService({
      sleep: () => Promise.resolve(),
      now: () => {
        fakeTime += 10_000
        return fakeTime
      },
    })
    const longText = 'a'.repeat(25_000)

    const warnCalls: unknown[][] = []
    const originalWarn = console.warn
    console.warn = (...args: unknown[]) => {
      warnCalls.push(args)
    }

    try {
      await service.translate({ text: longText, style: 'Clear' })
    } finally {
      console.warn = originalWarn
    }

    expect(warnCalls.some((args) => String(args[0]).includes('Input text truncated'))).toBe(true)
  })

  it('waitForTranslationOutputStable uses scaled stable window proportional to charCount', async () => {
    // For 5000-char text (1.5x), stable window = computeScaledDelay(1500, 5000) ≈ 2250ms
    // We verify the poll loop eventually resolves even with a scaled window
    let callCount = 0
    mockPage.evaluate.mockImplementation(() => {
      callCount++
      // Return empty for first 2 polls, then return stable text
      if (callCount < 3) return Promise.resolve('')
      return Promise.resolve('Translated text')
    })

    const service = createService({ sleep: () => Promise.resolve() })

    const result = await service.translate({
      text: 'a'.repeat(5_000),
      style: 'Clear',
    })

    expect(result.translated).toBe('Translated text')
  })

  it('navigates to language-pair URL without text', async () => {
    const service = createService()
    await service.translate({ text: 'Hello', style: 'Clear' })
    const firstCall = mockPage.goto.mock.calls[0]
    const gotoUrl = firstCall ? firstCall[0] : ''
    expect(gotoUrl).toBe('https://translate.kagi.com/?from=auto&to=vi')
    expect(gotoUrl).not.toContain('text=')
  })

  it('calls chunkPaste for text longer than HUMAN_INPUT_THRESHOLD (>500 chars)', async () => {
    const service = createService()
    await service.translate({ text: 'a'.repeat(600), style: 'Clear' })
    expect(mockHumanInteraction.chunkPaste).toHaveBeenCalledTimes(1)
    expect(mockHumanInteraction.typeIntoContentEditable).not.toHaveBeenCalled()
  })

  it('calls typeIntoContentEditable for text at or below HUMAN_INPUT_THRESHOLD', async () => {
    const service = createService()
    await service.translate({ text: 'Short text', style: 'Clear' })
    expect(mockHumanInteraction.typeIntoContentEditable).toHaveBeenCalledTimes(1)
    expect(mockHumanInteraction.chunkPaste).not.toHaveBeenCalled()
  })

  it('delegates Translation Settings click to humanInteraction.click', async () => {
    const service = createService()
    await service.translate({ text: 'Hello', style: 'Clear' })
    expect(mockHumanInteraction.click).toHaveBeenCalledWith(
      mockPage,
      KAGI_SELECTORS.TRANSLATION_SETTINGS_BUTTON,
    )
  })

  it('delegates context fill to humanInteraction.typeIntoTextarea', async () => {
    const service = createService()
    await service.translate({ text: 'Hello', style: 'Clear', context: 'Test context' })
    expect(mockHumanInteraction.typeIntoTextarea).toHaveBeenCalledWith(
      mockPage,
      KAGI_SELECTORS.CONTEXT_TEXTAREA,
      'Test context',
    )
  })

  it('propagates KagiSidecarError when humanInteraction.click throws', async () => {
    mockHumanInteraction.click.mockRejectedValueOnce(new Error('ghost-cursor failed'))

    const service = createService()

    try {
      await service.translate({ text: 'Hello', style: 'Clear' })
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toMatchObject({ code: 'UI_INTERACTION' })
    }
  })

  it.skip('waits for rendered translation output to stabilize before returning it (old polling-based behavior, pending update)', async () => {
    mockPage.evaluate
      .mockResolvedValueOnce('Bản dịch đang render dang dở')
      .mockResolvedValueOnce('Bản dịch hoàn chỉnh')
      .mockResolvedValueOnce('Bản dịch hoàn chỉnh')

    const service = createService()
    const result = await service.translate({ text: 'Hello world', style: 'Clear' })

    expect(result.translated).toBe('Bản dịch hoàn chỉnh')
  })
})

describe('KagiBrowserService URL verification helpers', () => {
  let KagiBrowserService: typeof KagiBrowserServiceType
  let _KagiSidecarError: typeof _KagiSidecarErrorType

  beforeEach(async () => {
    const mod = await import('./browser-service')
    KagiBrowserService = mod.KagiBrowserService
    _KagiSidecarError = mod.KagiSidecarError
  })

  function createPageLike(url: string) {
    return {
      goto: () => Promise.resolve(),
      waitForSelector: () => Promise.resolve(),
      evaluate: () => Promise.resolve(''),
      url: () => url,
    }
  }

  function asUrlVerificationService(
    s: InstanceType<typeof KagiBrowserServiceType>,
  ): UrlVerificationService {
    return s as unknown as UrlVerificationService
  }

  it('verifyUrlContains passes when URL includes fragment', () => {
    const service = new KagiBrowserService({ maxRetries: 0, sleep: () => Promise.resolve() })
    const page = createPageLike('https://translate.kagi.com/?speaker_gender=unknown')

    expect(() => {
      asUrlVerificationService(service).verifyUrlContains(
        page,
        'speaker_gender=unknown',
        'Speaker gender baseline',
      )
    }).not.toThrow()
  })

  it('verifyUrlContains throws UI_INTERACTION when fragment missing', () => {
    const service = new KagiBrowserService({ maxRetries: 0, sleep: () => Promise.resolve() })
    const page = createPageLike('https://translate.kagi.com/?from=auto')

    expect(() => {
      asUrlVerificationService(service).verifyUrlContains(
        page,
        'speaker_gender=unknown',
        'Speaker gender baseline',
      )
    }).toThrow(_KagiSidecarError)

    try {
      asUrlVerificationService(service).verifyUrlContains(
        page,
        'speaker_gender=unknown',
        'Speaker gender baseline',
      )
    } catch (error) {
      expect(error).toMatchObject({
        code: 'UI_INTERACTION',
        status: 502,
      })
    }
  })

  it('verifyUrlNotContains passes when fragment absent', () => {
    const service = new KagiBrowserService({ maxRetries: 0, sleep: () => Promise.resolve() })
    const page = createPageLike('https://translate.kagi.com/?from=auto')

    expect(() => {
      asUrlVerificationService(service).verifyUrlNotContains(page, 'context=', 'Context cleared')
    }).not.toThrow()
  })

  it('verifyUrlNotContains throws when fragment present', () => {
    const service = new KagiBrowserService({ maxRetries: 0, sleep: () => Promise.resolve() })
    const page = createPageLike('https://translate.kagi.com/?context=old')

    expect(() => {
      asUrlVerificationService(service).verifyUrlNotContains(
        page,
        'context=',
        'Context should be cleared',
      )
    }).toThrow(_KagiSidecarError)
  })

  it('verifyUrlMatchesReadingLevel passes for standard with no param', () => {
    const service = new KagiBrowserService({ maxRetries: 0, sleep: () => Promise.resolve() })
    const page = createPageLike('https://translate.kagi.com/?from=auto')

    expect(() => {
      asUrlVerificationService(service).verifyUrlMatchesReadingLevel(
        page,
        'standard',
        'Standard level',
      )
    }).not.toThrow()
  })

  it('verifyUrlMatchesReadingLevel passes for standard with complexity=0', () => {
    const service = new KagiBrowserService({ maxRetries: 0, sleep: () => Promise.resolve() })
    const page = createPageLike('https://translate.kagi.com/?language_complexity=0')

    expect(() => {
      asUrlVerificationService(service).verifyUrlMatchesReadingLevel(
        page,
        'standard',
        'Standard level',
      )
    }).not.toThrow()
  })

  it('verifyUrlMatchesReadingLevel passes for c2 with complexity=6', () => {
    const service = new KagiBrowserService({ maxRetries: 0, sleep: () => Promise.resolve() })
    const page = createPageLike('https://translate.kagi.com/?language_complexity=6')

    expect(() => {
      asUrlVerificationService(service).verifyUrlMatchesReadingLevel(page, 'c2', 'C2 level')
    }).not.toThrow()
  })

  it('verifyUrlMatchesReadingLevel passes for c2 with complexity=c2', () => {
    const service = new KagiBrowserService({ maxRetries: 0, sleep: () => Promise.resolve() })
    const page = createPageLike('https://translate.kagi.com/?language_complexity=c2')

    expect(() => {
      asUrlVerificationService(service).verifyUrlMatchesReadingLevel(page, 'c2', 'C2 level')
    }).not.toThrow()
  })

  it('verifyUrlMatchesReadingLevel throws when non-standard level missing param', () => {
    const service = new KagiBrowserService({ maxRetries: 0, sleep: () => Promise.resolve() })
    const page = createPageLike('https://translate.kagi.com/?from=auto')

    expect(() => {
      asUrlVerificationService(service).verifyUrlMatchesReadingLevel(page, 'c2', 'C2 level check')
    }).toThrow(_KagiSidecarError)
  })
})

interface BasicUiService {
  clickTranslationSettingsButton(page: PageLike): Promise<void>
  clearTranslationContext(page: PageLike): Promise<void>
  fillTranslationContext(page: PageLike, context: string): Promise<void>
  clickSpeakerGenderOption(page: PageLike, label: string): Promise<void>
  clickAddresseeGenderOption(page: PageLike, label: string): Promise<void>
  clickTranslationStyleOption(page: PageLike, label: string): Promise<void>
  clickFormalityOption(page: PageLike, label: string): Promise<void>
}

describe('KagiBrowserService basic UI interaction helpers', () => {
  let KagiBrowserService: typeof KagiBrowserServiceType

  beforeEach(async () => {
    const mod = await import('./browser-service')
    KagiBrowserService = mod.KagiBrowserService
  })

  function createService() {
    return new KagiBrowserService({
      minIntervalMs: 0,
      maxQueueDepth: 10,
      maxQueueWaitMs: 10_000,
      maxRetries: 0,
      sleep: () => Promise.resolve(),
      humanInteraction: mockHumanInteraction,
    })
  }

  function asBasicUiService(s: InstanceType<typeof KagiBrowserServiceType>): BasicUiService {
    return s as unknown as BasicUiService
  }

  function minimalPage(overrides: Record<string, unknown> = {}) {
    return {
      goto: () => Promise.resolve(),
      waitForSelector: mock((_s: string) => Promise.resolve(null)),
      evaluate: mock((_fn: unknown, _arg?: unknown) => Promise.resolve(undefined)),
      focus: mock((_s: string) => Promise.resolve()),
      url: () => 'https://translate.kagi.com/',
      ...overrides,
    }
  }

  it('clickTranslationSettingsButton delegates to humanInteraction.click', async () => {
    const service = createService()
    await asBasicUiService(service).clickTranslationSettingsButton(
      minimalPage() as unknown as PageLike,
    )

    expect(mockHumanInteraction.click).toHaveBeenCalledWith(
      expect.anything(),
      KAGI_SELECTORS.TRANSLATION_SETTINGS_BUTTON,
    )
  })

  it('clickTranslationSettingsButton throws UI_INTERACTION when humanInteraction.click throws', async () => {
    mockHumanInteraction.click.mockRejectedValueOnce(new Error('click failed'))
    const service = createService()

    try {
      await asBasicUiService(service).clickTranslationSettingsButton(
        minimalPage() as unknown as PageLike,
      )
      expect.unreachable('expected UI_INTERACTION rejection')
    } catch (error) {
      expect(error).toMatchObject({ code: 'UI_INTERACTION' })
    }
  })

  it('clearTranslationContext focuses textarea and runs clear evaluate', async () => {
    const focus = mock(() => Promise.resolve())
    const evaluate = mock((_fn: unknown, arg?: unknown) => Promise.resolve(arg))

    const service = createService()
    await asBasicUiService(service).clearTranslationContext(
      minimalPage({ focus, evaluate }) as unknown as PageLike,
    )

    expect(focus).toHaveBeenCalledWith(KAGI_SELECTORS.CONTEXT_TEXTAREA)
    expect(evaluate).toHaveBeenCalledTimes(1)
    expect(evaluate.mock.calls[0]?.[1]).toBe(KAGI_SELECTORS.CONTEXT_TEXTAREA)
  })

  it('fillTranslationContext delegates to humanInteraction.typeIntoTextarea', async () => {
    const service = createService()
    await asBasicUiService(service).fillTranslationContext(
      minimalPage() as unknown as PageLike,
      'my context text',
    )

    expect(mockHumanInteraction.typeIntoTextarea).toHaveBeenCalledWith(
      expect.anything(),
      KAGI_SELECTORS.CONTEXT_TEXTAREA,
      'my context text',
    )
  })

  it('clickSpeakerGenderOption delegates to humanInteraction.clickByTextContent at index 0', async () => {
    const service = createService()
    await asBasicUiService(service).clickSpeakerGenderOption(
      minimalPage() as unknown as PageLike,
      'Feminine',
    )

    expect(mockHumanInteraction.clickByTextContent).toHaveBeenCalledWith(
      expect.anything(),
      KAGI_SELECTORS.GENDER_LABEL,
      'Feminine',
      0,
    )
  })

  it('clickAddresseeGenderOption delegates to humanInteraction.clickByTextContent at index 1', async () => {
    const service = createService()
    await asBasicUiService(service).clickAddresseeGenderOption(
      minimalPage() as unknown as PageLike,
      'Neutral',
    )

    expect(mockHumanInteraction.clickByTextContent).toHaveBeenCalledWith(
      expect.anything(),
      KAGI_SELECTORS.GENDER_LABEL,
      'Neutral',
      1,
    )
  })

  it('clickTranslationStyleOption delegates to humanInteraction.clickByTextContent at index 0', async () => {
    const service = createService()
    await asBasicUiService(service).clickTranslationStyleOption(
      minimalPage() as unknown as PageLike,
      'Literal',
    )

    expect(mockHumanInteraction.clickByTextContent).toHaveBeenCalledWith(
      expect.anything(),
      KAGI_SELECTORS.STYLE_LABEL,
      'Literal',
      0,
    )
  })

  it('clickFormalityOption delegates to humanInteraction.clickByTextContent at index 0', async () => {
    const service = createService()
    await asBasicUiService(service).clickFormalityOption(
      minimalPage() as unknown as PageLike,
      'Standard',
    )

    expect(mockHumanInteraction.clickByTextContent).toHaveBeenCalledWith(
      expect.anything(),
      KAGI_SELECTORS.FORMALITY_LABEL,
      'Standard',
      0,
    )
  })

  it('clearTranslationContext wraps focus errors in UI_INTERACTION', async () => {
    const focus = mock(() => Promise.reject(new Error('focus failed')))

    const service = createService()
    try {
      await asBasicUiService(service).clearTranslationContext(
        minimalPage({ focus }) as unknown as PageLike,
      )
      expect.unreachable('expected UI_INTERACTION rejection')
    } catch (error) {
      expect(error).toMatchObject({
        code: 'UI_INTERACTION',
        status: 502,
      })
    }
  })
})

type _CompileOnly = KagiStyle
