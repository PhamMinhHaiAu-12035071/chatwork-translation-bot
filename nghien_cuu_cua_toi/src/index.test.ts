/**
 * Integration tests for main entry point
 *
 * Tests service interactions and end-to-end workflows
 * Uses mocked browser to avoid real browser launches
 */

import { describe, it, expect, mock, setDefaultTimeout } from 'bun:test'

setDefaultTimeout(30_000)
import { KagiUrlBuilder, KagiBrowserService } from '~/services'
import { getDefaultTranslationOptions, DEFAULT_TRANSLATION_CONFIG } from '~/config'
import { ValidationError, BrowserAutomationError } from '~/errors'

const MOCK_FINAL_URL = 'https://translate.kagi.com/?text=Hello&mockFinal=1'

/** Mirrors {@link KagiBrowserService.translate} stripping formality params before `goto` */
function stripFormalityParamsFromUrl(url: string): string {
  const u = new URL(url)
  u.searchParams.delete('formality')
  u.searchParams.delete('formality_context')
  return u.toString()
}

// Mock puppeteer-real-browser for integration tests
const mockPage = {
  goto: mock(async () => {}),
  waitForSelector: mock(async () => {}),
  waitForFunction: mock(async () => {}),
  click: mock(async () => {}),
  focus: mock(async () => {}),
  evaluate: mock(async () => 'Xin chào, bạn khỏe không hôm nay?'),
  url: mock(() => MOCK_FINAL_URL),
}

function queueEvaluateForOneTranslate(result: string) {
  mockPage.evaluate
    .mockResolvedValueOnce(true as never)
    .mockResolvedValueOnce(true as never)
    .mockResolvedValueOnce(true as never)
    .mockResolvedValueOnce(true as never)
    .mockResolvedValueOnce(undefined as never)
    .mockResolvedValueOnce(result)
}

/** Non-standard formality: formality row click inside settings before dismiss (fifth truthy evaluate). */
function queueEvaluateForOneTranslateWithFormalitySwitch(result: string) {
  mockPage.evaluate
    .mockResolvedValueOnce(true as never)
    .mockResolvedValueOnce(true as never)
    .mockResolvedValueOnce(true as never)
    .mockResolvedValueOnce(true as never)
    .mockResolvedValueOnce(true as never)
    .mockResolvedValueOnce(undefined as never)
    .mockResolvedValueOnce(result)
}

const mockBrowser = {
  close: mock(async () => {}),
}

const mockConnect = mock(async () => ({
  browser: mockBrowser,
  page: mockPage,
}))

mock.module('puppeteer-real-browser', () => ({
  connect: mockConnect,
}))

describe('Integration: Config + URLBuilder', () => {
  it('should build URL from default config', () => {
    const urlBuilder = new KagiUrlBuilder()
    const options = getDefaultTranslationOptions()

    const inputText = DEFAULT_TRANSLATION_CONFIG.INPUT_TEXT
    const url = urlBuilder.build(inputText, options)

    expect(url).toContain('from=auto')
    expect(url).toContain('to=vi')
    const textParam = new URL(url).searchParams.get('text')
    expect(textParam).toBe(inputText)
    // Defaults should not add extra params
    expect(url).not.toContain('language_complexity')
    expect(url).not.toContain('formality')
  })

  it('should use config constants in options', () => {
    const options = getDefaultTranslationOptions()

    expect(options.sourceLang).toBe(DEFAULT_TRANSLATION_CONFIG.SOURCE_LANG)
    expect(options.targetLang).toBe(DEFAULT_TRANSLATION_CONFIG.TARGET_LANG)
    expect(options.readingLevel).toBe(DEFAULT_TRANSLATION_CONFIG.READING_LEVEL)
  })

  it('should allow overriding config defaults', () => {
    const urlBuilder = new KagiUrlBuilder()
    const options = getDefaultTranslationOptions()

    // Override defaults
    options.readingLevel = 'c2'
    options.formality = 'vietnamese_formal'

    const url = urlBuilder.build('Hello', options)

    expect(url).not.toContain('language_complexity')
    expect(url).toContain('formality=more')
    expect(url).toContain('formality_context=vi_formal')
  })
})

