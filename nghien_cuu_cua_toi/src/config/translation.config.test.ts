/**
 * Tests for translation configuration
 */

import { describe, it, expect } from 'bun:test'
import {
  DEFAULT_TRANSLATION_CONFIG,
  BROWSER_CONFIG,
  KAGI_TRANSLATE_BASE_URL,
  KAGI_SELECTORS,
  getDefaultTranslationOptions,
} from './translation.config'

describe('Translation Config', () => {
  describe('DEFAULT_TRANSLATION_CONFIG', () => {
    it('should have all required translation fields', () => {
      expect(DEFAULT_TRANSLATION_CONFIG.INPUT_TEXT).toBeDefined()
      expect(DEFAULT_TRANSLATION_CONFIG.SOURCE_LANG).toBeDefined()
      expect(DEFAULT_TRANSLATION_CONFIG.TARGET_LANG).toBeDefined()
      expect(DEFAULT_TRANSLATION_CONFIG.READING_LEVEL).toBeDefined()
      expect(DEFAULT_TRANSLATION_CONFIG.SPEAKER_GENDER).toBeDefined()
      expect(DEFAULT_TRANSLATION_CONFIG.ADDRESSEE_GENDER).toBeDefined()
      expect(DEFAULT_TRANSLATION_CONFIG.STYLE).toBeDefined()
      expect(DEFAULT_TRANSLATION_CONFIG.FORMALITY).toBeDefined()
    })

    it('should use strict defaults (no params sent)', () => {
      expect(DEFAULT_TRANSLATION_CONFIG.READING_LEVEL).toBe('standard')
      expect(DEFAULT_TRANSLATION_CONFIG.SPEAKER_GENDER).toBe('unknown')
      expect(DEFAULT_TRANSLATION_CONFIG.ADDRESSEE_GENDER).toBe('unknown')
      expect(DEFAULT_TRANSLATION_CONFIG.STYLE).toBe('natural')
      expect(DEFAULT_TRANSLATION_CONFIG.FORMALITY).toBe('standard')
    })

    it('should default to auto-detect source and Vietnamese target', () => {
      expect(DEFAULT_TRANSLATION_CONFIG.SOURCE_LANG).toBe('auto')
      expect(DEFAULT_TRANSLATION_CONFIG.TARGET_LANG).toBe('vi')
    })

    it('should have a default input text', () => {
      expect(DEFAULT_TRANSLATION_CONFIG.INPUT_TEXT).toBe('Hello, how are you today?')
    })
  })

  describe('BROWSER_CONFIG', () => {
    it('should have all browser configuration fields', () => {
      expect(BROWSER_CONFIG.HEADLESS).toBeDefined()
      expect(BROWSER_CONFIG.TIMEOUT).toBeDefined()
      expect(BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT).toBeDefined()
      expect(BROWSER_CONFIG.POST_RENDER_DELAY).toBeDefined()
    })

    it('should default to visible browser for debugging', () => {
      expect(BROWSER_CONFIG.HEADLESS).toBe(false)
    })

    it('should have reasonable timeout values', () => {
      expect(BROWSER_CONFIG.TIMEOUT).toBe(30000) // 30s
      expect(BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT).toBe(15000) // 15s
      expect(BROWSER_CONFIG.POST_RENDER_DELAY).toBe(1000) // 1s
    })

    it('should have timeout greater than wait timeout', () => {
      expect(BROWSER_CONFIG.TIMEOUT).toBeGreaterThan(BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT)
    })
  })

  describe('KAGI_TRANSLATE_BASE_URL', () => {
    it('should be a valid HTTPS URL', () => {
      expect(KAGI_TRANSLATE_BASE_URL).toMatch(/^https:\/\//)
    })

    it('should point to Kagi translate domain', () => {
      expect(KAGI_TRANSLATE_BASE_URL).toBe('https://translate.kagi.com/')
    })

    it('should end with trailing slash', () => {
      expect(KAGI_TRANSLATE_BASE_URL).toMatch(/\/$/)
    })
  })

  describe('KAGI_SELECTORS', () => {
    it('should have all required selectors', () => {
      expect(KAGI_SELECTORS.TRANSLATION_CONTENT).toBeDefined()
      expect(KAGI_SELECTORS.TEXT_SPAN).toBeDefined()
      expect(KAGI_SELECTORS.TEXTAREA_PLACEHOLDER).toBeDefined()
    })

    it('should have valid CSS selectors', () => {
      expect(KAGI_SELECTORS.TRANSLATION_CONTENT).toMatch(/^\./) // Class selector
      expect(KAGI_SELECTORS.TEXT_SPAN).toBeTruthy()
      expect(KAGI_SELECTORS.TEXTAREA_PLACEHOLDER).toMatch(/^textarea/) // Element selector
    })

    it('should be immutable (const)', () => {
      // TypeScript const assertion ensures immutability at compile time
      // This test verifies the structure
      expect(Object.isFrozen(KAGI_SELECTORS)).toBe(false) // const doesn't freeze, but TS prevents reassignment
      expect(typeof KAGI_SELECTORS).toBe('object')
    })
  })

  describe('getDefaultTranslationOptions()', () => {
    it('should return a complete TranslationOptions object', () => {
      const options = getDefaultTranslationOptions()

      expect(options).toHaveProperty('sourceLang')
      expect(options).toHaveProperty('targetLang')
      expect(options).toHaveProperty('readingLevel')
      expect(options).toHaveProperty('speakerGender')
      expect(options).toHaveProperty('addresseeGender')
      expect(options).toHaveProperty('style')
      expect(options).toHaveProperty('formality')
    })

    it('should return strict defaults matching DEFAULT_TRANSLATION_CONFIG', () => {
      const options = getDefaultTranslationOptions()

      expect(options.sourceLang).toBe(DEFAULT_TRANSLATION_CONFIG.SOURCE_LANG)
      expect(options.targetLang).toBe(DEFAULT_TRANSLATION_CONFIG.TARGET_LANG)
      expect(options.readingLevel).toBe(DEFAULT_TRANSLATION_CONFIG.READING_LEVEL)
      expect(options.speakerGender).toBe(DEFAULT_TRANSLATION_CONFIG.SPEAKER_GENDER)
      expect(options.addresseeGender).toBe(DEFAULT_TRANSLATION_CONFIG.ADDRESSEE_GENDER)
      expect(options.style).toBe(DEFAULT_TRANSLATION_CONFIG.STYLE)
      expect(options.formality).toBe(DEFAULT_TRANSLATION_CONFIG.FORMALITY)
    })

    it('should return a new object each time (not reference)', () => {
      const options1 = getDefaultTranslationOptions()
      const options2 = getDefaultTranslationOptions()

      expect(options1).not.toBe(options2) // Different references
      expect(options1).toEqual(options2) // But same values
    })

    it('should be mutable (can override values)', () => {
      const options = getDefaultTranslationOptions()
      options.readingLevel = 'c2'

      expect(options.readingLevel).toBe('c2')
      expect(DEFAULT_TRANSLATION_CONFIG.READING_LEVEL).toBe('standard') // Original unchanged
    })
  })

  describe('Config Integration', () => {
    it('should have consistent language codes between INPUT_TEXT and SOURCE_LANG', () => {
      // INPUT_TEXT is English, so 'auto' or 'en' makes sense
      const text = DEFAULT_TRANSLATION_CONFIG.INPUT_TEXT
      const sourceLang = DEFAULT_TRANSLATION_CONFIG.SOURCE_LANG

      expect(text).toMatch(/^[A-Za-z\s,?!]+$/) // English text
      expect(['auto', 'en']).toContain(sourceLang)
    })

    it('should have browser timeout sufficient for translation wait', () => {
      const totalWaitTime =
        BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT + BROWSER_CONFIG.POST_RENDER_DELAY
      expect(BROWSER_CONFIG.TIMEOUT).toBeGreaterThan(totalWaitTime)
    })
  })
})
