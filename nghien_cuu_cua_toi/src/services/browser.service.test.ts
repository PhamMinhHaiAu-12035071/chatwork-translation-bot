/**
 * Tests for Browser Service
 *
 * Note: These tests use mocks to avoid launching real browsers
 * Real browser tests are in tests/e2e/
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { KagiBrowserService } from './browser.service'
import { BrowserAutomationError } from '~/errors'

// Mock puppeteer-real-browser module
const mockPage = {
  goto: mock(async () => {}),
  waitForSelector: mock(async () => {}),
  evaluate: mock(async () => 'Xin chào'),
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
    mockPage.evaluate.mockClear()
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

    it('should wait for translation content selector', async () => {
      mockPage.waitForSelector.mockResolvedValueOnce(undefined)

      await service.translate('https://translate.kagi.com/?text=Hello')

      expect(mockPage.waitForSelector).toHaveBeenCalledWith(
        '.translation-content',
        expect.objectContaining({
          visible: true,
        }),
      )
    })

    it('should return translated text from page evaluation', async () => {
      mockPage.evaluate.mockResolvedValueOnce('Xin chào, bạn khỏe không?')

      const result = await service.translate('https://translate.kagi.com/?text=Hello')

      expect(result).toBe('Xin chào, bạn khỏe không?')
    })

    it('should handle waitForSelector timeout gracefully', async () => {
      mockPage.waitForSelector.mockRejectedValueOnce(new Error('Timeout'))
      mockPage.evaluate.mockResolvedValueOnce('Xin chào')

      const result = await service.translate('https://translate.kagi.com/?text=Hello')

      // Should still try to scrape content
      expect(result).toBe('Xin chào')
    })

    it('should throw BrowserAutomationError on navigation failure', async () => {
      mockPage.goto.mockRejectedValueOnce(new Error('Navigation timeout'))

      await expect(service.translate('https://translate.kagi.com/?text=Hello')).rejects.toThrow(
        BrowserAutomationError,
      )
    })

    it('should throw BrowserAutomationError on scraping failure', async () => {
      mockPage.evaluate.mockRejectedValueOnce(new Error('Evaluation failed'))

      await expect(service.translate('https://translate.kagi.com/?text=Hello')).rejects.toThrow(
        BrowserAutomationError,
      )
    })

    it('should handle different translated text results', async () => {
      const testCases = ['Xin chào', 'Tôi là một lập trình viên', 'こんにちは', '안녕하세요']

      for (const expected of testCases) {
        mockPage.evaluate.mockResolvedValueOnce(expected)
        const result = await service.translate('https://translate.kagi.com/?text=Test')
        expect(result).toBe(expected)
      }
    })
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
      mockPage.evaluate.mockResolvedValueOnce('Xin chào')

      await service.launch()
      const result = await service.translate(
        'https://translate.kagi.com/?from=auto&to=vi&text=Hello',
      )
      await service.close()

      expect(result).toBe('Xin chào')
      expect(mockConnect).toHaveBeenCalledTimes(1)
      expect(mockPage.goto).toHaveBeenCalledTimes(1)
      expect(mockBrowser.close).toHaveBeenCalledTimes(1)
    })

    it('should handle multiple translations in same session', async () => {
      mockPage.evaluate
        .mockResolvedValueOnce('Xin chào')
        .mockResolvedValueOnce('Tạm biệt')
        .mockResolvedValueOnce('Cảm ơn')

      await service.launch()

      const result1 = await service.translate('https://translate.kagi.com/?text=Hello')
      const result2 = await service.translate('https://translate.kagi.com/?text=Goodbye')
      const result3 = await service.translate('https://translate.kagi.com/?text=Thanks')

      await service.close()

      expect(result1).toBe('Xin chào')
      expect(result2).toBe('Tạm biệt')
      expect(result3).toBe('Cảm ơn')
      expect(mockPage.goto).toHaveBeenCalledTimes(3)
    })

    it('should require relaunch after close', async () => {
      await service.launch()
      await service.close()

      await expect(service.translate('https://example.com')).rejects.toThrow()

      // Relaunch and try again
      await service.launch()
      mockPage.evaluate.mockResolvedValueOnce('Xin chào')
      const result = await service.translate('https://translate.kagi.com/?text=Hello')

      expect(result).toBe('Xin chào')
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
