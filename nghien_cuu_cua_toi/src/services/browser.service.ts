/**
 * Browser Service for Kagi Translate automation
 *
 * Implements IBrowserService interface (DIP)
 * Single Responsibility: Browser automation and content scraping
 */

import { connect } from 'puppeteer-real-browser'
import type { IBrowserService, IBrowserConnection } from './interfaces/browser.interface'
import { BrowserAutomationError } from '~/errors'
import { BROWSER_CONFIG, KAGI_SELECTORS } from '~/config'

/**
 * Browser connection wrapper
 */
class BrowserConnection implements IBrowserConnection {
  constructor(
    private browser: any, // puppeteer-real-browser uses rebrowser types
    private page: any,
  ) {}

  async close(): Promise<void> {
    await this.browser.close()
  }

  getBrowser(): any {
    return this.browser
  }

  getPage(): any {
    return this.page
  }
}

/**
 * Kagi Browser Service implementation using Puppeteer Real Browser
 *
 * Handles:
 * - Browser launch with anti-detection
 * - Navigation to Kagi Translate
 * - Content scraping with fallback selectors
 * - Cleanup and error handling
 *
 * @example
 * const service = new KagiBrowserService();
 * await service.launch();
 * const result = await service.translate(url);
 * await service.close();
 */
export class KagiBrowserService implements IBrowserService {
  private connection: BrowserConnection | null = null

  /**
   * Launches a Puppeteer Real Browser instance
   * @returns Browser connection handle
   * @throws {BrowserAutomationError} If browser fails to launch
   */
  async launch(): Promise<IBrowserConnection> {
    try {
      const { browser, page } = await connect({
        headless: BROWSER_CONFIG.HEADLESS,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        customConfig: {},
        turnstile: true,
        connectOption: {},
        disableXvfb: false,
        ignoreAllFlags: false,
      })

      this.connection = new BrowserConnection(browser, page)
      return this.connection
    } catch (error) {
      throw new BrowserAutomationError(
        'launch',
        'puppeteer-real-browser',
        error instanceof Error ? error : undefined,
      )
    }
  }

  /**
   * Navigates to Kagi Translate URL and extracts translated text
   * @param url - Complete Kagi Translate URL with parameters
   * @returns Translated text
   * @throws {BrowserAutomationError} If navigation or scraping fails
   */
  async translate(url: string): Promise<string> {
    if (!this.connection) {
      throw new BrowserAutomationError(
        'translate',
        'No active browser connection. Call launch() first.',
        undefined,
      )
    }

    const page = this.connection.getPage()

    try {
      // Navigate to Kagi Translate
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: BROWSER_CONFIG.TIMEOUT,
      })

      // Wait for translation content to appear (with timeout)
      try {
        await page.waitForSelector(KAGI_SELECTORS.TRANSLATION_CONTENT, {
          timeout: BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT,
          visible: true,
        })

        // Wait for content to fully render
        await new Promise((resolve) => setTimeout(resolve, BROWSER_CONFIG.POST_RENDER_DELAY))
      } catch {
        // Selector timeout - will try fallback scraping
        console.warn(
          `⚠️  Timeout waiting for ${KAGI_SELECTORS.TRANSLATION_CONTENT} - trying fallback selectors...`,
        )
      }

      // Scrape translated text with fallback strategy
      const translated = await this.scrapeTranslatedText(page)

      return translated
    } catch (error) {
      throw new BrowserAutomationError('translate', url, error instanceof Error ? error : undefined)
    }
  }

  /**
   * Scrapes translated text from Kagi page with multiple fallback strategies
   * @param page - Puppeteer page instance
   * @returns Translated text or error message
   */
  private async scrapeTranslatedText(page: any): Promise<string> {
    return await page.evaluate((selectors: typeof KAGI_SELECTORS) => {
      // Strategy 1: Primary selector (.translation-content > span)
      const translationContent = document.querySelector(selectors.TRANSLATION_CONTENT)
      if (translationContent !== null) {
        const textSpan = translationContent.querySelector(selectors.TEXT_SPAN)
        if (textSpan !== null) {
          const text = textSpan.textContent
          if (text && text.trim() !== '') {
            return text.trim()
          }
        }

        // Strategy 2: Full text in .translation-content
        const fullText = translationContent.textContent
        if (fullText && fullText.trim() !== '') {
          return fullText.trim()
        }
      }

      // Strategy 3: Textarea with placeholder
      const outputArea = document.querySelector<HTMLTextAreaElement>(selectors.TEXTAREA_PLACEHOLDER)
      if (outputArea?.value) {
        return outputArea.value
      }

      // Strategy 4: Second textarea (older implementation)
      const allTextareas = document.querySelectorAll('textarea')
      if (allTextareas.length >= 2) {
        const secondTextarea = allTextareas.item(1)
        if (secondTextarea.value !== '') {
          return secondTextarea.value
        }
      }

      return '[No translation result found - please check DOM structure]'
    }, KAGI_SELECTORS)
  }

  /**
   * Closes the browser instance
   */
  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close()
      this.connection = null
    }
  }
}
