import { describe, expect, it } from 'bun:test'
import { buildKagiUrl, KAGI_STYLE_VALUES } from './url-builder'

function getParams(url: string): URLSearchParams {
  return new URL(url).searchParams
}

describe('buildKagiUrl', () => {
  it('exposes the expanded preset catalog', () => {
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

  it('Clear adds from, to, text, and preserveFormatting=true', () => {
    const params = getParams(buildKagiUrl('Hello', 'Clear'))

    expect(params.get('from')).toBe('auto')
    expect(params.get('to')).toBe('vi')
    expect(params.get('text')).toBe('Hello')
    expect(params.get('preserveFormatting')).toBe('true')
    expect(params.has('context')).toBe(false)
  })

  it('Wild adds formality and advanced language-complexity params', () => {
    const params = getParams(buildKagiUrl('Hello', 'Wild'))

    expect(params.get('formality')).toBe('more')
    expect(params.get('formality_context')).toBe('vi_casual')
    expect(params.get('language_complexity')).toBe('c2')
  })

  it('Warm keeps the casual tone without forcing a reading level', () => {
    const params = getParams(buildKagiUrl('Hello', 'Warm'))

    expect(params.get('formality')).toBe('more')
    expect(params.get('formality_context')).toBe('vi_casual')
    expect(params.has('language_complexity')).toBe(false)
    expect(params.has('style')).toBe(false)
  })

  it('Polite adds formal tone with a balanced reading level', () => {
    const params = getParams(buildKagiUrl('Hello', 'Polite'))

    expect(params.get('formality')).toBe('more')
    expect(params.get('formality_context')).toBe('vi_formal')
    expect(params.get('language_complexity')).toBe('b2')
  })

  it('True adds style=literal and language_complexity=b2', () => {
    const params = getParams(buildKagiUrl('Hello', 'True'))

    expect(params.get('style')).toBe('literal')
    expect(params.get('language_complexity')).toBe('b2')
  })

  it('Exact adds literal style with the densest reading level', () => {
    const params = getParams(buildKagiUrl('Hello', 'Exact'))

    expect(params.get('style')).toBe('literal')
    expect(params.get('language_complexity')).toBe('c2')
  })

  it('appends context only when trimmed non-empty', () => {
    const withContext = getParams(buildKagiUrl('Hello', 'Clear', ' software team '))
    const withoutContext = getParams(buildKagiUrl('Hello', 'Clear', '   '))

    expect(withContext.get('context')).toBe('software team')
    expect(withoutContext.has('context')).toBe(false)
  })
})
