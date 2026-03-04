import { describe, expect, it } from 'bun:test'
import { parseCommand } from './parse-command'

describe('parseCommand', () => {
  it('parses basic /translate command', () => {
    const result = parseCommand('/translate en Hello World')
    expect(result).toEqual({
      targetLang: 'en',
      text: 'Hello World',
    })
  })

  it('parses /translate with Vietnamese text', () => {
    const result = parseCommand('/translate en Xin chào thế giới')
    expect(result).toEqual({
      targetLang: 'en',
      text: 'Xin chào thế giới',
    })
  })

  it('parses /translate with Japanese target', () => {
    const result = parseCommand('/translate ja Hello')
    expect(result).toEqual({
      targetLang: 'ja',
      text: 'Hello',
    })
  })

  it('strips Chatwork [To:xxx] markup', () => {
    const result = parseCommand('[To:12345]\n/translate en Hello')
    expect(result).toEqual({
      targetLang: 'en',
      text: 'Hello',
    })
  })

  it('strips reply markup before parsing', () => {
    const result = parseCommand('[rp aid=123 to=456:789]\n/translate vi Good morning')
    expect(result).toEqual({
      targetLang: 'vi',
      text: 'Good morning',
    })
  })

  it('returns null for unsupported language', () => {
    const result = parseCommand('/translate xx Hello')
    expect(result).toBeNull()
  })

  it('returns null for missing text', () => {
    const result = parseCommand('/translate en')
    expect(result).toBeNull()
  })

  it('returns null for non-translate command', () => {
    const result = parseCommand('/help')
    expect(result).toBeNull()
  })

  it('returns null for empty string', () => {
    const result = parseCommand('')
    expect(result).toBeNull()
  })

  it('is case-insensitive for command', () => {
    const result = parseCommand('/TRANSLATE EN hello')
    expect(result).toEqual({
      targetLang: 'en',
      text: 'hello',
    })
  })

  it('handles multi-line text', () => {
    const result = parseCommand('/translate en Line one\nLine two')
    expect(result).toEqual({
      targetLang: 'en',
      text: 'Line one\nLine two',
    })
  })
})
