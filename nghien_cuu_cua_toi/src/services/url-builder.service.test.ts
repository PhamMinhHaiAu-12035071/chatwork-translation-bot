/**
 * Tests for URL Builder Service
 *
 * Test strategy: Pairwise testing (~40 tests)
 * - Boundaries: defaults, extremes
 * - Critical combos: Vietnamese formality + reading levels
 * - Invalid values: validation errors
 */

import { describe, it, expect } from 'bun:test'
import { KagiUrlBuilder } from './url-builder.service'
import { ValidationError } from '~/errors'
import type { TranslationOptions } from '~/types'

describe('KagiUrlBuilder', () => {
  const builder = new KagiUrlBuilder()

  describe('Defaults (No Extra Params)', () => {
    it('should build URL with all defaults (minimal params)', () => {
      const options: TranslationOptions = {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'standard',
        speakerGender: 'unknown',
        addresseeGender: 'unknown',
        style: 'natural',
        formality: 'standard',
      }

      const url = builder.build('Hello', options)

      expect(url).toBe('https://translate.kagi.com/?from=auto&to=vi&text=Hello')
      expect(url).not.toContain('language_complexity')
      expect(url).not.toContain('speaker_gender')
      expect(url).not.toContain('addressee_gender')
      expect(url).not.toContain('style')
      expect(url).not.toContain('formality')
      expect(url).not.toContain('context=')
    })

    it('should encode special characters in text', () => {
      const options: TranslationOptions = {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'standard',
        speakerGender: 'unknown',
        addresseeGender: 'unknown',
        style: 'natural',
        formality: 'standard',
      }

      const url = builder.build('Hello & goodbye!', options)

      expect(url).toContain('Hello+%26+goodbye%21')
    })
  })

  describe('Translation context (URL)', () => {
    it('should include context param when translationContext is non-empty', () => {
      const options: TranslationOptions = {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'standard',
        speakerGender: 'unknown',
        addresseeGender: 'unknown',
        style: 'natural',
        formality: 'standard',
        translationContext: 'Technical documentation for senior engineers',
      }

      const url = builder.build('Hello', options)

      expect(url).toContain('context=')
      expect(url).toContain('Technical+documentation+for+senior+engineers')
    })

    it('should omit context param when translationContext is empty', () => {
      const options: TranslationOptions = {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'standard',
        speakerGender: 'unknown',
        addresseeGender: 'unknown',
        style: 'natural',
        formality: 'standard',
        translationContext: '',
      }

      expect(builder.build('Hi', options)).not.toContain('context=')
    })
  })

  describe('Reading Level Variations', () => {
    it('should not include language_complexity for a1', () => {
      const url = builder.build('Hello', {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'a1',
        speakerGender: 'unknown',
        addresseeGender: 'unknown',
        style: 'natural',
        formality: 'standard',
      })

      expect(url).not.toContain('language_complexity')
    })

    it('should not include language_complexity for a2', () => {
      const url = builder.build('Hello', {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'a2',
        speakerGender: 'unknown',
        addresseeGender: 'unknown',
        style: 'natural',
        formality: 'standard',
      })

      expect(url).not.toContain('language_complexity')
    })

    it('should not include language_complexity for b1', () => {
      const url = builder.build('Hello', {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'b1',
        speakerGender: 'unknown',
        addresseeGender: 'unknown',
        style: 'natural',
        formality: 'standard',
      })

      expect(url).not.toContain('language_complexity')
    })

    it('should not include language_complexity for b2', () => {
      const url = builder.build('Hello', {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'b2',
        speakerGender: 'unknown',
        addresseeGender: 'unknown',
        style: 'natural',
        formality: 'standard',
      })

      expect(url).not.toContain('language_complexity')
    })

    it('should not include language_complexity for c1', () => {
      const url = builder.build('Hello', {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'c1',
        speakerGender: 'unknown',
        addresseeGender: 'unknown',
        style: 'natural',
        formality: 'standard',
      })

      expect(url).not.toContain('language_complexity')
    })

    it('should not include language_complexity for c2 (extreme)', () => {
      const url = builder.build('Hello', {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'c2',
        speakerGender: 'unknown',
        addresseeGender: 'unknown',
        style: 'natural',
        formality: 'standard',
      })

      expect(url).not.toContain('language_complexity')
    })
  })

  describe('Gender Variations', () => {
    it('should include speaker_gender=neutral', () => {
      const url = builder.build('Hello', {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'standard',
        speakerGender: 'neutral',
        addresseeGender: 'unknown',
        style: 'natural',
        formality: 'standard',
      })

      expect(url).toContain('speaker_gender=neutral')
      expect(url).not.toContain('addressee_gender')
    })

    it('should include speaker_gender=feminine', () => {
      const url = builder.build('Hello', {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'standard',
        speakerGender: 'feminine',
        addresseeGender: 'unknown',
        style: 'natural',
        formality: 'standard',
      })

      expect(url).toContain('speaker_gender=feminine')
    })

    it('should include addressee_gender=neutral', () => {
      const url = builder.build('Hello', {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'standard',
        speakerGender: 'unknown',
        addresseeGender: 'neutral',
        style: 'natural',
        formality: 'standard',
      })

      expect(url).toContain('addressee_gender=neutral')
      expect(url).not.toContain('speaker_gender')
    })

    it('should include addressee_gender=feminine', () => {
      const url = builder.build('Hello', {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'standard',
        speakerGender: 'unknown',
        addresseeGender: 'feminine',
        style: 'natural',
        formality: 'standard',
      })

      expect(url).toContain('addressee_gender=feminine')
    })

    it('should include both genders when both are set', () => {
      const url = builder.build('Hello', {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'standard',
        speakerGender: 'neutral',
        addresseeGender: 'feminine',
        style: 'natural',
        formality: 'standard',
      })

      expect(url).toContain('speaker_gender=neutral')
      expect(url).toContain('addressee_gender=feminine')
    })
  })

  describe('Style Variations', () => {
    it('should include style=literal', () => {
      const url = builder.build('Hello', {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'standard',
        speakerGender: 'unknown',
        addresseeGender: 'unknown',
        style: 'literal',
        formality: 'standard',
      })

      expect(url).toContain('style=literal')
    })

    it('should not include style for natural (default)', () => {
      const url = builder.build('Hello', {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'standard',
        speakerGender: 'unknown',
        addresseeGender: 'unknown',
        style: 'natural',
        formality: 'standard',
      })

      expect(url).not.toContain('style')
    })
  })

  describe('Formality Variations (Vietnamese)', () => {
    it('should include formality params for vietnamese_formal', () => {
      const url = builder.build('Hello', {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'standard',
        speakerGender: 'unknown',
        addresseeGender: 'unknown',
        style: 'natural',
        formality: 'vietnamese_formal',
      })

      expect(url).toContain('formality=more')
      expect(url).toContain('formality_context=vi_formal')
    })

    it('should include formality params for vietnamese_casual', () => {
      const url = builder.build('Hello', {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'standard',
        speakerGender: 'unknown',
        addresseeGender: 'unknown',
        style: 'natural',
        formality: 'vietnamese_casual',
      })

      expect(url).toContain('formality=less')
      expect(url).toContain('formality_context=vi_casual')
    })

    it('should not include formality for standard', () => {
      const url = builder.build('Hello', {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'standard',
        speakerGender: 'unknown',
        addresseeGender: 'unknown',
        style: 'natural',
        formality: 'standard',
      })

      expect(url).not.toContain('formality')
      expect(url).not.toContain('formality_context')
    })
  })

  describe('Pairwise Critical Combinations', () => {
    it('should handle c2 + vietnamese_formal (advanced formal)', () => {
      const url = builder.build('Hello', {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'c2',
        speakerGender: 'unknown',
        addresseeGender: 'unknown',
        style: 'natural',
        formality: 'vietnamese_formal',
      })

      expect(url).not.toContain('language_complexity')
      expect(url).toContain('formality=more')
      expect(url).toContain('formality_context=vi_formal')
    })

    it('should handle a1 + vietnamese_casual (beginner casual)', () => {
      const url = builder.build('Hello', {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'a1',
        speakerGender: 'unknown',
        addresseeGender: 'unknown',
        style: 'natural',
        formality: 'vietnamese_casual',
      })

      expect(url).not.toContain('language_complexity')
      expect(url).toContain('formality=less')
      expect(url).toContain('formality_context=vi_casual')
    })

    it('should handle c2 + literal + feminine genders (extreme combo)', () => {
      const url = builder.build('Hello', {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'c2',
        speakerGender: 'feminine',
        addresseeGender: 'feminine',
        style: 'literal',
        formality: 'standard',
      })

      expect(url).not.toContain('language_complexity')
      expect(url).toContain('speaker_gender=feminine')
      expect(url).toContain('addressee_gender=feminine')
      expect(url).toContain('style=literal')
    })

    it('should handle full advanced settings (all non-defaults)', () => {
      const url = builder.build('Hello', {
        sourceLang: 'en',
        targetLang: 'vi',
        readingLevel: 'b2',
        speakerGender: 'neutral',
        addresseeGender: 'feminine',
        style: 'literal',
        formality: 'vietnamese_formal',
      })

      expect(url).toContain('from=en')
      expect(url).toContain('to=vi')
      expect(url).not.toContain('language_complexity')
      expect(url).toContain('speaker_gender=neutral')
      expect(url).toContain('addressee_gender=feminine')
      expect(url).toContain('style=literal')
      expect(url).toContain('formality=more')
      expect(url).toContain('formality_context=vi_formal')
    })

    it('should handle b1 + neutral genders + vietnamese_casual', () => {
      const url = builder.build('Hello', {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'b1',
        speakerGender: 'neutral',
        addresseeGender: 'neutral',
        style: 'natural',
        formality: 'vietnamese_casual',
      })

      expect(url).not.toContain('language_complexity')
      expect(url).toContain('speaker_gender=neutral')
      expect(url).toContain('addressee_gender=neutral')
      expect(url).toContain('formality_context=vi_casual')
    })
  })

  describe('Language Code Variations', () => {
    it('should handle explicit English source', () => {
      const url = builder.build('Hello', {
        sourceLang: 'en',
        targetLang: 'vi',
        readingLevel: 'standard',
        speakerGender: 'unknown',
        addresseeGender: 'unknown',
        style: 'natural',
        formality: 'standard',
      })

      expect(url).toContain('from=en')
    })

    it('should handle Japanese target', () => {
      const url = builder.build('Hello', {
        sourceLang: 'auto',
        targetLang: 'ja',
        readingLevel: 'standard',
        speakerGender: 'unknown',
        addresseeGender: 'unknown',
        style: 'natural',
        formality: 'standard',
      })

      expect(url).toContain('to=ja')
    })

    it('should handle Korean source to English target', () => {
      const url = builder.build('안녕하세요', {
        sourceLang: 'ko',
        targetLang: 'en',
        readingLevel: 'standard',
        speakerGender: 'unknown',
        addresseeGender: 'unknown',
        style: 'natural',
        formality: 'standard',
      })

      expect(url).toContain('from=ko')
      expect(url).toContain('to=en')
    })
  })

  describe('Validation Errors', () => {
    it('should throw ValidationError for invalid readingLevel', () => {
      expect(() => {
        builder.build('Hello', {
          sourceLang: 'auto',
          targetLang: 'vi',
          readingLevel: 'x99' as any,
          speakerGender: 'unknown',
          addresseeGender: 'unknown',
          style: 'natural',
          formality: 'standard',
        })
      }).toThrow(ValidationError)
    })

    it('should throw ValidationError for invalid speakerGender', () => {
      expect(() => {
        builder.build('Hello', {
          sourceLang: 'auto',
          targetLang: 'vi',
          readingLevel: 'standard',
          speakerGender: 'male' as any,
          addresseeGender: 'unknown',
          style: 'natural',
          formality: 'standard',
        })
      }).toThrow(ValidationError)
    })

    it('should throw ValidationError for invalid addresseeGender', () => {
      expect(() => {
        builder.build('Hello', {
          sourceLang: 'auto',
          targetLang: 'vi',
          readingLevel: 'standard',
          speakerGender: 'unknown',
          addresseeGender: 'male' as any,
          style: 'natural',
          formality: 'standard',
        })
      }).toThrow(ValidationError)
    })

    it('should throw ValidationError for invalid style', () => {
      expect(() => {
        builder.build('Hello', {
          sourceLang: 'auto',
          targetLang: 'vi',
          readingLevel: 'standard',
          speakerGender: 'unknown',
          addresseeGender: 'unknown',
          style: 'hybrid' as any,
          formality: 'standard',
        })
      }).toThrow(ValidationError)
    })

    it('should throw ValidationError for invalid formality', () => {
      expect(() => {
        builder.build('Hello', {
          sourceLang: 'auto',
          targetLang: 'vi',
          readingLevel: 'standard',
          speakerGender: 'unknown',
          addresseeGender: 'unknown',
          style: 'natural',
          formality: 'super_formal' as any,
        })
      }).toThrow(ValidationError)
    })

    it('should include field name in ValidationError message', () => {
      try {
        builder.build('Hello', {
          sourceLang: 'auto',
          targetLang: 'vi',
          readingLevel: 'x99' as any,
          speakerGender: 'unknown',
          addresseeGender: 'unknown',
          style: 'natural',
          formality: 'standard',
        })
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect((error as ValidationError).message).toContain('readingLevel')
        expect((error as ValidationError).message).toContain('x99')
      }
    })

    it('should include allowed values in ValidationError message', () => {
      try {
        builder.build('Hello', {
          sourceLang: 'auto',
          targetLang: 'vi',
          readingLevel: 'standard',
          speakerGender: 'unknown',
          addresseeGender: 'unknown',
          style: 'natural',
          formality: 'super_formal' as any,
        })
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect((error as ValidationError).message).toContain('standard')
        expect((error as ValidationError).message).toContain('vietnamese_formal')
        expect((error as ValidationError).message).toContain('vietnamese_casual')
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty text', () => {
      const url = builder.build('', {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'standard',
        speakerGender: 'unknown',
        addresseeGender: 'unknown',
        style: 'natural',
        formality: 'standard',
      })

      expect(url).toContain('text=')
      expect(url).toBeTruthy()
    })

    it('should handle very long text', () => {
      const longText = 'Hello '.repeat(1000)
      const url = builder.build(longText, {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'standard',
        speakerGender: 'unknown',
        addresseeGender: 'unknown',
        style: 'natural',
        formality: 'standard',
      })

      expect(url).toContain('text=Hello')
      expect(url.length).toBeGreaterThan(1000)
    })

    it('should handle Unicode characters', () => {
      const url = builder.build('こんにちは 你好 สวัสดี', {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'standard',
        speakerGender: 'unknown',
        addresseeGender: 'unknown',
        style: 'natural',
        formality: 'standard',
      })

      expect(url).toContain('text=')
      expect(url).toBeTruthy()
    })
  })
})
