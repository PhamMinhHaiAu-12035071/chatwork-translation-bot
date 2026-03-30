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
   * @returns Translated text result
   * @throws {BrowserAutomationError} If navigation or scraping fails
   */
  translate(url: string): Promise<string>

  /**
   * Closes the current browser instance
   */
  close(): Promise<void>
}
