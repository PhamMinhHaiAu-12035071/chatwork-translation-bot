import { describe, expect, it } from 'bun:test'
import { buildTranslationPrompt, TranslationSchema } from './translation-prompt'

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
