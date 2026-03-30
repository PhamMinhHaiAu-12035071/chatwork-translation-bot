/**
 * Custom error class for browser automation failures
 *
 * Part of Clean Code refactor - meaningful error types instead of generic Error
 */

/**
 * Browser automation error with operation context
 * @example
 * throw new BrowserAutomationError('navigate', 'https://example.com', new Error('Timeout'));
 * // Error: Browser operation failed: navigate to https://example.com
 */
export class BrowserAutomationError extends Error {
  constructor(
    public readonly operation: string,
    public readonly context: string,
    public readonly cause?: Error,
  ) {
    const message = `Browser operation failed: ${operation} to ${context}`
    super(message)
    this.name = 'BrowserAutomationError'

    // Maintains proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BrowserAutomationError)
    }
  }
}
