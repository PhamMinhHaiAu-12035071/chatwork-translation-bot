/**
 * Tests for translation types and constants
 */

import { describe, it, expect } from 'bun:test'
import type {
  ReadingLevel,
  SpeakerGender,
  AddresseeGender,
  TranslationStyle,
  Formality,
  TranslationOptions,
} from './translation.types'
import {
  READING_LEVELS,
  SPEAKER_GENDERS,
  ADDRESSEE_GENDERS,
  TRANSLATION_STYLES,
  FORMALITIES,
} from './translation.types'

describe('Translation Types', () => {
  describe('READING_LEVELS', () => {
    it('should contain exactly 7 values', () => {
      expect(READING_LEVELS).toHaveLength(7)
    })

    it('should include standard as default', () => {
      expect(READING_LEVELS).toContain('standard')
    })

    it('should include all CEFR levels (a1-c2)', () => {
      expect(READING_LEVELS).toContain('a1')
      expect(READING_LEVELS).toContain('a2')
      expect(READING_LEVELS).toContain('b1')
      expect(READING_LEVELS).toContain('b2')
      expect(READING_LEVELS).toContain('c1')
      expect(READING_LEVELS).toContain('c2')
    })

    it('should be usable as ReadingLevel type', () => {
      const level: ReadingLevel = 'standard'
      expect(READING_LEVELS).toContain(level)
    })
  })

  describe('SPEAKER_GENDERS', () => {
    it('should contain exactly 3 values', () => {
      expect(SPEAKER_GENDERS).toHaveLength(3)
    })

    it('should include unknown as default', () => {
      expect(SPEAKER_GENDERS).toContain('unknown')
    })

    it('should include neutral and feminine', () => {
      expect(SPEAKER_GENDERS).toContain('neutral')
      expect(SPEAKER_GENDERS).toContain('feminine')
    })
  })

  describe('ADDRESSEE_GENDERS', () => {
    it('should contain exactly 3 values', () => {
      expect(ADDRESSEE_GENDERS).toHaveLength(3)
    })

    it('should include unknown as default', () => {
      expect(ADDRESSEE_GENDERS).toContain('unknown')
    })

    it('should include neutral and feminine', () => {
      expect(ADDRESSEE_GENDERS).toContain('neutral')
      expect(ADDRESSEE_GENDERS).toContain('feminine')
    })
  })

  describe('TRANSLATION_STYLES', () => {
    it('should contain exactly 2 values', () => {
      expect(TRANSLATION_STYLES).toHaveLength(2)
    })

    it('should include natural as default', () => {
      expect(TRANSLATION_STYLES).toContain('natural')
    })

    it('should include literal', () => {
      expect(TRANSLATION_STYLES).toContain('literal')
    })
  })

  describe('FORMALITIES', () => {
    it('should contain exactly 3 values', () => {
      expect(FORMALITIES).toHaveLength(3)
    })

    it('should include standard as default', () => {
      expect(FORMALITIES).toContain('standard')
    })

    it('should include Vietnamese-specific formalities', () => {
      expect(FORMALITIES).toContain('vietnamese_formal')
      expect(FORMALITIES).toContain('vietnamese_casual')
    })
  })

  describe('TranslationOptions interface', () => {
    it('should accept valid options with all defaults', () => {
      const options: TranslationOptions = {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'standard',
        speakerGender: 'unknown',
        addresseeGender: 'unknown',
        style: 'natural',
        formality: 'standard',
      }

      expect(options.sourceLang).toBe('auto')
      expect(options.targetLang).toBe('vi')
      expect(options.readingLevel).toBe('standard')
    })

    it('should accept valid options with advanced settings', () => {
      const options: TranslationOptions = {
        sourceLang: 'en',
        targetLang: 'vi',
        readingLevel: 'c2',
        speakerGender: 'neutral',
        addresseeGender: 'feminine',
        style: 'literal',
        formality: 'vietnamese_formal',
      }

      expect(options.readingLevel).toBe('c2')
      expect(options.speakerGender).toBe('neutral')
      expect(options.formality).toBe('vietnamese_formal')
    })
  })

  describe('Type Safety', () => {
    it('should validate ReadingLevel values at compile time', () => {
      const validLevels: ReadingLevel[] = ['standard', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2']
      expect(validLevels).toHaveLength(7)
    })

    it('should validate SpeakerGender values at compile time', () => {
      const validGenders: SpeakerGender[] = ['unknown', 'neutral', 'feminine']
      expect(validGenders).toHaveLength(3)
    })

    it('should validate Formality values at compile time', () => {
      const validFormalities: Formality[] = ['standard', 'vietnamese_formal', 'vietnamese_casual']
      expect(validFormalities).toHaveLength(3)
    })
  })
})
