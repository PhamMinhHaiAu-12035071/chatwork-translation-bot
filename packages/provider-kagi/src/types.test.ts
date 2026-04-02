import { describe, expect, it } from 'bun:test'
import { KAGI_STYLE_VALUES } from './types'

describe('provider-kagi types', () => {
  it('exports the richer preset catalog for all consumers', () => {
    expect(KAGI_STYLE_VALUES).toEqual([
      'Wild',
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
})
