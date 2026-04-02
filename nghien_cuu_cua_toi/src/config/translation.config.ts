/**
 * Translation configuration constants
 *
 * Extracted from index.ts as part of SOLID refactoring (SRP)
 * All configuration values centralized here for easy modification
 */

import type {
  ReadingLevel,
  SpeakerGender,
  AddresseeGender,
  TranslationStyle,
  Formality,
  TranslationOptions,
} from '~/types'

/**
 * Default translation configuration
 * @remarks Uses strict defaults (no extra params sent to Kagi)
 */
export const DEFAULT_TRANSLATION_CONFIG = {
  INPUT_TEXT: 'Hello, how are you today?',
  SOURCE_LANG: 'auto',
  TARGET_LANG: 'vi',
  READING_LEVEL: 'standard' as ReadingLevel,
  SPEAKER_GENDER: 'unknown' as SpeakerGender,
  ADDRESSEE_GENDER: 'unknown' as AddresseeGender,
  STYLE: 'natural' as TranslationStyle,
  FORMALITY: 'standard' as Formality,
} as const

/**
 * Browser runtime settings
 */
export const BROWSER_CONFIG = {
  HEADLESS: false, // false = show browser (debug), true = hide (production)
  TIMEOUT: 30000, // Timeout in milliseconds
  WAIT_FOR_SELECTOR_TIMEOUT: 15000, // Wait for translation content timeout
  POST_RENDER_DELAY: 1000, // Delay after content render for stability
} as const

/**
 * Kagi Translate URL base
 */
export const KAGI_TRANSLATE_BASE_URL = 'https://translate.kagi.com/'

/**
 * CSS selectors for scraping Kagi Translate results
 */
export const KAGI_SELECTORS = {
  TRANSLATION_CONTENT: '.translation-content',
  TEXT_SPAN: '.font-universal, .text-direction-auto, span[dir]',
  TEXTAREA_PLACEHOLDER:
    'textarea[placeholder*="translation"], textarea[placeholder*="Translation"]',
} as const

/**
 * Builds a complete TranslationOptions object from config constants
 * @returns TranslationOptions with default values
 */
export function getDefaultTranslationOptions(): TranslationOptions {
  return {
    sourceLang: DEFAULT_TRANSLATION_CONFIG.SOURCE_LANG,
    targetLang: DEFAULT_TRANSLATION_CONFIG.TARGET_LANG,
    readingLevel: DEFAULT_TRANSLATION_CONFIG.READING_LEVEL,
    speakerGender: DEFAULT_TRANSLATION_CONFIG.SPEAKER_GENDER,
    addresseeGender: DEFAULT_TRANSLATION_CONFIG.ADDRESSEE_GENDER,
    style: DEFAULT_TRANSLATION_CONFIG.STYLE,
    formality: DEFAULT_TRANSLATION_CONFIG.FORMALITY,
  }
}
