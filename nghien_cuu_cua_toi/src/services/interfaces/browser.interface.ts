/**
 * Interface for Browser Service (Dependency Inversion Principle)
 *
 * Abstracts the browser automation logic to enable:
 * - Easy testing with mocks
 * - Potential browser engine swapping
 * - Loose coupling between components
 */

/**
 * Browser connection result
 */
export interface IBrowserConnection {
  /**
   * Closes the browser connection
   */
  close(): Promise<void>
}

import type { TranslationOptions } from '~/types'

/**
 * Result of a completed {@link IBrowserService.translate} run (before {@link IBrowserService.close}).
 */
export interface TranslateResult {
  /** Scraped translation text from the output pane */
  translated: string
  /** Full address bar URL after navigation + UI sync, captured when translation is ready */
  finalUrl: string
}

/**
 * Browser Service interface for automation
 */
export interface IBrowserService {
  /**
   * Launches a browser instance with specified configuration
   * @returns Browser connection handle
   * @throws {BrowserAutomationError} If browser fails to launch
   */
  launch(): Promise<IBrowserConnection>

  /**
   * Navigates to a URL and extracts translated text
   * @param url - Complete translation service URL
   * @param options - Translation settings applied through the Kagi UI
   * @returns Translated text result
   * @throws {BrowserAutomationError} If navigation or scraping fails
   */
  translate(url: string, options?: TranslationOptions): Promise<TranslateResult>

  /**
   * Closes the current browser instance
   */
  close(): Promise<void>
}
