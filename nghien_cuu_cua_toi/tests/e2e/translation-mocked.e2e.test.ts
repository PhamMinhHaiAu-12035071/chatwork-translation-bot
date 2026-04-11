/**
 * E2E Tests - Mocked Kagi Responses
 *
 * Comprehensive pairwise testing (~30-40 scenarios)
 * No rate limiting needed (all mocked)
 * Faster execution, no real API calls
 *
 * Run: bun test tests/e2e/translation-mocked.e2e.test.ts
 */

import { describe, it, expect, beforeEach, mock, setDefaultTimeout } from 'bun:test'

setDefaultTimeout(30_000)
import { KagiUrlBuilder, KagiBrowserService } from '~/services'
import { getDefaultTranslationOptions } from '~/config'
import type { TranslationOptions } from '~/types'

const MOCK_FINAL_URL = 'https://translate.kagi.com/?mockFinal=1'

// Mock puppeteer-real-browser
const mockPage = {
  goto: mock(async () => {}),
  waitForSelector: mock(async () => {}),
  waitForFunction: mock(async () => {}),
  click: mock(async () => {}),
  focus: mock(async () => {}),
  evaluate: mock(async () => 'Mocked translation'),
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

function queueEvaluateForOneTranslateWithFormalitySwitch(
  result: string,
  textBeforeSwitch = '__prior_translation__',
) {
  mockPage.evaluate
    .mockResolvedValueOnce(true as never)
    .mockResolvedValueOnce(true as never)
    .mockResolvedValueOnce(true as never)
    .mockResolvedValueOnce(true as never)
    .mockResolvedValueOnce(undefined as never)
    .mockResolvedValueOnce(textBeforeSwitch as never)
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

describe('E2E Mocked: Pairwise Translation Scenarios', () => {
  let urlBuilder: KagiUrlBuilder
  let browserService: KagiBrowserService

  beforeEach(async () => {
    urlBuilder = new KagiUrlBuilder()
    browserService = new KagiBrowserService()
    await browserService.launch()

    // Reset mocks
    mockPage.goto.mockClear()
    mockPage.waitForSelector.mockClear()
    mockPage.waitForFunction.mockClear()
    mockPage.click.mockClear()
    mockPage.focus.mockClear()
    mockPage.evaluate.mockClear()
  })

  describe('Boundary Tests (Defaults vs Extremes)', () => {
    it('should handle all defaults (minimal URL)', async () => {
      const options = getDefaultTranslationOptions()
      queueEvaluateForOneTranslate('Xin chào')

      const url = urlBuilder.build('Hello', options)
      const result = await browserService.translate(url, options)

      expect(url).not.toContain('language_complexity')
      expect(url).not.toContain('formality')
      expect(result.translated).toBe('Xin chào')
    })

    it('should handle all extremes (maximum URL)', async () => {
      const options = getDefaultTranslationOptions()
      options.readingLevel = 'c2'
      options.speakerGender = 'feminine'
      options.addresseeGender = 'feminine'
      options.style = 'literal'
      options.formality = 'vietnamese_formal'

      queueEvaluateForOneTranslateWithFormalitySwitch('Formal advanced translation')

      const url = urlBuilder.build('Complex text', options)
      const result = await browserService.translate(url, options)

      expect(url).not.toContain('language_complexity')
      expect(url).toContain('speaker_gender=feminine')
      expect(url).toContain('addressee_gender=feminine')
      expect(url).toContain('style=literal')
      expect(url).toContain('formality=more')
      expect(result.translated).toBe('Formal advanced translation')
    })
  })

  describe('Reading Level Combinations', () => {
    const testReadingLevel = async (
      level: 'standard' | 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2',
      expectedTranslation: string,
    ) => {
      const options = getDefaultTranslationOptions()
      options.readingLevel = level

      queueEvaluateForOneTranslate(expectedTranslation)

      const url = urlBuilder.build('Test', options)
      const result = await browserService.translate(url, options)

      expect(url).not.toContain('language_complexity')
      expect(result.translated).toBe(expectedTranslation)
    }

    it('should handle reading level: standard', async () => {
      await testReadingLevel('standard', 'Kiểm tra')
    })

    it('should handle reading level: a1 (beginner)', async () => {
      await testReadingLevel('a1', 'Test (simple)')
    })

    it('should handle reading level: a2', async () => {
      await testReadingLevel('a2', 'Test (basic)')
    })

    it('should handle reading level: b1', async () => {
      await testReadingLevel('b1', 'Test (intermediate)')
    })

    it('should handle reading level: b2', async () => {
      await testReadingLevel('b2', 'Test (upper intermediate)')
    })

    it('should handle reading level: c1', async () => {
      await testReadingLevel('c1', 'Test (advanced)')
    })

    it('should handle reading level: c2 (expert)', async () => {
      await testReadingLevel('c2', 'Test (proficient)')
    })
  })

  describe('Vietnamese Formality Combinations', () => {
    it('should handle vietnamese_formal + standard reading', async () => {
      const options = getDefaultTranslationOptions()
      options.formality = 'vietnamese_formal'

      queueEvaluateForOneTranslateWithFormalitySwitch('Xin chào quý khách')

      const url = urlBuilder.build('Hello', options)
      const result = await browserService.translate(url, options)

      expect(url).toContain('formality=more')
      expect(url).toContain('formality_context=vi_formal')
      expect(result.translated).toBe('Xin chào quý khách')
    })

    it('should handle vietnamese_casual + standard reading', async () => {
      const options = getDefaultTranslationOptions()
      options.formality = 'vietnamese_casual'

      queueEvaluateForOneTranslateWithFormalitySwitch('Chào bạn')

      const url = urlBuilder.build('Hello', options)
      const result = await browserService.translate(url, options)

      expect(url).toContain('formality=less')
      expect(url).toContain('formality_context=vi_casual')
      expect(result.translated).toBe('Chào bạn')
    })

    it('should handle vietnamese_formal + c2 reading', async () => {
      const options = getDefaultTranslationOptions()
      options.formality = 'vietnamese_formal'
      options.readingLevel = 'c2'

      queueEvaluateForOneTranslateWithFormalitySwitch('Kính chào quý vị')

      const url = urlBuilder.build('Hello', options)
      const result = await browserService.translate(url, options)

      expect(url).not.toContain('language_complexity')
      expect(url).toContain('formality_context=vi_formal')
      expect(result.translated).toBe('Kính chào quý vị')
    })

    it('should handle vietnamese_casual + a1 reading', async () => {
      const options = getDefaultTranslationOptions()
      options.formality = 'vietnamese_casual'
      options.readingLevel = 'a1'

      queueEvaluateForOneTranslateWithFormalitySwitch('Chào')

      const url = urlBuilder.build('Hello', options)
      const result = await browserService.translate(url, options)

      expect(url).not.toContain('language_complexity')
      expect(url).toContain('formality_context=vi_casual')
      expect(result.translated).toBe('Chào')
    })
  })

  describe('Gender Combinations', () => {
    it('should handle neutral speaker + unknown addressee', async () => {
      const options = getDefaultTranslationOptions()
      options.speakerGender = 'neutral'

      queueEvaluateForOneTranslate('Translation with neutral speaker')

      const url = urlBuilder.build('Test', options)
      await browserService.translate(url, options)

      expect(url).toContain('speaker_gender=neutral')
      expect(url).not.toContain('addressee_gender')
    })

    it('should handle feminine speaker + feminine addressee', async () => {
      const options = getDefaultTranslationOptions()
      options.speakerGender = 'feminine'
      options.addresseeGender = 'feminine'

      queueEvaluateForOneTranslate('Translation feminine to feminine')

      const url = urlBuilder.build('Test', options)
      await browserService.translate(url, options)

      expect(url).toContain('speaker_gender=feminine')
      expect(url).toContain('addressee_gender=feminine')
    })

    it('should handle neutral speaker + feminine addressee', async () => {
      const options = getDefaultTranslationOptions()
      options.speakerGender = 'neutral'
      options.addresseeGender = 'feminine'

      queueEvaluateForOneTranslate('Translation neutral to feminine')

      const url = urlBuilder.build('Test', options)
      await browserService.translate(url, options)

      expect(url).toContain('speaker_gender=neutral')
      expect(url).toContain('addressee_gender=feminine')
    })
  })

  describe('Style Combinations', () => {
    it('should handle literal style + c2 reading', async () => {
      const options = getDefaultTranslationOptions()
      options.style = 'literal'
      options.readingLevel = 'c2'

      queueEvaluateForOneTranslate('Word-by-word advanced translation')

      const url = urlBuilder.build('Test', options)
      await browserService.translate(url, options)

      expect(url).toContain('style=literal')
      expect(url).not.toContain('language_complexity')
    })

    it('should handle literal style + vietnamese_formal', async () => {
      const options = getDefaultTranslationOptions()
      options.style = 'literal'
      options.formality = 'vietnamese_formal'

      queueEvaluateForOneTranslateWithFormalitySwitch('Literal formal translation')

      const url = urlBuilder.build('Test', options)
      await browserService.translate(url, options)

      expect(url).toContain('style=literal')
      expect(url).toContain('formality_context=vi_formal')
    })
  })

  describe('Critical Pairwise Combinations', () => {
    it('should handle combo: b1 + neutral genders + vietnamese_casual', async () => {
      const options: TranslationOptions = {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'b1',
        speakerGender: 'neutral',
        addresseeGender: 'neutral',
        style: 'natural',
        formality: 'vietnamese_casual',
      }

      queueEvaluateForOneTranslateWithFormalitySwitch('Casual intermediate translation')

      const url = urlBuilder.build('Test', options)
      const result = await browserService.translate(url, options)

      expect(url).not.toContain('language_complexity')
      expect(url).toContain('speaker_gender=neutral')
      expect(url).toContain('addressee_gender=neutral')
      expect(url).toContain('formality_context=vi_casual')
      expect(result.translated).toBe('Casual intermediate translation')
    })

    it('should handle combo: c1 + feminine + vietnamese_formal + literal', async () => {
      const options: TranslationOptions = {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'c1',
        speakerGender: 'feminine',
        addresseeGender: 'feminine',
        style: 'literal',
        formality: 'vietnamese_formal',
      }

      queueEvaluateForOneTranslateWithFormalitySwitch(
        'Formal literal advanced feminine translation',
      )

      const url = urlBuilder.build('Test', options)
      const result = await browserService.translate(url, options)

      expect(url).not.toContain('language_complexity')
      expect(url).toContain('speaker_gender=feminine')
      expect(url).toContain('addressee_gender=feminine')
      expect(url).toContain('style=literal')
      expect(url).toContain('formality_context=vi_formal')
      expect(result.translated).toBe('Formal literal advanced feminine translation')
    })

    it('should handle combo: a2 + neutral speaker + vietnamese_casual', async () => {
      const options: TranslationOptions = {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'a2',
        speakerGender: 'neutral',
        addresseeGender: 'unknown',
        style: 'natural',
        formality: 'vietnamese_casual',
      }

      queueEvaluateForOneTranslateWithFormalitySwitch('Simple casual translation')

      const url = urlBuilder.build('Test', options)
      const result = await browserService.translate(url, options)

      expect(url).not.toContain('language_complexity')
      expect(url).toContain('speaker_gender=neutral')
      expect(url).toContain('formality_context=vi_casual')
      expect(result.translated).toBe('Simple casual translation')
    })
  })

  describe('Language Direction Variations', () => {
    it('should handle English to Vietnamese', async () => {
      const options = getDefaultTranslationOptions()
      options.sourceLang = 'en'
      options.targetLang = 'vi'

      queueEvaluateForOneTranslate('Xin chào')

      const url = urlBuilder.build('Hello', options)
      const result = await browserService.translate(url, options)

      expect(url).toContain('from=en')
      expect(url).toContain('to=vi')
      expect(result.translated).toBe('Xin chào')
    })

    it('should handle Vietnamese to English', async () => {
      const options = getDefaultTranslationOptions()
      options.sourceLang = 'vi'
      options.targetLang = 'en'

      queueEvaluateForOneTranslate('Hello')

      const url = urlBuilder.build('Xin chào', options)
      const result = await browserService.translate(url, options)

      expect(url).toContain('from=vi')
      expect(url).toContain('to=en')
      expect(result.translated).toBe('Hello')
    })

    it('should handle Japanese to Vietnamese', async () => {
      const options = getDefaultTranslationOptions()
      options.sourceLang = 'ja'
      options.targetLang = 'vi'

      queueEvaluateForOneTranslate('Xin chào')

      const url = urlBuilder.build('こんにちは', options)
      const result = await browserService.translate(url, options)

      expect(url).toContain('from=ja')
      expect(url).toContain('to=vi')
      expect(result.translated).toBe('Xin chào')
    })
  })

  describe('Text Variations', () => {
    it('should handle short text', async () => {
      const options = getDefaultTranslationOptions()
      queueEvaluateForOneTranslate('OK')

      const result = await browserService.translate(urlBuilder.build('OK', options))

      expect(result.translated).toBe('OK')
    })

    it('should handle medium text', async () => {
      const options = getDefaultTranslationOptions()
      queueEvaluateForOneTranslate('Đây là một bản dịch văn bản trung bình với nhiều từ hơn.')

      const result = await browserService.translate(
        urlBuilder.build('This is a medium text translation with more words.', options),
      )

      expect(result.translated).toBeTruthy()
    })

    it('should handle long text', async () => {
      const options = getDefaultTranslationOptions()
      const longText = 'This is a very long text. '.repeat(50)
      queueEvaluateForOneTranslate('Đây là văn bản rất dài... (repeated)')

      const result = await browserService.translate(urlBuilder.build(longText, options))

      expect(result.translated).toBeTruthy()
    })

    it('should handle text with punctuation', async () => {
      const options = getDefaultTranslationOptions()
      queueEvaluateForOneTranslate('Xin chào! Bạn khỏe không?')

      const result = await browserService.translate(
        urlBuilder.build('Hello! How are you?', options),
      )

      expect(result.translated).toBe('Xin chào! Bạn khỏe không?')
    })

    it('should handle text with special characters', async () => {
      const options = getDefaultTranslationOptions()
      queueEvaluateForOneTranslate('Xin chào & tạm biệt')

      const result = await browserService.translate(urlBuilder.build('Hello & goodbye', options))

      expect(result.translated).toBe('Xin chào & tạm biệt')
    })

    it('should handle Unicode characters', async () => {
      const options = getDefaultTranslationOptions()
      queueEvaluateForOneTranslate('Xin chào 你好 こんにちは')

      const result = await browserService.translate(
        urlBuilder.build('Hello 你好 こんにちは', options),
      )

      expect(result.translated).toBe('Xin chào 你好 こんにちは')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty result gracefully', async () => {
      const options = getDefaultTranslationOptions()
      queueEvaluateForOneTranslate('')

      const result = await browserService.translate(urlBuilder.build('Test', options))

      expect(result.translated).toBe('')
    })

    it('should handle whitespace text', async () => {
      const options = getDefaultTranslationOptions()
      queueEvaluateForOneTranslate('')

      const result = await browserService.translate(urlBuilder.build('   ', options))

      expect(result.translated).toBe('')
    })
  })
})

/**
 * Test Coverage Summary:
 * - Boundary tests: 2
 * - Reading levels: 7
 * - Formality combinations: 4
 * - Gender combinations: 3
 * - Style combinations: 2
 * - Critical pairwise: 3
 * - Language directions: 3
 * - Text variations: 6
 * - Edge cases: 2
 *
 * Total: 32 mocked e2e tests
 *
 * These tests provide comprehensive coverage without hitting real Kagi API
 * Run fast, no rate limiting needed
 */
