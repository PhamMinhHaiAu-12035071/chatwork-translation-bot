import { describe, it, expect } from 'bun:test'
import {
  TRANSLATION_STYLE_VALUES,
  DEFAULT_TRANSLATION_STYLE,
  isTranslationStyle,
} from './translation-style'

describe('TRANSLATION_STYLE_VALUES', () => {
  it('contains exactly 3 styles without AUTO_CONTEXT', () => {
    expect(TRANSLATION_STYLE_VALUES).toEqual([
      'NATURAL_CASUAL',
      'PROFESSIONAL_BUSINESS',
      'TECHNICAL',
    ])
  })

  it('does not include AUTO_CONTEXT', () => {
    expect(TRANSLATION_STYLE_VALUES).not.toContain('AUTO_CONTEXT')
  })
})

describe('DEFAULT_TRANSLATION_STYLE', () => {
  it('is PROFESSIONAL_BUSINESS', () => {
    expect(DEFAULT_TRANSLATION_STYLE).toBe('PROFESSIONAL_BUSINESS')
  })
})

describe('isTranslationStyle', () => {
  it('returns true for valid styles', () => {
    expect(isTranslationStyle('NATURAL_CASUAL')).toBe(true)
    expect(isTranslationStyle('PROFESSIONAL_BUSINESS')).toBe(true)
    expect(isTranslationStyle('TECHNICAL')).toBe(true)
  })

  it('returns false for AUTO_CONTEXT', () => {
    expect(isTranslationStyle('AUTO_CONTEXT')).toBe(false)
  })

  it('returns false for arbitrary strings', () => {
    expect(isTranslationStyle('INVALID')).toBe(false)
    expect(isTranslationStyle('')).toBe(false)
  })
})
