/**
 * Tests for Browser Service
 *
 * Note: These tests use mocks to avoid launching real browsers
 * Real browser tests are in tests/e2e/
 */

import { describe, it, expect, beforeEach, mock, setDefaultTimeout } from 'bun:test'

/** translate() includes POST_FORMALITY_CASUAL_SETTLE_MS (3s) plus many short gaps */
setDefaultTimeout(30_000)
import { KagiBrowserService } from './browser.service'
import { BrowserAutomationError } from '~/errors'
import { getDefaultTranslationOptions } from '~/config'

const MOCK_FINAL_URL = 'https://translate.kagi.com/?text=Hello&mockFinal=1'

// Mock puppeteer-real-browser module
const mockPage = {
  goto: mock(async () => {}),
  waitForSelector: mock(async () => {}),
  waitForFunction: mock(async () => {}),
  click: mock(async () => {}),
  focus: mock(async () => {}),
  evaluate: mock(async () => 'Xin chào'),
  url: mock(() => MOCK_FINAL_URL),
}

/**
 * Matches {@link KagiBrowserService.translate} evaluate sequence for `formality === 'standard'`:
 * speaker → addressee → reading level → style → stable-state clear → scrape.
 */
function queueEvaluateForOneTranslate(result: string) {
  mockPage.evaluate
    .mockResolvedValueOnce(true as never)
    .mockResolvedValueOnce(true as never)
    .mockResolvedValueOnce(true as never)
    .mockResolvedValueOnce(true as never)
    .mockResolvedValueOnce(undefined as never)
    .mockResolvedValueOnce(result)
}

