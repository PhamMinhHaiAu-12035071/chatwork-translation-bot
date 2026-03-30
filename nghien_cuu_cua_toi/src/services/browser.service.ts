/**
 * Browser Service for Kagi Translate automation
 *
 * Implements IBrowserService interface (DIP)
 * Single Responsibility: Browser automation and content scraping
 */

import { connect } from 'puppeteer-real-browser'
import type { Browser, Page } from 'puppeteer-core'
import type { IBrowserService, IBrowserConnection } from './interfaces/browser.interface'
import { BrowserAutomationError } from '~/errors'
import { BROWSER_CONFIG, KAGI_SELECTORS } from '~/config'

/**
 * Browser connection wrapper
 * @remarks Uses Puppeteer core types for type safety
 */
class BrowserConnection implements IBrowserConnection {
  constructor(
    private browser: Browser,
    private page: Page,
  ) {}

  async close(): Promise<void> {
    await this.browser.close()
  }

  getBrowser(): Browser {
    return this.browser
  }

  getPage(): Page {
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
      const headless: boolean = BROWSER_CONFIG.HEADLESS
      const { browser, page } = (await connect({
        headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        customConfig: {},
        turnstile: true,
        connectOption: {},
        disableXvfb: false,
        ignoreAllFlags: false,
      })) as unknown as { browser: Browser; page: Page }

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

    const page: Page = this.connection.getPage()

    try {
      // Extract config constants with explicit types
      const timeout: number = BROWSER_CONFIG.TIMEOUT
      const selectorTimeout: number = BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT
      const renderDelay: number = BROWSER_CONFIG.POST_RENDER_DELAY
      const translationSelector: string = KAGI_SELECTORS.TRANSLATION_CONTENT

      // Navigate to Kagi Translate
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout,
      })

      // Wait for translation content to appear (with timeout)
      try {
        await page.waitForSelector(translationSelector, {
          timeout: selectorTimeout,
          visible: true,
        })

        // Wait for content to fully render
        await new Promise<void>((resolve) => setTimeout(resolve, renderDelay))
      } catch {
        // Selector timeout - will try fallback scraping
        console.warn(
          `⚠️  Timeout waiting for ${translationSelector} - trying fallback selectors...`,
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
  private async scrapeTranslatedText(page: Page): Promise<string> {
    // Create typed copy for evaluate context (ESLint strict mode)
    interface Selectors {
      TRANSLATION_CONTENT: string
      TEXT_SPAN: string
      TEXTAREA_PLACEHOLDER: string
    }

    const selectors: Selectors = {
      TRANSLATION_CONTENT: KAGI_SELECTORS.TRANSLATION_CONTENT,
      TEXT_SPAN: KAGI_SELECTORS.TEXT_SPAN,
      TEXTAREA_PLACEHOLDER: KAGI_SELECTORS.TEXTAREA_PLACEHOLDER,
    }

    const result = await page.evaluate((sels: Selectors) => {
      // Strategy 1: Primary selector (.translation-content > span)
      const translationContent = document.querySelector(sels.TRANSLATION_CONTENT)
      if (translationContent !== null) {
        const textSpan = translationContent.querySelector(sels.TEXT_SPAN)
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
      const outputArea = document.querySelector<HTMLTextAreaElement>(sels.TEXTAREA_PLACEHOLDER)
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
    }, selectors)

    return result
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
