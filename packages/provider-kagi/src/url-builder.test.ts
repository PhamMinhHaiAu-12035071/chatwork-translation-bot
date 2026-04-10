import { describe, expect, it } from 'bun:test'
import { buildKagiUrl, buildPreviewUrl, buildSimpleKagiUrl } from './url-builder'

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

describe('buildSimpleKagiUrl', () => {
  it('should build minimal URL with from/to/text params only', () => {
    const result = buildSimpleKagiUrl('Hello world')
    expect(result).toBe('https://translate.kagi.com/?from=auto&to=vi&text=Hello+world')
  })

  it('should properly encode special characters', () => {
    const result = buildSimpleKagiUrl('Hello & goodbye')
    expect(result).toContain('Hello+%26+goodbye')
  })

  it('should handle unicode characters', () => {
    const result = buildSimpleKagiUrl('你好 xin chào')
    expect(result).toContain('%E4%BD%A0%E5%A5%BD')
    expect(result).toContain('xin+ch%C3%A0o')
  })

  it('should handle empty string', () => {
    const result = buildSimpleKagiUrl('')
    expect(result).toBe('https://translate.kagi.com/?from=auto&to=vi&text=')
  })

  it('should handle long text', () => {
    const longText = 'a'.repeat(1000)
    const result = buildSimpleKagiUrl(longText)
    expect(result).toContain('from=auto')
    expect(result).toContain('to=vi')
    expect(result).toContain('text=')
    expect(result.length).toBeGreaterThan(1000)
  })
})