describe('Integration: URLBuilder + BrowserService', () => {
  it('should complete full translation workflow', async () => {
    const urlBuilder = new KagiUrlBuilder()
    const browserService = new KagiBrowserService()
    const options = getDefaultTranslationOptions()

    // Build URL
    const url = urlBuilder.build('Hello, how are you today?', options)
    expect(url).toBeTruthy()

    // Launch browser
    await browserService.launch()

    // Translate
    const result = await browserService.translate(url, options)
    expect(result.translated).toBe('Xin chào, bạn khỏe không hôm nay?')
    expect(result.finalUrl).toBe(MOCK_FINAL_URL)

    // Cleanup
    await browserService.close()

    // Verify integration
    expect(mockConnect).toHaveBeenCalled()
    expect(mockPage.goto).toHaveBeenCalledWith(stripFormalityParamsFromUrl(url), expect.any(Object))
    expect(mockBrowser.close).toHaveBeenCalled()
  })

  it(
    'should handle multiple translations with same services',
    async () => {
      const urlBuilder = new KagiUrlBuilder()
      const browserService = new KagiBrowserService()
      const options = getDefaultTranslationOptions()

      await browserService.launch()

      // First translation
      const url1 = urlBuilder.build('Hello', options)
      queueEvaluateForOneTranslate('Xin chào')
      const result1 = await browserService.translate(url1, options)
      expect(result1.translated).toBe('Xin chào')
      expect(result1.finalUrl).toBe(MOCK_FINAL_URL)

      // Second translation with different text
      const url2 = urlBuilder.build('Goodbye', options)
      queueEvaluateForOneTranslate('Tạm biệt')
      const result2 = await browserService.translate(url2, options)
      expect(result2.translated).toBe('Tạm biệt')
      expect(result2.finalUrl).toBe(MOCK_FINAL_URL)

      await browserService.close()
    },
    { timeout: 45_000 },
  )

  it('should handle advanced settings in full workflow', async () => {
    const urlBuilder = new KagiUrlBuilder()
    const browserService = new KagiBrowserService()
    const options = getDefaultTranslationOptions()

    // Configure advanced settings
    options.readingLevel = 'b2'
    options.speakerGender = 'neutral'
    options.formality = 'vietnamese_casual'
    options.style = 'literal'

    const url = urlBuilder.build('Complex sentence', options)

    // Verify URL has all params
    expect(url).not.toContain('language_complexity')
    expect(url).toContain('speaker_gender=neutral')
    expect(url).toContain('formality_context=vi_casual')
    expect(url).toContain('style=literal')

    await browserService.launch()
    queueEvaluateForOneTranslateWithFormalitySwitch('Câu phức tạp')
    const result = await browserService.translate(url, options)
    expect(result.translated).toBe('Câu phức tạp')
    expect(result.finalUrl).toBe(MOCK_FINAL_URL)
    await browserService.close()
  })
})

describe('Integration: Error Propagation', () => {
  it('should propagate ValidationError from URLBuilder to caller', () => {
    const urlBuilder = new KagiUrlBuilder()
    const options = getDefaultTranslationOptions()
    options.readingLevel = 'x99' as any

    expect(() => {
      urlBuilder.build('Hello', options)
    }).toThrow(ValidationError)
  })

  it('should propagate BrowserAutomationError from BrowserService', async () => {
    mockConnect.mockRejectedValueOnce(new Error('Browser launch failed'))

    const browserService = new KagiBrowserService()

    await expect(browserService.launch()).rejects.toThrow(BrowserAutomationError)

    // Reset mock for other tests
    mockConnect.mockResolvedValue({
      browser: mockBrowser,
      page: mockPage,
    })
  })

  it('should handle error in translation and still close browser', async () => {
    const browserService = new KagiBrowserService()
    await browserService.launch()

    mockPage.goto.mockRejectedValueOnce(new Error('Navigation timeout'))

    await expect(browserService.translate('https://invalid-url.com')).rejects.toThrow(
      BrowserAutomationError,
    )

    // Should still be able to close
    await browserService.close() // If this throws, test will fail
    expect(true).toBe(true) // Confirms we reached here without error

    // Reset mock
    mockPage.goto.mockResolvedValue(undefined)
  })

  it('should include context in propagated errors', async () => {
    const urlBuilder = new KagiUrlBuilder()
    const options = getDefaultTranslationOptions()

    try {
      options.formality = 'invalid' as any
      urlBuilder.build('Hello', options)
      expect(true).toBe(false) // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      const validationError = error as ValidationError
      expect(validationError.field).toBe('formality')
      expect(validationError.value).toBe('invalid')
      expect(validationError.allowedValues).toContain('standard')
      expect(validationError.allowedValues).toContain('vietnamese_formal')
    }
  })
})

