/**
 * Type definitions for Kagi Translation
 *
 * Extracted from index.ts as part of SOLID refactoring (SRP)
 */

/**
 * Reading level for translated text complexity
 * @remarks Only sent if not 'standard'
 * @example 'standard' // won't send language_complexity param
 * @example 'a1' // sends language_complexity=a1
 * @example 'c2' // sends language_complexity=c2
 */
export type ReadingLevel = 'standard' | 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2'

/**
 * Speaker gender for translation context
 * @remarks Only sent if not 'unknown'
 * @example 'unknown' // won't send speaker_gender param
 * @example 'neutral' // sends speaker_gender=neutral
 * @example 'feminine' // sends speaker_gender=feminine
 */
export type SpeakerGender = 'unknown' | 'neutral' | 'feminine'

/**
 * Addressee gender for translation context
 * @remarks Only sent if not 'unknown'
 * @example 'unknown' // won't send addressee_gender param
 * @example 'neutral' // sends addressee_gender=neutral
 * @example 'feminine' // sends addressee_gender=feminine
 */
export type AddresseeGender = 'unknown' | 'neutral' | 'feminine'

/**
 * Translation style approach
 * @remarks Only sent if not 'natural'
 * @example 'natural' // won't send style param
 * @example 'literal' // sends style=literal
 */
export type TranslationStyle = 'natural' | 'literal'

/**
 * Formality level for Vietnamese translations
 * @remarks Sends formality + formality_context params
 * @example 'standard' // won't send formality params
 * @example 'vietnamese_formal' // sends formality=more&formality_context=vi_formal
 * @example 'vietnamese_casual' // sends formality=less&formality_context=vi_casual
 */
export type Formality = 'standard' | 'vietnamese_formal' | 'vietnamese_casual'

/**
 * Complete translation configuration options
 */
export interface TranslationOptions {
  sourceLang: string
  targetLang: string
  readingLevel: ReadingLevel
  speakerGender: SpeakerGender
  addresseeGender: AddresseeGender
  style: TranslationStyle
  formality: Formality
  /**
   * Optional brief context for the Translation Settings textarea (Kagi UI).
   * @remarks At most 100 characters; longer input is truncated when filling the field.
   */
  translationContext?: string
}

/**
 * Allowed values for each enum type (for validation)
 */
export const READING_LEVELS = ['standard', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'] as const
export const SPEAKER_GENDERS = ['unknown', 'neutral', 'feminine'] as const
export const ADDRESSEE_GENDERS = ['unknown', 'neutral', 'feminine'] as const
export const TRANSLATION_STYLES = ['natural', 'literal'] as const
export const FORMALITIES = ['standard', 'vietnamese_formal', 'vietnamese_casual'] as const
