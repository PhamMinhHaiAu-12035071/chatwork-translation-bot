import { describe, expect, it } from 'bun:test'
import { MAX_INPUT_TEXT_LENGTH, clampInputText } from './input-clamping'

describe('clampInputText', () => {
  it('returns text unchanged when within limit', () => {
    expect(clampInputText('hello')).toBe('hello')
  })

  it('returns empty string unchanged', () => {
    expect(clampInputText('')).toBe('')
  })

  it('returns text unchanged at exact limit', () => {
    const text = 'a'.repeat(MAX_INPUT_TEXT_LENGTH)
    expect(clampInputText(text)).toBe(text)
  })

  it('truncates text exceeding 20k chars', () => {
    const text = 'a'.repeat(MAX_INPUT_TEXT_LENGTH + 500)
    const result = clampInputText(text)
    expect(result).toHaveLength(MAX_INPUT_TEXT_LENGTH)
    expect(result).toBe(text.slice(0, MAX_INPUT_TEXT_LENGTH))
  })

  it('MAX_INPUT_TEXT_LENGTH is 20000', () => {
    expect(MAX_INPUT_TEXT_LENGTH).toBe(20_000)
  })
})