describe('Integration: Service Lifecycle', () => {
  it(
    'should enforce correct service initialization order',
    async () => {
      const browserService = new KagiBrowserService()

      // Translate before launch should fail
      await expect(browserService.translate('https://example.com')).rejects.toThrow(
        BrowserAutomationError,
      )

      // Launch then translate should work
      await browserService.launch()
      queueEvaluateForOneTranslate('Result')
      const result = await browserService.translate(
        'https://example.com',
        getDefaultTranslationOptions(),
      )
      expect(result.translated).toBe('Result')
      expect(result.finalUrl).toBe(MOCK_FINAL_URL)

      await browserService.close()
    },
    { timeout: 20_000 },
  )

  it(
    'should allow re-initialization after close',
    async () => {
      const browserService = new KagiBrowserService()

      // First lifecycle
      await browserService.launch()
      queueEvaluateForOneTranslate('First')
      const result1 = await browserService.translate(
        'https://example.com',
        getDefaultTranslationOptions(),
      )
      expect(result1.translated).toBe('First')
      expect(result1.finalUrl).toBe(MOCK_FINAL_URL)
      await browserService.close()

      // Second lifecycle
      await browserService.launch()
      queueEvaluateForOneTranslate('Second')
      const result2 = await browserService.translate(
        'https://example.com',
        getDefaultTranslationOptions(),
      )
      expect(result2.translated).toBe('Second')
      expect(result2.finalUrl).toBe(MOCK_FINAL_URL)
      await browserService.close()
    },
    { timeout: 35_000 },
  )

  it('should handle URL building without browser service', () => {
    const urlBuilder = new KagiUrlBuilder()
    const options = getDefaultTranslationOptions()

    // URL building is independent of browser service
    const url = urlBuilder.build('Hello', options)
    expect(url).toBeTruthy()
    expect(url).toContain('https://translate.kagi.com')
  })
})

describe('Integration: Real-World Scenarios', () => {
  it('should handle Vietnamese text input', async () => {
    const urlBuilder = new KagiUrlBuilder()
    const browserService = new KagiBrowserService()
    const options = getDefaultTranslationOptions()

    // Reverse translation: Vietnamese to English
    options.sourceLang = 'vi'
    options.targetLang = 'en'

    const url = urlBuilder.build('Xin chào', options)
    expect(url).toContain('from=vi')
    expect(url).toContain('to=en')

    await browserService.launch()
    queueEvaluateForOneTranslate('Hello')
    const result = await browserService.translate(url)
    expect(result.translated).toBe('Hello')
    expect(result.finalUrl).toBe(MOCK_FINAL_URL)
    await browserService.close()
  })

  it('should handle empty text gracefully', async () => {
    const urlBuilder = new KagiUrlBuilder()
    const browserService = new KagiBrowserService()
    const options = getDefaultTranslationOptions()

    const url = urlBuilder.build('', options)
    expect(url).toContain('text=')

    await browserService.launch()
    queueEvaluateForOneTranslate('')
    const result = await browserService.translate(url)
    expect(result.translated).toBe('')
    expect(result.finalUrl).toBe(MOCK_FINAL_URL)
    await browserService.close()
  })

  it('should handle special characters in text', async () => {
    const urlBuilder = new KagiUrlBuilder()
    const browserService = new KagiBrowserService()
    const options = getDefaultTranslationOptions()

    const specialText = 'Hello & "goodbye"! <test>'
    const url = urlBuilder.build(specialText, options)

    // URL should encode special characters
    expect(url).toBeTruthy()
    expect(url).toContain('text=')

    await browserService.launch()
    queueEvaluateForOneTranslate('Xin chào & "tạm biệt"! <test>')
    const result = await browserService.translate(url)
    expect(result.translated).toBeTruthy()
    expect(result.finalUrl).toBe(MOCK_FINAL_URL)
    await browserService.close()
  })

  it('should complete workflow matching original index.ts behavior', async () => {
    // This test mimics the exact flow of the original monolithic index.ts

    const urlBuilder = new KagiUrlBuilder()
    const browserService = new KagiBrowserService()

    // 1. Load config (same as original)
    const inputText = DEFAULT_TRANSLATION_CONFIG.INPUT_TEXT
    const options = getDefaultTranslationOptions()

    // 2. Build URL (same as original buildKagiUrl)
    const url = urlBuilder.build(inputText, options)
    expect(url).toBeTruthy()

    // 3. Launch browser (same as original connect)
    await browserService.launch()

    // 4. Navigate and translate (same as original page.goto + scrape)
    queueEvaluateForOneTranslate('Xin chào, bạn khỏe không hôm nay?')
    const run = await browserService.translate(url)

    // 5. Verify result
    expect(run.translated).toBe('Xin chào, bạn khỏe không hôm nay?')
    expect(run.finalUrl).toBe(MOCK_FINAL_URL)

    // 6. Cleanup (same as original browser.close)
    await browserService.close()

    // Verify all interactions happened
    expect(mockConnect).toHaveBeenCalled()
    expect(mockPage.goto).toHaveBeenCalled()
    expect(mockBrowser.close).toHaveBeenCalled()
  })
})
