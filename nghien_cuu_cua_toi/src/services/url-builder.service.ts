/**
 * URL Builder Service for Kagi Translate
 *
 * Implements IUrlBuilder interface (DIP)
 * Single Responsibility: Build and validate translation URLs
 */

import type { IUrlBuilder } from './interfaces/url-builder.interface'
import type { TranslationOptions } from '~/types'
import {
  READING_LEVELS,
  SPEAKER_GENDERS,
  ADDRESSEE_GENDERS,
  TRANSLATION_STYLES,
  FORMALITIES,
} from '~/types'
import { ValidationError } from '~/errors'
import { KAGI_TRANSLATE_BASE_URL } from '~/config'

/**
 * Validates enum value against allowed values
 * @throws {ValidationError} If value is not in allowedValues
 */
function validateEnum<T extends string>(
  value: T,
  allowedValues: readonly T[],
  paramName: string,
): void {
  if (!allowedValues.includes(value)) {
    throw new ValidationError(paramName, value, allowedValues as readonly string[])
  }
}

/**
 * Kagi URL Builder implementation
 *
 * Builds URLs with conditional parameters:
 * - Required: from, to, text
 * - Conditional: only include non-default values
 *
 * @example
 * const builder = new KagiUrlBuilder();
 * const url = builder.build('Hello', {
 *   sourceLang: 'auto',
 *   targetLang: 'vi',
 *   readingLevel: 'standard',
 *   speakerGender: 'unknown',
 *   addresseeGender: 'unknown',
 *   style: 'natural',
 *   formality: 'standard'
 * });
 * // Returns: "https://translate.kagi.com/?from=auto&to=vi&text=Hello"
 * // (No extra params because all are defaults)
 *
 * @example
 * const url = builder.build('Hello', {
 *   sourceLang: 'auto',
 *   targetLang: 'vi',
 *   readingLevel: 'c2',
 *   speakerGender: 'neutral',
 *   addresseeGender: 'feminine',
 *   style: 'literal',
 *   formality: 'vietnamese_casual'
 * });
 * // Returns: "https://translate.kagi.com/?from=auto&to=vi&text=Hello&language_complexity=c2&speaker_gender=neutral&addressee_gender=feminine&style=literal&formality=more&formality_context=vi_casual"
 */
export class KagiUrlBuilder implements IUrlBuilder {
  /**
   * Builds a complete Kagi Translate URL
   * @param text - Text to translate
   * @param options - Translation configuration
   * @returns Complete Kagi Translate URL with conditional parameters
   * @throws {ValidationError} If any enum value is invalid
   */
  build(text: string, options: TranslationOptions): string {
    // Validate all enum values (strict validation)
    validateEnum(options.readingLevel, READING_LEVELS, 'readingLevel')
    validateEnum(options.speakerGender, SPEAKER_GENDERS, 'speakerGender')
    validateEnum(options.addresseeGender, ADDRESSEE_GENDERS, 'addresseeGender')
    validateEnum(options.style, TRANSLATION_STYLES, 'style')
    validateEnum(options.formality, FORMALITIES, 'formality')

    const params = new URLSearchParams()

    // Required params (always sent)
    params.set('from', options.sourceLang)
    params.set('to', options.targetLang)
    params.set('text', text)

    // Conditional params (only sent if not default)

    // Reading Level: skip 'standard'
    if (options.readingLevel !== 'standard') {
      params.set('language_complexity', options.readingLevel)
    }

    // Speaker Gender: skip 'unknown'
    if (options.speakerGender !== 'unknown') {
      params.set('speaker_gender', options.speakerGender)
    }

    // Addressee Gender: skip 'unknown'
    if (options.addresseeGender !== 'unknown') {
      params.set('addressee_gender', options.addresseeGender)
    }

    // Style: skip 'natural'
    if (options.style !== 'natural') {
      params.set('style', options.style)
    }

    // Formality: Vietnamese-specific handling
    if (options.formality === 'vietnamese_formal') {
      params.set('formality', 'more')
      params.set('formality_context', 'vi_formal')
    } else if (options.formality === 'vietnamese_casual') {
      params.set('formality', 'more')
      params.set('formality_context', 'vi_casual')
    }
    // 'standard' formality: skip params

    return `${KAGI_TRANSLATE_BASE_URL}?${params.toString()}`
  }
}