/** Same + textarea fill before the four UI clicks */
function queueEvaluateForOneTranslateWithContext(result: string) {
  mockPage.evaluate
    .mockResolvedValueOnce(undefined as never)
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

// Override the puppeteer-real-browser import
mock.module('puppeteer-real-browser', () => ({
  connect: mockConnect,
}))

describe('KagiBrowserService', () => {
  let service: KagiBrowserService

  beforeEach(() => {
    service = new KagiBrowserService()
    // Reset mocks
    mockConnect.mockClear()
    mockPage.goto.mockClear()
    mockPage.waitForSelector.mockClear()
    mockPage.waitForFunction.mockClear()
    mockPage.click.mockClear()
    mockPage.focus.mockClear()
    mockPage.evaluate.mockClear()
    mockPage.url.mockClear()
    mockBrowser.close.mockClear()
  })

  describe('launch()', () => {
    it('should launch browser successfully', async () => {
      const connection = await service.launch()

      expect(connection).toBeDefined()
      expect(mockConnect).toHaveBeenCalledTimes(1)
    })

    it('should configure browser with correct options', async () => {
      await service.launch()

      expect(mockConnect).toHaveBeenCalledWith({
        headless: expect.any(Boolean),
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        customConfig: {},
        turnstile: true,
        connectOption: {},
        disableXvfb: false,
        ignoreAllFlags: false,
      })
    })

    it('should throw BrowserAutomationError if launch fails', async () => {
      mockConnect.mockRejectedValueOnce(new Error('Launch failed'))

      await expect(service.launch()).rejects.toThrow(BrowserAutomationError)
    })

    it('should return a connection with close method', async () => {
      const connection = await service.launch()

      expect(connection.close).toBeDefined()
      expect(typeof connection.close).toBe('function')
    })
  })

  describe('translate()', () => {
    beforeEach(async () => {
      await service.launch()
      mockPage.goto.mockClear() // Clear launch calls
    })

    it('should throw error if browser not launched', async () => {
      const freshService = new KagiBrowserService()

      await expect(freshService.translate('https://example.com')).rejects.toThrow(
        BrowserAutomationError,
      )
    })

    it('should navigate to the provided URL', async () => {
      const url = 'https://translate.kagi.com/?from=auto&to=vi&text=Hello'
      await service.translate(url)

      expect(mockPage.goto).toHaveBeenCalledWith(
        url,
        expect.objectContaining({
          waitUntil: 'networkidle2',
        }),
      )
    })

    it('should wait for Translation Settings control then translation content', async () => {
      const mockHandle = { click: mock(async () => {}) }
      mockPage.waitForSelector
        .mockResolvedValueOnce(mockHandle as never)
        .mockResolvedValueOnce(undefined)
      queueEvaluateForOneTranslate('Xin chào')

      await service.translate('https://translate.kagi.com/?text=Hello')

      expect(mockPage.waitForSelector).toHaveBeenCalledWith(
        'button[aria-label="Translation Settings"]',
        expect.objectContaining({
          visible: true,
        }),
      )
      expect(mockPage.waitForSelector).toHaveBeenCalledWith(
        '.translation-content',
        expect.objectContaining({
          visible: true,
        }),
      )
      expect(mockHandle.click).toHaveBeenCalledTimes(1)
    })

    it('should fill translation context when translationContext is non-empty', async () => {
      queueEvaluateForOneTranslateWithContext('Done')
      const options = getDefaultTranslationOptions()
      options.translationContext = 'Brief note for the translator'

      const result = await service.translate('https://translate.kagi.com/?text=Hello', options)

      expect(result.translated).toBe('Done')
      expect(result.finalUrl).toBe(MOCK_FINAL_URL)
      expect(mockPage.waitForSelector).toHaveBeenCalledWith(
        'textarea[placeholder*="Brief context for translation"]',
        expect.objectContaining({ visible: true }),
      )
      expect(mockPage.click).toHaveBeenCalledWith(
        'textarea[placeholder*="Brief context for translation"]',
      )
      expect(mockPage.focus).toHaveBeenCalledWith(
        'textarea[placeholder*="Brief context for translation"]',
      )
    })

    it('should map reading level enum to the matching slider step', async () => {
      const options = getDefaultTranslationOptions()
      options.readingLevel = 'c2'
      queueEvaluateForOneTranslate('Xin chào')

      await service.translate('https://translate.kagi.com/?text=Hello', options)

      expect(mockPage.evaluate).toHaveBeenCalledWith(
        expect.any(Function),
        'input[type="range"][aria-valuemin="0"][aria-valuemax="6"][step="1"]',
        6,
      )
    })

    it('should wait until the URL reflects the selected reading level', async () => {
      const options = getDefaultTranslationOptions()
      options.readingLevel = 'a1'
      queueEvaluateForOneTranslate('Xin chào')

      await service.translate('https://translate.kagi.com/?text=Hello', options)

      expect(mockPage.waitForFunction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          timeout: expect.any(Number),
        }),
        'input[type="range"][aria-valuemin="0"][aria-valuemax="6"][step="1"]',
        1,
        'language_complexity=a1',
      )
    })

    it('should return translated text from page evaluation', async () => {
      queueEvaluateForOneTranslate('Xin chào, bạn khỏe không?')

      const result = await service.translate('https://translate.kagi.com/?text=Hello')

      expect(result.translated).toBe('Xin chào, bạn khỏe không?')
      expect(result.finalUrl).toBe(MOCK_FINAL_URL)
    })

    it('should handle waitForSelector timeout gracefully', async () => {
      const mockHandle = { click: mock(async () => {}) }
      mockPage.waitForSelector
        .mockResolvedValueOnce(mockHandle as never)
        .mockRejectedValueOnce(new Error('Timeout'))
      mockPage.evaluate
        .mockResolvedValueOnce(true as never)
        .mockResolvedValueOnce(true as never)
        .mockResolvedValueOnce(true as never)
        .mockResolvedValueOnce(true as never)
        .mockResolvedValueOnce(undefined as never)
        .mockResolvedValueOnce('Xin chào')

      const result = await service.translate('https://translate.kagi.com/?text=Hello')

      // Should still try to scrape content
      expect(result.translated).toBe('Xin chào')
      expect(result.finalUrl).toBe(MOCK_FINAL_URL)
    })

    it('should throw BrowserAutomationError on navigation failure', async () => {
      mockPage.goto.mockRejectedValueOnce(new Error('Navigation timeout'))

      await expect(service.translate('https://translate.kagi.com/?text=Hello')).rejects.toThrow(
        BrowserAutomationError,
      )
    })

    it('should throw BrowserAutomationError on scraping failure', async () => {
      mockPage.evaluate
        .mockResolvedValueOnce(true as never)
        .mockResolvedValueOnce(true as never)
        .mockResolvedValueOnce(true as never)
        .mockResolvedValueOnce(true as never)
        .mockResolvedValueOnce(undefined as never)
        .mockRejectedValueOnce(new Error('Evaluation failed'))

      await expect(service.translate('https://translate.kagi.com/?text=Hello')).rejects.toThrow(
        BrowserAutomationError,
      )
    })

    it(
      'should handle different translated text results',
      async () => {
        const testCases = ['Xin chào', 'Tôi là một lập trình viên', 'こんにちは', '안녕하세요']

        for (const expected of testCases) {
          queueEvaluateForOneTranslate(expected)
          const result = await service.translate('https://translate.kagi.com/?text=Test')
          expect(result.translated).toBe(expected)
          expect(result.finalUrl).toBe(MOCK_FINAL_URL)
        }
      },
      { timeout: 90_000 },
    )
  })

  describe('close()', () => {
    it('should close browser connection', async () => {
      await service.launch()
      await service.close()

      expect(mockBrowser.close).toHaveBeenCalledTimes(1)
    })

    it('should handle close when no connection exists', async () => {
      // Should not throw error
      await service.close()
      expect(true).toBe(true) // If we reach here, no error was thrown
    })

    it('should allow multiple close calls', async () => {
      await service.launch()
      await service.close()
      await service.close()

      expect(mockBrowser.close).toHaveBeenCalledTimes(1) // Only once
    })

    it('should prevent translate after close', async () => {
      await service.launch()
      await service.close()

      await expect(service.translate('https://example.com')).rejects.toThrow(BrowserAutomationError)
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle full translation workflow', async () => {
      queueEvaluateForOneTranslate('Xin chào')

      await service.launch()
      const result = await service.translate(
        'https://translate.kagi.com/?from=auto&to=vi&text=Hello',
      )
      await service.close()

      expect(result.translated).toBe('Xin chào')
      expect(result.finalUrl).toBe(MOCK_FINAL_URL)
      expect(mockConnect).toHaveBeenCalledTimes(1)
      expect(mockPage.goto).toHaveBeenCalledTimes(1)
      expect(mockBrowser.close).toHaveBeenCalledTimes(1)
    })

    it(
      'should handle multiple translations in same session',
      async () => {
        queueEvaluateForOneTranslate('Xin chào')
        queueEvaluateForOneTranslate('Tạm biệt')
        queueEvaluateForOneTranslate('Cảm ơn')

        await service.launch()

        const result1 = await service.translate('https://translate.kagi.com/?text=Hello')
        const result2 = await service.translate('https://translate.kagi.com/?text=Goodbye')
        const result3 = await service.translate('https://translate.kagi.com/?text=Thanks')

        await service.close()

        expect(result1.translated).toBe('Xin chào')
        expect(result2.translated).toBe('Tạm biệt')
        expect(result3.translated).toBe('Cảm ơn')
        expect(result1.finalUrl).toBe(MOCK_FINAL_URL)
        expect(result2.finalUrl).toBe(MOCK_FINAL_URL)
        expect(result3.finalUrl).toBe(MOCK_FINAL_URL)
        expect(mockPage.goto).toHaveBeenCalledTimes(3)
      },
      { timeout: 50_000 },
    )

    it('should require relaunch after close', async () => {
      await service.launch()
      await service.close()

      await expect(service.translate('https://example.com')).rejects.toThrow()

      // Relaunch and try again
      await service.launch()
      queueEvaluateForOneTranslate('Xin chào')
      const result = await service.translate('https://translate.kagi.com/?text=Hello')

      expect(result.translated).toBe('Xin chào')
      expect(result.finalUrl).toBe(MOCK_FINAL_URL)
    })
  })

  describe('Error Context', () => {
    it('should include operation in BrowserAutomationError', async () => {
      mockConnect.mockRejectedValueOnce(new Error('Failed'))

      try {
        await service.launch()
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(BrowserAutomationError)
        expect((error as BrowserAutomationError).operation).toBe('launch')
      }
    })

    it('should include URL in translate BrowserAutomationError', async () => {
      await service.launch()
      mockPage.goto.mockRejectedValueOnce(new Error('Failed'))

      const testUrl = 'https://translate.kagi.com/?text=Test'

      try {
        await service.translate(testUrl)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(BrowserAutomationError)
        expect((error as BrowserAutomationError).context).toBe(testUrl)
      }
    })
  })
})
