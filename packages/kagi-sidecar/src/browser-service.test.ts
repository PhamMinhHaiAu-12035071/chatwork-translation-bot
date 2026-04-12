import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { KagiStyle } from '@chatwork-bot/provider-kagi'
import type {
  ElementHandleLike,
  KagiBrowserService as KagiBrowserServiceType,
  KagiSidecarError as _KagiSidecarErrorType,
} from './browser-service'
import { KAGI_SELECTORS } from './constants/kagi-ui.js'

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
  let _KagiSidecarError: typeof _KagiSidecarErrorType

  beforeEach(async () => {
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

  it('accepts the minimal research baseline URL when translating Clear style', async () => {
    mockPage.url.mockImplementation(() => 'https://translate.kagi.com/?from=auto&to=vi&text=Hello')

    const service = createService()
    const result = await service.translate({ text: 'Hello', style: 'Clear' })

    expect(result.translated).toBe('Xin chao')
  })

  it('falls back to alternate output scraping when the primary translation selector never appears', async () => {
    mockPage.$eval.mockRejectedValue(new Error('No translation container found'))
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

  it('reuses fallback output scraping across the Raw chim-moi flow when the primary selector is missing', async () => {
    let readingLevel = 'standard'
    let formality = 'standard'

    mockPage.waitForSelector.mockImplementation(() => Promise.resolve(mockElementHandle))
    mockPage.url.mockImplementation(() => {
      const params = ['from=auto', 'to=vi', 'text=Hello']

      if (readingLevel === 'c2') {
        params.push('language_complexity=6')
      }

      if (formality === 'vietnamese_casual') {
        params.push('formality_context=vi_casual')
      }

      return `https://translate.kagi.com/?${params.join('&')}`
    })

    mockPage.$eval.mockRejectedValue(new Error('No translation container found'))
    mockPage.evaluate.mockImplementation((_fn: unknown, arg?: unknown) => {
      if (
        typeof arg === 'object' &&
        arg !== null &&
        'sel' in arg &&
        'step' in arg &&
        arg.step === 6
      ) {
        readingLevel = 'c2'
        return Promise.resolve('noop')
      }

      if (
        typeof arg === 'object' &&
        arg !== null &&
        'targetLabel' in arg &&
        arg.targetLabel === 'Vietnamese Casual'
      ) {
        formality = 'vietnamese_casual'
        return Promise.resolve('noop')
      }

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
  clickTranslationSettingsButton(page: {
    waitForSelector: (
      selector: string,
      options?: { visible?: boolean; timeout?: number },
    ) => Promise<ElementHandleLike | null>
    focus: (selector: string) => Promise<void>
    evaluate: <A, R>(fn: (arg: A) => R, arg: A) => Promise<R>
    url: () => string
  }): Promise<void>
  clearTranslationContext(page: {
    focus: (selector: string) => Promise<void>
    evaluate: <A, R>(fn: (arg: A) => R, arg: A) => Promise<R>
    url: () => string
  }): Promise<void>
  fillTranslationContext(
    page: {
      focus: (selector: string) => Promise<void>
      evaluate: <A, R>(fn: (arg: A) => R, arg: A) => Promise<R>
      url: () => string
    },
    context: string,
  ): Promise<void>
  clickSpeakerGenderOption(
    page: { evaluate: <A, R>(fn: (arg: A) => R, arg: A) => Promise<R>; url: () => string },
    label: string,
  ): Promise<void>
  clickAddresseeGenderOption(
    page: { evaluate: <A, R>(fn: (arg: A) => R, arg: A) => Promise<R>; url: () => string },
    label: string,
  ): Promise<void>
  clickTranslationStyleOption(
    page: { evaluate: <A, R>(fn: (arg: A) => R, arg: A) => Promise<R>; url: () => string },
    label: string,
  ): Promise<void>
  clickFormalityOption(
    page: { evaluate: <A, R>(fn: (arg: A) => R, arg: A) => Promise<R>; url: () => string },
    label: string,
  ): Promise<void>
}

interface FakeContainer {
  parentElement: FakeContainer | null
  querySelectorAll(selector: string): FakeSpan[]
}

interface FakeButton {
  click(): void
  parentElement: FakeContainer | null
}

interface FakeSpan {
  textContent: string
  click(): void
  closest(selector: string): FakeButton | null
  getBoundingClientRect(): { width: number; height: number }
}

function createFakeButton() {
  let clickCount = 0

  const button: FakeButton = {
    click() {
      clickCount += 1
    },
    parentElement: null,
  }

  return {
    button,
    get clickCount() {
      return clickCount
    },
  }
}

function createFakeSpan(label: string, button: FakeButton): FakeSpan {
  return {
    textContent: label,
    click() {
      button.click()
    },
    closest(selector: string) {
      return selector === 'button' ? button : null
    },
    getBoundingClientRect() {
      return { width: 120, height: 24 }
    },
  }
}

function createFakeContainer(spans: FakeSpan[], supportedSelectors: string[]): FakeContainer {
  return {
    parentElement: null,
    querySelectorAll(selector: string) {
      return supportedSelectors.includes(selector) ? spans : []
    },
  }
}

function withFakeDocument<TResult>(
  documentMock: { querySelectorAll(selector: string): FakeSpan[] },
  run: () => TResult,
): TResult {
  const hadDocument = 'document' in globalThis
  const originalDocument = hadDocument
    ? (globalThis as typeof globalThis & { document?: unknown }).document
    : undefined

  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: documentMock,
  })

  try {
    return run()
  } finally {
    if (hadDocument) {
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: originalDocument,
      })
    } else {
      Reflect.deleteProperty(globalThis, 'document')
    }
  }
}

function createEvaluateWithFakeDocument(documentMock: {
  querySelectorAll(selector: string): FakeSpan[]
}) {
  return mock(<TArg, TResult>(fn: (arg: TArg) => TResult, arg: TArg) => {
    try {
      return Promise.resolve(withFakeDocument(documentMock, () => fn(arg)))
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)))
    }
  })
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

  it('clickTranslationSettingsButton waits for visible button and clicks', async () => {
    const click = mock(() => Promise.resolve())
    const handle = { click } as ElementHandleLike
    const waitForSelector = mock((_s: string) => Promise.resolve(handle))

    const service = createService()
    await asBasicUiService(service).clickTranslationSettingsButton(
      minimalPage({ waitForSelector }) as Parameters<
        BasicUiService['clickTranslationSettingsButton']
      >[0],
    )

    expect(waitForSelector).toHaveBeenCalledWith(KAGI_SELECTORS.TRANSLATION_SETTINGS_BUTTON, {
      visible: true,
      timeout: 30_000,
    })
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('clickTranslationSettingsButton throws UI_INTERACTION when button is missing', async () => {
    const waitForSelector = mock((_s: string) => Promise.resolve(null))
    const service = createService()

    try {
      await asBasicUiService(service).clickTranslationSettingsButton(
        minimalPage({ waitForSelector }) as Parameters<
          BasicUiService['clickTranslationSettingsButton']
        >[0],
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
      minimalPage({ focus, evaluate }) as Parameters<BasicUiService['clearTranslationContext']>[0],
    )

    expect(focus).toHaveBeenCalledWith(KAGI_SELECTORS.CONTEXT_TEXTAREA)
    expect(evaluate).toHaveBeenCalledTimes(1)
    expect(evaluate.mock.calls[0]?.[1]).toBe(KAGI_SELECTORS.CONTEXT_TEXTAREA)
  })

  it('fillTranslationContext focuses and passes sel+text to evaluate', async () => {
    const focus = mock(() => Promise.resolve())
    const evaluate = mock((_fn: unknown, arg?: unknown) => Promise.resolve(arg))

    const service = createService()
    await asBasicUiService(service).fillTranslationContext(
      minimalPage({ focus, evaluate }) as Parameters<BasicUiService['fillTranslationContext']>[0],
      'my context text',
    )

    expect(focus).toHaveBeenCalledWith(KAGI_SELECTORS.CONTEXT_TEXTAREA)
    expect(evaluate).toHaveBeenCalledWith(expect.any(Function), {
      sel: KAGI_SELECTORS.CONTEXT_TEXTAREA,
      text: 'my context text',
    })
  })

  it('clickSpeakerGenderOption evaluates with selector payload', async () => {
    const evaluate = mock((_fn: unknown, arg?: unknown) => Promise.resolve(arg))

    const service = createService()
    await asBasicUiService(service).clickSpeakerGenderOption(
      minimalPage({ evaluate }) as Parameters<BasicUiService['clickSpeakerGenderOption']>[0],
      'Feminine',
    )

    expect(evaluate).toHaveBeenCalledWith(expect.any(Function), {
      selector: KAGI_SELECTORS.GENDER_LABEL,
      labelText: 'Feminine',
      matchIndex: 0,
    })
  })

  it('clickAddresseeGenderOption evaluates with selector payload', async () => {
    const evaluate = mock((_fn: unknown, arg?: unknown) => Promise.resolve(arg))

    const service = createService()
    await asBasicUiService(service).clickAddresseeGenderOption(
      minimalPage({ evaluate }) as Parameters<BasicUiService['clickAddresseeGenderOption']>[0],
      'Neutral',
    )

    expect(evaluate).toHaveBeenCalledWith(expect.any(Function), {
      selector: KAGI_SELECTORS.GENDER_LABEL,
      labelText: 'Neutral',
      matchIndex: 1,
    })
  })

  it('clickSpeakerGenderOption supports research span/button markup', async () => {
    const speakerButton = createFakeButton()
    const addresseeButton = createFakeButton()
    const spans = [
      createFakeSpan('Unknown', speakerButton.button),
      createFakeSpan('Unknown', addresseeButton.button),
    ]
    const documentMock = {
      querySelectorAll(selector: string) {
        return selector === 'span.flex-grow.text-start' ? spans : []
      },
    }
    const evaluate = createEvaluateWithFakeDocument(documentMock)

    const service = createService()
    await asBasicUiService(service).clickSpeakerGenderOption(
      minimalPage({ evaluate }) as Parameters<BasicUiService['clickSpeakerGenderOption']>[0],
      'Unknown',
    )

    expect(speakerButton.clickCount).toBe(1)
    expect(addresseeButton.clickCount).toBe(0)
  })

  it('clickAddresseeGenderOption uses second match with research span/button markup', async () => {
    const speakerButton = createFakeButton()
    const addresseeButton = createFakeButton()
    const spans = [
      createFakeSpan('Unknown', speakerButton.button),
      createFakeSpan('Unknown', addresseeButton.button),
    ]
    const documentMock = {
      querySelectorAll(selector: string) {
        return selector === 'span.flex-grow.text-start' ? spans : []
      },
    }
    const evaluate = createEvaluateWithFakeDocument(documentMock)

    const service = createService()
    await asBasicUiService(service).clickAddresseeGenderOption(
      minimalPage({ evaluate }) as Parameters<BasicUiService['clickAddresseeGenderOption']>[0],
      'Unknown',
    )

    expect(speakerButton.clickCount).toBe(0)
    expect(addresseeButton.clickCount).toBe(1)
  })

  it('clickTranslationStyleOption supports research span/button markup', async () => {
    const naturalButton = createFakeButton()
    const literalButton = createFakeButton()
    const spans = [
      createFakeSpan('Natural', naturalButton.button),
      createFakeSpan('Literal', literalButton.button),
    ]
    const documentMock = {
      querySelectorAll(selector: string) {
        return selector === 'span.flex-grow.text-start' ? spans : []
      },
    }
    const evaluate = createEvaluateWithFakeDocument(documentMock)

    const service = createService()
    await asBasicUiService(service).clickTranslationStyleOption(
      minimalPage({ evaluate }) as Parameters<BasicUiService['clickTranslationStyleOption']>[0],
      'Literal',
    )

    expect(naturalButton.clickCount).toBe(0)
    expect(literalButton.clickCount).toBe(1)
  })

  it('clickFormalityOption disambiguates the correct Standard row in research markup', async () => {
    const unrelatedStandardButton = createFakeButton()
    const targetStandardButton = createFakeButton()
    const formalButton = createFakeButton()
    const casualButton = createFakeButton()

    const unrelatedStandardSpan = createFakeSpan('Standard', unrelatedStandardButton.button)
    const targetStandardSpan = createFakeSpan('Standard', targetStandardButton.button)
    const formalSpan = createFakeSpan('Vietnamese Formal', formalButton.button)
    const casualSpan = createFakeSpan('Vietnamese Casual', casualButton.button)

    const formalitySelector = 'span.flex-grow.text-start, span.grow.text-start'
    const row = createFakeContainer(
      [targetStandardSpan, formalSpan, casualSpan],
      [formalitySelector],
    )
    targetStandardButton.button.parentElement = row
    formalButton.button.parentElement = row
    casualButton.button.parentElement = row

    const documentMock = {
      querySelectorAll(selector: string) {
        if (selector === formalitySelector) {
          return [unrelatedStandardSpan, targetStandardSpan, formalSpan, casualSpan]
        }

        return []
      },
    }
    const evaluate = createEvaluateWithFakeDocument(documentMock)

    const service = createService()
    await asBasicUiService(service).clickFormalityOption(
      minimalPage({ evaluate }) as Parameters<BasicUiService['clickFormalityOption']>[0],
      'Standard',
    )

    expect(unrelatedStandardButton.clickCount).toBe(0)
    expect(targetStandardButton.clickCount).toBe(1)
    expect(formalButton.clickCount).toBe(0)
    expect(casualButton.clickCount).toBe(0)
  })

  it('clearTranslationContext wraps focus errors in UI_INTERACTION', async () => {
    const focus = mock(() => Promise.reject(new Error('focus failed')))

    const service = createService()
    try {
      await asBasicUiService(service).clearTranslationContext(
        minimalPage({ focus }) as Parameters<BasicUiService['clearTranslationContext']>[0],
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
