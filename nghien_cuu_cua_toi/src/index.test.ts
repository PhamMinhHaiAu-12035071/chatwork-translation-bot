/**
 * Integration tests for main entry point
 *
 * Tests service interactions and end-to-end workflows
 * Uses mocked browser to avoid real browser launches
 */

import { describe, it, expect, mock } from 'bun:test'
import { KagiUrlBuilder, KagiBrowserService } from '~/services'
import { getDefaultTranslationOptions, DEFAULT_TRANSLATION_CONFIG } from '~/config'
import { ValidationError, BrowserAutomationError } from '~/errors'

// Mock puppeteer-real-browser for integration tests
const mockPage = {
  goto: mock(async () => {}),
  waitForSelector: mock(async () => {}),
  evaluate: mock(async () => 'Xin chào, bạn khỏe không hôm nay?'),
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

    const url = urlBuilder.build(DEFAULT_TRANSLATION_CONFIG.INPUT_TEXT, options)

    expect(url).toContain('from=auto')
    expect(url).toContain('to=vi')
    expect(url).toContain('text=Hello')
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

    expect(url).toContain('language_complexity=c2')
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
    const result = await browserService.translate(url)
    expect(result).toBe('Xin chào, bạn khỏe không hôm nay?')

    // Cleanup
    await browserService.close()

    // Verify integration
    expect(mockConnect).toHaveBeenCalled()
    expect(mockPage.goto).toHaveBeenCalledWith(url, expect.any(Object))
    expect(mockBrowser.close).toHaveBeenCalled()
  })

  it('should handle multiple translations with same services', async () => {
    const urlBuilder = new KagiUrlBuilder()
    const browserService = new KagiBrowserService()
    const options = getDefaultTranslationOptions()

    await browserService.launch()

    // First translation
    const url1 = urlBuilder.build('Hello', options)
    mockPage.evaluate.mockResolvedValueOnce('Xin chào')
    const result1 = await browserService.translate(url1)
    expect(result1).toBe('Xin chào')

    // Second translation with different text
    const url2 = urlBuilder.build('Goodbye', options)
    mockPage.evaluate.mockResolvedValueOnce('Tạm biệt')
    const result2 = await browserService.translate(url2)
    expect(result2).toBe('Tạm biệt')

    await browserService.close()
  })

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
    expect(url).toContain('language_complexity=b2')
    expect(url).toContain('speaker_gender=neutral')
    expect(url).toContain('formality_context=vi_casual')
    expect(url).toContain('style=literal')

    await browserService.launch()
    mockPage.evaluate.mockResolvedValueOnce('Câu phức tạp')
    const result = await browserService.translate(url)
    expect(result).toBe('Câu phức tạp')
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
  it('should enforce correct service initialization order', async () => {
    const browserService = new KagiBrowserService()

    // Translate before launch should fail
    await expect(browserService.translate('https://example.com')).rejects.toThrow(
      BrowserAutomationError,
    )

    // Launch then translate should work
    await browserService.launch()
    mockPage.evaluate.mockResolvedValueOnce('Result')
    const result = await browserService.translate('https://example.com')
    expect(result).toBe('Result')

    await browserService.close()
  })

  it('should allow re-initialization after close', async () => {
    const browserService = new KagiBrowserService()

    // First lifecycle
    await browserService.launch()
    mockPage.evaluate.mockResolvedValueOnce('First')
    const result1 = await browserService.translate('https://example.com')
    expect(result1).toBe('First')
    await browserService.close()

    // Second lifecycle
    await browserService.launch()
    mockPage.evaluate.mockResolvedValueOnce('Second')
    const result2 = await browserService.translate('https://example.com')
    expect(result2).toBe('Second')
    await browserService.close()
  })

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
    mockPage.evaluate.mockResolvedValueOnce('Hello')
    const result = await browserService.translate(url)
    expect(result).toBe('Hello')
    await browserService.close()
  })

  it('should handle empty text gracefully', async () => {
    const urlBuilder = new KagiUrlBuilder()
    const browserService = new KagiBrowserService()
    const options = getDefaultTranslationOptions()

    const url = urlBuilder.build('', options)
    expect(url).toContain('text=')

    await browserService.launch()
    mockPage.evaluate.mockResolvedValueOnce('')
    const result = await browserService.translate(url)
    expect(result).toBe('')
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
    mockPage.evaluate.mockResolvedValueOnce('Xin chào & "tạm biệt"! <test>')
    const result = await browserService.translate(url)
    expect(result).toBeTruthy()
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
    mockPage.evaluate.mockResolvedValueOnce('Xin chào, bạn khỏe không hôm nay?')
    const translated = await browserService.translate(url)

    // 5. Verify result
    expect(translated).toBe('Xin chào, bạn khỏe không hôm nay?')

    // 6. Cleanup (same as original browser.close)
    await browserService.close()

    // Verify all interactions happened
    expect(mockConnect).toHaveBeenCalled()
    expect(mockPage.goto).toHaveBeenCalled()
    expect(mockBrowser.close).toHaveBeenCalled()
  })
})
