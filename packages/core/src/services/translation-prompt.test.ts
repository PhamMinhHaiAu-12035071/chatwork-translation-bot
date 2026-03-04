import { describe, expect, it } from 'bun:test'
import { buildTranslationPrompt, TranslationSchema } from './translation-prompt'

describe('buildTranslationPrompt', () => {
  it('includes the original text in the prompt', () => {
    const prompt = buildTranslationPrompt('Hello World')
    expect(prompt).toContain('Hello World')
  })

  it('mentions natural, human-readable Vietnamese output', () => {
    const prompt = buildTranslationPrompt('any text')
    expect(prompt).toContain('natural, human-readable Vietnamese')
  })

  it('mentions idiomatic prose phrasing', () => {
    const prompt = buildTranslationPrompt('text')
    expect(prompt).toContain('reads like prose written by a native speaker')
  })

  it('instructs AI to preserve paragraph breaks as best-effort', () => {
    const prompt = buildTranslationPrompt('text')
    expect(prompt).toContain('Preserve paragraph breaks (blank lines)')
  })

  it('allows smoothing single line breaks for readability', () => {
    const prompt = buildTranslationPrompt('text')
    expect(prompt).toContain('may be smoothed for better readability')
  })

  it('does not mention [[NL]] tokens', () => {
    const prompt = buildTranslationPrompt('text')
    expect(prompt).not.toContain('[[NL]]')
  })

  it('instructs AI to return full language name', () => {
    const prompt = buildTranslationPrompt('text')
    expect(prompt).toContain('full English name')
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
