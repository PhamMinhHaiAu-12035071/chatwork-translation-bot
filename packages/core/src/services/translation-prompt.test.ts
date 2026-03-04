import { describe, expect, it } from 'bun:test'
import {
  buildTranslationPrompt,
  TranslationSchema,
  encodeNewlines,
  decodeNewlines,
} from './translation-prompt'

describe('buildTranslationPrompt', () => {
  it('includes the original text in the prompt', () => {
    const prompt = buildTranslationPrompt('Hello World')
    expect(prompt).toContain('Hello World')
  })

  it('mentions Vietnamese in the prompt', () => {
    const prompt = buildTranslationPrompt('any text')
    expect(prompt.toLowerCase()).toContain('vietnamese')
  })

  it('does not instruct AI to return JSON format', () => {
    const prompt = buildTranslationPrompt('text')
    expect(prompt).not.toContain('JSON')
    expect(prompt).not.toContain('sourceLang')
  })

  it('instructs AI to preserve line breaks', () => {
    const prompt = buildTranslationPrompt('text')
    expect(prompt).toContain('line breaks')
  })

  it('instructs AI not to remove or merge [[NL]] tokens', () => {
    const prompt = buildTranslationPrompt('text')
    expect(prompt).toContain('Do NOT remove, merge, or translate [[NL]] tokens')
  })

  it('instructs AI to return full language name', () => {
    const prompt = buildTranslationPrompt('text')
    expect(prompt).toContain('full English name')
  })

  it('mentions [[NL]] tokens in the prompt', () => {
    const prompt = buildTranslationPrompt('text')
    expect(prompt).toContain('[[NL]]')
  })
})

describe('TranslationSchema', () => {
  it('accepts valid translation output', () => {
    const result = TranslationSchema.safeParse({ sourceLang: 'en', translated: 'Xin chào' })
    expect(result.success).toBe(true)
  })

  it('rejects empty translated text', () => {
    const result = TranslationSchema.safeParse({ sourceLang: 'en', translated: '' })
    expect(result.success).toBe(false)
  })

  it('accepts multi-part language codes like zh-CN', () => {
    const result = TranslationSchema.safeParse({ sourceLang: 'zh-CN', translated: '你好' })
    expect(result.success).toBe(true)
  })

  it('rejects missing sourceLang', () => {
    const result = TranslationSchema.safeParse({ translated: 'Xin chào' })
    expect(result.success).toBe(false)
  })

  it('accepts full language names like Japanese', () => {
    const result = TranslationSchema.safeParse({ sourceLang: 'Japanese', translated: 'Xin chào' })
    expect(result.success).toBe(true)
  })

  it('accepts long full names like Traditional Chinese', () => {
    const result = TranslationSchema.safeParse({
      sourceLang: 'Traditional Chinese',
      translated: 'Xin chào',
    })
    expect(result.success).toBe(true)
  })
})

describe('encodeNewlines', () => {
  it('replaces single newline with [[NL]]', () => {
    expect(encodeNewlines('a\nb')).toBe('a[[NL]]b')
  })

  it('replaces double newline with [[NL]][[NL]]', () => {
    expect(encodeNewlines('a\n\nb')).toBe('a[[NL]][[NL]]b')
  })

  it('leaves text without newlines unchanged', () => {
    expect(encodeNewlines('abc')).toBe('abc')
  })
})

describe('decodeNewlines', () => {
  it('restores [[NL]] to single newline', () => {
    expect(decodeNewlines('a[[NL]]b')).toBe('a\nb')
  })

  it('restores [[NL]][[NL]] to double newline', () => {
    expect(decodeNewlines('a[[NL]][[NL]]b')).toBe('a\n\nb')
  })

  it('round-trips: decode(encode(text)) === text', () => {
    const text = 'A\nB\n\nC\nD'
    expect(decodeNewlines(encodeNewlines(text))).toBe(text)
  })
})
