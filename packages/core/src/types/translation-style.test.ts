import { describe, expect, it } from 'bun:test'
import {
  DEFAULT_TRANSLATION_STYLE,
  isTranslationStyle,
  TRANSLATION_STYLE_VALUES,
} from './translation-style'

describe('translation-style', () => {
  it('exports the four supported styles in a stable order', () => {
    expect(TRANSLATION_STYLE_VALUES).toEqual([
      'AUTO_CONTEXT',
      'NATURAL_CASUAL',
      'PROFESSIONAL_BUSINESS',
      'TECHNICAL',
    ])
  })

  it('uses PROFESSIONAL_BUSINESS as the default', () => {
    expect(DEFAULT_TRANSLATION_STYLE).toBe('PROFESSIONAL_BUSINESS')
  })

  it('recognizes valid values', () => {
    expect(isTranslationStyle('TECHNICAL')).toBe(true)
    expect(isTranslationStyle('freeform')).toBe(false)
  })
})
