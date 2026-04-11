import { describe, expect, it } from 'bun:test'
import { KAGI_STYLE_DESCRIPTIONS, KAGI_STYLE_VALUES } from './types'

describe('provider-kagi types', () => {
  it('exports the richer preset catalog for all consumers', () => {
    expect(KAGI_STYLE_VALUES).toEqual([
      'Raw',
      'Warm',
      'Easy',
      'Clear',
      'Smart',
      'Deep',
      'Fine',
      'Polite',
      'Elegant',
      'True',
      'Precise',
      'Exact',
    ])
  })

  it('provides a short description for each preset style', () => {
    expect(KAGI_STYLE_DESCRIPTIONS.Raw).toBe('Casual, vivid, and full of energy.')
    expect(KAGI_STYLE_DESCRIPTIONS.Clear).toBe('Balanced, natural, and easy to read.')
    expect(KAGI_STYLE_DESCRIPTIONS.Exact).toBe('Literal and highly precise for nuanced text.')
    expect(Object.keys(KAGI_STYLE_DESCRIPTIONS)).toHaveLength(KAGI_STYLE_VALUES.length)
  })
})
