import { describe, expect, it } from 'bun:test'
import { buildKagiUrl, buildPreviewUrl } from './url-builder'

describe('buildKagiUrl', () => {
  it('should build URL with Wild style and context', () => {
    const url = buildKagiUrl('hello', 'Wild', 'software team')

    expect(url).toContain('https://translate.kagi.com/')
    expect(url).toContain('from=auto')
    expect(url).toContain('to=vi')
    expect(url).toContain('text=hello')
    expect(url).not.toContain('preserveFormatting')
    expect(url).toContain('formality=less')
    expect(url).toContain('formality_context=vi_casual')
    expect(url).toContain('language_complexity=c2')
    expect(url).toContain('context=software+team')
  })

  it('should build URL with Clear style without context', () => {
    const url = buildKagiUrl('test', 'Clear')

    expect(url).toContain('text=test')
    expect(url).not.toMatch(/[?&]context=/)
    expect(url).not.toContain('formality=')
    expect(url).not.toContain('language_complexity=')
  })

  it('should build URL with True style (literal translation)', () => {
    const url = buildKagiUrl('text', 'True')

    expect(url).toContain('style=literal')
    expect(url).toContain('language_complexity=b2')
  })

  it('should trim context and skip if empty', () => {
    const url = buildKagiUrl('text', 'Clear', '   ')

    expect(url).not.toMatch(/[?&]context=/)
  })

  it('should encode special characters in context', () => {
    const url = buildKagiUrl('text', 'Clear', 'test & data')

    expect(url).toContain('context=test+%26+data')
  })
})

describe('buildPreviewUrl', () => {
  it('should build preview URL with context', () => {
    const url = buildPreviewUrl('Wild', 'software team')

    expect(url).toContain('text=hello')
    expect(url).toContain('context=software+team')
  })

  it('should build preview URL without context (null)', () => {
    const url = buildPreviewUrl('Clear', null)

    expect(url).toContain('text=hello')
    expect(url).not.toMatch(/[?&]context=/)
  })

  it('should build preview URL without context (undefined)', () => {
    const url = buildPreviewUrl('Smart')

    expect(url).toContain('text=hello')
    expect(url).not.toMatch(/[?&]context=/)
  })

  it('should build preview URL without context (empty string)', () => {
    const url = buildPreviewUrl('Deep', '')

    expect(url).toContain('text=hello')
    expect(url).not.toMatch(/[?&]context=/)
  })

  it('should build preview URL without context (whitespace)', () => {
    const url = buildPreviewUrl('Fine', '   ')

    expect(url).toContain('text=hello')
    expect(url).not.toMatch(/[?&]context=/)
  })

  it('should encode special characters in context', () => {
    const url = buildPreviewUrl('Polite', 'test & data')

    expect(url).toContain('text=hello')
    expect(url).toContain('context=test+%26+data')
  })

  it('should handle unicode context', () => {
    const url = buildPreviewUrl('Elegant', 'ソフトウェア')

    expect(url).toContain('text=hello')
    expect(url).toMatch(/[?&]context=/)
    expect(decodeURIComponent(url)).toContain('ソフトウェア')
  })
})
