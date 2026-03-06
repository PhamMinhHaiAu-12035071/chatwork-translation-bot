import { describe, expect, it } from 'bun:test'
import { TranslationSchema, buildTranslationPrompt } from './translation-prompt'

describe('buildTranslationPrompt', () => {
  it('includes the source text in the prompt', () => {
    const text = 'Hello World'
    const prompt = buildTranslationPrompt(text)
    expect(prompt).toContain(text)
  })

  it('mentions Vietnamese as the target language', () => {
    const prompt = buildTranslationPrompt('test')
    expect(prompt.toLowerCase()).toContain('vietnamese')
  })

  it('mentions detecting the source language', () => {
    const prompt = buildTranslationPrompt('test')
    expect(prompt.toLowerCase()).toContain('detect')
  })
})

describe('TranslationSchema', () => {
  it('parses a valid object', () => {
    const result = TranslationSchema.parse({ sourceLang: 'English', translated: 'Xin chào' })
    expect(result.sourceLang).toBe('English')
    expect(result.translated).toBe('Xin chào')
  })

  it('rejects an empty translated string', () => {
    expect(() => TranslationSchema.parse({ sourceLang: 'English', translated: '' })).toThrow()
  })

  it('rejects a missing sourceLang', () => {
    expect(() => TranslationSchema.parse({ translated: 'Xin chào' })).toThrow()
  })

  it('rejects a sourceLang shorter than 2 chars', () => {
    expect(() => TranslationSchema.parse({ sourceLang: 'E', translated: 'Xin chào' })).toThrow()
  })

  it('accepts a sourceLang up to 50 chars', () => {
    const lang = 'A'.repeat(50)
    expect(() => TranslationSchema.parse({ sourceLang: lang, translated: 'ok' })).not.toThrow()
  })
})
