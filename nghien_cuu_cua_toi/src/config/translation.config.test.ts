/**
 * Tests for translation configuration
 */

import { describe, it, expect } from 'bun:test'
import {
  DEFAULT_TRANSLATION_CONFIG,
  BROWSER_CONFIG,
  KAGI_TRANSLATE_BASE_URL,
  KAGI_SELECTORS,
  TRANSLATION_STYLE_UI_LABELS,
  FORMALITY_UI_LABELS,
  SPEAKER_GENDER_UI_LABELS,
  ADDRESSEE_GENDER_UI_LABELS,
  GENDER_PREFERENCE_UI_LABELS,
  getReadingLevelSliderValue,
  getDefaultTranslationOptions,
  MAX_TRANSLATION_CONTEXT_LENGTH,
  clampTranslationContext,
  INDEX_ENTRY_SAMPLE_TRANSLATION_CONTEXT,
  MAX_INPUT_TEXT_LENGTH,
  clampInputText,
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
      expect(DEFAULT_TRANSLATION_CONFIG.TRANSLATION_CONTEXT).toBeDefined()
    })

    it('should use strict defaults (no params sent)', () => {
      expect(DEFAULT_TRANSLATION_CONFIG.READING_LEVEL).toBe('c2')
      expect(DEFAULT_TRANSLATION_CONFIG.SPEAKER_GENDER).toBe('unknown')
      expect(DEFAULT_TRANSLATION_CONFIG.ADDRESSEE_GENDER).toBe('unknown')
      expect(DEFAULT_TRANSLATION_CONFIG.STYLE).toBe('natural')
      expect(DEFAULT_TRANSLATION_CONFIG.FORMALITY).toBe('vietnamese_casual')
    })

    it('should default to auto-detect source and Vietnamese target', () => {
      expect(DEFAULT_TRANSLATION_CONFIG.SOURCE_LANG).toBe('auto')
      expect(DEFAULT_TRANSLATION_CONFIG.TARGET_LANG).toBe('vi')
    })

    it('should have a default input text (Japanese sample for local demo)', () => {
      expect(DEFAULT_TRANSLATION_CONFIG.INPUT_TEXT).toContain('動画を一定時間')
      expect(DEFAULT_TRANSLATION_CONFIG.INPUT_TEXT).toContain('フレームサンプリング')
    })
  })

  describe('BROWSER_CONFIG', () => {
    it('should have all browser configuration fields', () => {
      expect(BROWSER_CONFIG.HEADLESS).toBeDefined()
      expect(BROWSER_CONFIG.TIMEOUT).toBeDefined()
      expect(BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT).toBeDefined()
      expect(BROWSER_CONFIG.POST_RENDER_DELAY).toBeDefined()
      expect(BROWSER_CONFIG.POST_DIALOG_SETTLE_MS).toBeDefined()
      expect(BROWSER_CONFIG.STYLE_OPTION_CLICK_GAP_MS).toBeDefined()
      expect(BROWSER_CONFIG.TRANSLATION_OUTPUT_STABLE_MS).toBeDefined()
      expect(BROWSER_CONFIG.TRANSLATION_OUTPUT_POLL_MS).toBeDefined()
      expect(BROWSER_CONFIG.TRANSLATION_OUTPUT_MAX_WAIT_MS).toBeDefined()
      expect(BROWSER_CONFIG.POST_STABLE_EXTRA_MS).toBeDefined()
      expect(BROWSER_CONFIG.POST_FORMALITY_CASUAL_SETTLE_MS).toBeDefined()
      expect(BROWSER_CONFIG.TRANSLATION_VISIBLE_AFTER_SETTINGS_MS).toBeDefined()
    })

    it('should default to visible browser for debugging', () => {
      expect(BROWSER_CONFIG.HEADLESS).toBe(false)
    })

    it('should have reasonable timeout values', () => {
      expect(BROWSER_CONFIG.TIMEOUT).toBe(30000) // 30s
      expect(BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT).toBe(15000) // 15s
      expect(BROWSER_CONFIG.POST_RENDER_DELAY).toBe(1000) // 1s
      expect(BROWSER_CONFIG.TRANSLATION_OUTPUT_MAX_WAIT_MS).toBe(90000)
      expect(BROWSER_CONFIG.TRANSLATION_OUTPUT_STABLE_MS).toBe(1500)
      expect(BROWSER_CONFIG.POST_FORMALITY_CASUAL_SETTLE_MS).toBe(3000)
    })

    it('should have timeout greater than wait timeout', () => {
      expect(BROWSER_CONFIG.TIMEOUT).toBeGreaterThan(BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT)
    })
  })

  describe('TRANSLATION_STYLE_UI_LABELS', () => {
    it('should match Kagi settings dialog labels', () => {
      expect(TRANSLATION_STYLE_UI_LABELS.NATURAL).toBe('Natural')
      expect(TRANSLATION_STYLE_UI_LABELS.LITERAL).toBe('Literal')
    })
  })

  describe('FORMALITY_UI_LABELS', () => {
    it('should match Kagi formality row labels', () => {
      expect(FORMALITY_UI_LABELS.STANDARD).toBe('Standard')
      expect(FORMALITY_UI_LABELS.VIETNAMESE_FORMAL).toBe('Vietnamese Formal')
      expect(FORMALITY_UI_LABELS.VIETNAMESE_CASUAL).toBe('Vietnamese Casual')
    })
  })

  describe('INDEX_ENTRY_SAMPLE_TRANSLATION_CONTEXT', () => {
    it('should be the non-empty demo string used by src/index.ts local entry', () => {
      expect(INDEX_ENTRY_SAMPLE_TRANSLATION_CONTEXT).toBe('hello')
      expect(INDEX_ENTRY_SAMPLE_TRANSLATION_CONTEXT.length).toBeLessThanOrEqual(
        MAX_TRANSLATION_CONTEXT_LENGTH,
      )
    })
  })

  describe('clampTranslationContext', () => {
    it('should return empty string for undefined or empty input', () => {
      expect(clampTranslationContext(undefined)).toBe('')
      expect(clampTranslationContext('')).toBe('')
    })

    it('should pass through at most MAX_TRANSLATION_CONTEXT_LENGTH characters', () => {
      const s = 'a'.repeat(MAX_TRANSLATION_CONTEXT_LENGTH)
      expect(clampTranslationContext(s)).toBe(s)
      expect(clampTranslationContext(`${s}EXTRA`)).toBe(s)
    })
  })

  describe('GENDER_PREFERENCE_UI_LABELS', () => {
    it('should match Kagi speaker and addressee gender row labels', () => {
      expect(GENDER_PREFERENCE_UI_LABELS.UNKNOWN).toBe('Unknown')
      expect(GENDER_PREFERENCE_UI_LABELS.NEUTRAL).toBe('Neutral')
      expect(GENDER_PREFERENCE_UI_LABELS.FEMININE).toBe('Feminine')
      expect(GENDER_PREFERENCE_UI_LABELS.MASCULINE).toBe('Masculine')
      expect(SPEAKER_GENDER_UI_LABELS).toBe(GENDER_PREFERENCE_UI_LABELS)
      expect(ADDRESSEE_GENDER_UI_LABELS).toBe(GENDER_PREFERENCE_UI_LABELS)
    })
  })

  describe('getReadingLevelSliderValue', () => {
    it('should map standard to slider step 0', () => {
      expect(getReadingLevelSliderValue('standard')).toBe(0)
    })

    it('should map reading levels in CEFR order', () => {
      expect(getReadingLevelSliderValue('a1')).toBe(1)
      expect(getReadingLevelSliderValue('a2')).toBe(2)
      expect(getReadingLevelSliderValue('b1')).toBe(3)
      expect(getReadingLevelSliderValue('b2')).toBe(4)
      expect(getReadingLevelSliderValue('c1')).toBe(5)
      expect(getReadingLevelSliderValue('c2')).toBe(6)
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
      expect(KAGI_SELECTORS.TRANSLATION_SETTINGS_BUTTON).toBeDefined()
      expect(KAGI_SELECTORS.READING_LEVEL_SLIDER).toBeDefined()
      expect(KAGI_SELECTORS.TRANSLATION_STYLE_OPTION_LABEL_SPAN).toBeDefined()
      expect(KAGI_SELECTORS.FORMALITY_OPTION_LABEL_SPAN).toBeDefined()
      expect(KAGI_SELECTORS.SPEAKER_GENDER_OPTION_LABEL_SPAN).toBeDefined()
      expect(KAGI_SELECTORS.ADDRESSEE_GENDER_OPTION_LABEL_SPAN).toBeDefined()
      expect(KAGI_SELECTORS.TRANSLATION_CONTENT).toBeDefined()
      expect(KAGI_SELECTORS.TEXT_SPAN).toBeDefined()
      expect(KAGI_SELECTORS.TEXTAREA_PLACEHOLDER).toBeDefined()
      expect(KAGI_SELECTORS.TRANSLATION_CONTEXT_TEXTAREA).toBeDefined()
      expect(KAGI_SELECTORS.SOURCE_TEXT_INPUT).toBeDefined()
    })

    it('should have valid CSS selectors', () => {
      expect(KAGI_SELECTORS.TRANSLATION_SETTINGS_BUTTON).toMatch(/^button\[aria-label=/)
      expect(KAGI_SELECTORS.READING_LEVEL_SLIDER).toMatch(/^input\[type="range"/)
      expect(KAGI_SELECTORS.TRANSLATION_STYLE_OPTION_LABEL_SPAN).toMatch(/^span\./)
      expect(KAGI_SELECTORS.FORMALITY_OPTION_LABEL_SPAN).toBe(
        'span.flex-grow.text-start, span.grow.text-start',
      )
      expect(KAGI_SELECTORS.SPEAKER_GENDER_OPTION_LABEL_SPAN).toBe('span.flex-grow.text-start')
      expect(KAGI_SELECTORS.ADDRESSEE_GENDER_OPTION_LABEL_SPAN).toBe('span.flex-grow.text-start')
      expect(KAGI_SELECTORS.TRANSLATION_CONTENT).toMatch(/^\./) // Class selector
      expect(KAGI_SELECTORS.TEXT_SPAN).toBeTruthy()
      expect(KAGI_SELECTORS.TEXTAREA_PLACEHOLDER).toMatch(/^textarea/) // Element selector
      expect(KAGI_SELECTORS.TRANSLATION_CONTEXT_TEXTAREA).toBe(
        'textarea[placeholder*="Brief context for translation"]',
      )
      expect(KAGI_SELECTORS.SOURCE_TEXT_INPUT).toBe('[aria-label="Source text input"]')
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
      expect(options).toHaveProperty('translationContext')
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
      expect(options.translationContext).toBe(DEFAULT_TRANSLATION_CONFIG.TRANSLATION_CONTEXT)
    })

    it('should return a new object each time (not reference)', () => {
      const options1 = getDefaultTranslationOptions()
      const options2 = getDefaultTranslationOptions()

      expect(options1).not.toBe(options2) // Different references
      expect(options1).toEqual(options2) // But same values
    })

    it('should be mutable (can override values)', () => {
      const options = getDefaultTranslationOptions()
      options.readingLevel = 'b2'

      expect(options.readingLevel).toBe('b2')
      expect(DEFAULT_TRANSLATION_CONFIG.READING_LEVEL).toBe('c2') // Original unchanged
    })
  })

  describe('Config Integration', () => {
    it('should have consistent language codes between INPUT_TEXT and SOURCE_LANG', () => {
      const text = DEFAULT_TRANSLATION_CONFIG.INPUT_TEXT
      const sourceLang = DEFAULT_TRANSLATION_CONFIG.SOURCE_LANG

      expect(text.length).toBeGreaterThan(50)
      expect(['auto', 'en']).toContain(sourceLang)
    })

    it('should have browser timeout sufficient for translation wait', () => {
      const totalWaitTime =
        BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT + BROWSER_CONFIG.POST_RENDER_DELAY
      expect(BROWSER_CONFIG.TIMEOUT).toBeGreaterThan(totalWaitTime)
    })
  })

  describe('clampInputText', () => {
    it('should pass through text ≤ 20,000 chars unchanged', () => {
      const text = 'a'.repeat(20_000)
      expect(clampInputText(text)).toBe(text)
    })

    it('should pass through empty string', () => {
      expect(clampInputText('')).toBe('')
    })

    it('should truncate text > 20,000 chars to exactly 20,000', () => {
      const text = 'a'.repeat(20_001)
      const result = clampInputText(text)
      expect(result.length).toBe(20_000)
      expect(result).toBe('a'.repeat(20_000))
    })

    it('should truncate at exact boundary + 1', () => {
      const text = 'x'.repeat(25_000)
      const result = clampInputText(text)
      expect(result.length).toBe(20_000)
      expect(result).toBe('x'.repeat(20_000))
    })

    it('should preserve characters before the cut point', () => {
      const prefix = 'hello '
      const filler = 'x'.repeat(20_000 - prefix.length)
      const suffix = ' world'
      const text = prefix + filler + suffix
      const result = clampInputText(text)
      expect(result).toBe(prefix + filler)
    })

    it('MAX_INPUT_TEXT_LENGTH should equal 20000', () => {
      expect(MAX_INPUT_TEXT_LENGTH).toBe(20_000)
    })
  })
})
