/**
 * Interface for URL Builder (Dependency Inversion Principle)
 *
 * Abstracts the URL building logic to enable:
 * - Easy testing with mocks
 * - Future provider support (if needed)
 * - Loose coupling between services
 */

import type { TranslationOptions } from '~/types'

/**
 * URL Builder interface for translation services
 */
export interface IUrlBuilder {
  /**
   * Builds a complete translation URL from text and options
   * @param text - Text to translate
   * @param options - Translation configuration
   * @returns Complete translation service URL
   * @throws {ValidationError} If any option value is invalid
   */
  build(text: string, options: TranslationOptions): string
}
