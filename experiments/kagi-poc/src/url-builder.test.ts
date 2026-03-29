import { describe, it, expect } from 'bun:test'
import { buildKagiUrl } from './url-builder'

describe('buildKagiUrl', () => {
  it('builds base URL with required fields', () => {
    const url = buildKagiUrl({ text: 'hello', from: 'en', to: 'vi' })
    expect(url).toStartWith('https://translate.kagi.com/?')
    expect(url).toContain('from=en')
    expect(url).toContain('to=vi')
    expect(url).toContain('text=hello')
  })

  it('URL-encodes Japanese text', () => {
    const url = buildKagiUrl({ text: 'こんにちは', from: 'ja', to: 'vi' })
    expect(decodeURIComponent(url)).toContain('こんにちは')
  })

  it('includes style when provided', () => {
    const url = buildKagiUrl({ text: 'hello', from: 'en', to: 'vi', style: 'literal' })
    expect(url).toContain('style=literal')
  })

  it('does not include style when omitted', () => {
    const url = buildKagiUrl({ text: 'hello', from: 'en', to: 'vi' })
    expect(url).not.toContain('style=')
  })

  it('includes formality when provided', () => {
    const url = buildKagiUrl({ text: 'hello', from: 'en', to: 'vi', formality: 'more' })
    expect(url).toContain('formality=more')
  })

  it('maps languageComplexity → language_complexity param', () => {
    const url = buildKagiUrl({ text: 'hello', from: 'en', to: 'vi', languageComplexity: 'b2' })
    expect(url).toContain('language_complexity=b2')
  })

  it('maps speakerGender → speaker_gender param', () => {
    const url = buildKagiUrl({ text: 'hello', from: 'en', to: 'vi', speakerGender: 'masculine' })
    expect(url).toContain('speaker_gender=masculine')
  })

  it('maps addresseeGender → addressee_gender param', () => {
    const url = buildKagiUrl({ text: 'hello', from: 'en', to: 'vi', addresseeGender: 'feminine' })
    expect(url).toContain('addressee_gender=feminine')
  })

  it('maps preserveFormatting → preserveFormatting param as string', () => {
    const url = buildKagiUrl({ text: 'hello', from: 'en', to: 'vi', preserveFormatting: true })
    expect(url).toContain('preserveFormatting=true')
  })

  it('does not include context when empty string', () => {
    const url = buildKagiUrl({ text: 'hello', from: 'en', to: 'vi', context: '' })
    expect(url).not.toContain('context=')
  })

  it('includes context when non-empty', () => {
    const url = buildKagiUrl({ text: 'hello', from: 'en', to: 'vi', context: 'business meeting' })
    expect(url).toContain('context=')
    // URLSearchParams encodes spaces as '+', so we verify the param is present and decodes correctly
    expect(decodeURIComponent(url.replace(/\+/g, ' '))).toContain('context=business meeting')
  })

  it('throws when text is empty string', () => {
    expect(() => buildKagiUrl({ text: '', from: 'ja', to: 'vi' })).toThrow('text must not be empty')
  })

  it('throws when text is whitespace only', () => {
    expect(() => buildKagiUrl({ text: '   ', from: 'ja', to: 'vi' })).toThrow(
      'text must not be empty',
    )
  })
})
