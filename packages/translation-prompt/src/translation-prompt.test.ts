import { describe, expect, it } from 'bun:test'
import {
  TranslationSchema,
  buildTranslationPrompt,
  buildSystemPrompt,
  buildUserPrompt,
} from './translation-prompt'

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

describe('buildSystemPrompt', () => {
  it('returns a non-empty string', () => {
    expect(buildSystemPrompt().length).toBeGreaterThan(100)
  })

  it('mentions elite translator persona', () => {
    expect(buildSystemPrompt().toLowerCase()).toContain('translator')
  })

  it('mentions vietnamese', () => {
    expect(buildSystemPrompt().toLowerCase()).toContain('vietnamese')
  })

  it('mentions keigo', () => {
    expect(buildSystemPrompt().toLowerCase()).toContain('keigo')
  })

  it('does not contain JSON format spec (that belongs in buildUserPrompt)', () => {
    expect(buildSystemPrompt()).not.toContain('"sourceLang"')
  })

  it('accepts a custom sections array', () => {
    const custom = [{ id: 'test', content: 'Custom section content here' }]
    const result = buildSystemPrompt(custom)
    expect(result).toBe('Custom section content here')
  })

  it('is a pure function — same input always returns same output', () => {
    expect(buildSystemPrompt()).toBe(buildSystemPrompt())
  })
})

describe('buildUserPrompt', () => {
  it('includes the source text', () => {
    const text = 'こんにちは世界'
    expect(buildUserPrompt(text)).toContain(text)
  })

  it('instructs JSON-only output', () => {
    const prompt = buildUserPrompt('test')
    expect(prompt.toLowerCase()).toContain('json')
  })

  it('specifies the required JSON format fields', () => {
    const prompt = buildUserPrompt('test')
    expect(prompt).toContain('"sourceLang"')
    expect(prompt).toContain('"translated"')
  })

  it('instructs no markdown or code block', () => {
    const prompt = buildUserPrompt('test')
    expect(prompt.toLowerCase()).toContain('no markdown')
  })

  it('contains few-shot example with japanese keigo input', () => {
    const prompt = buildUserPrompt('test')
    expect(prompt).toContain('お世話')
  })

  it('contains few-shot example showing IT terms kept in English', () => {
    const prompt = buildUserPrompt('test')
    expect(prompt).toContain('deploy')
    expect(prompt).toContain('staging')
  })

  it('is a pure function — same text always returns same output', () => {
    expect(buildUserPrompt('hello')).toBe(buildUserPrompt('hello'))
  })
})

describe('buildTranslationPrompt backward compat', () => {
  it('still includes the source text', () => {
    expect(buildTranslationPrompt('hello')).toContain('hello')
  })

  it('still mentions vietnamese', () => {
    expect(buildTranslationPrompt('test').toLowerCase()).toContain('vietnamese')
  })

  it('still mentions detecting source language', () => {
    expect(buildTranslationPrompt('test').toLowerCase()).toContain('detect')
  })

  it('composes system + user prompt', () => {
    const full = buildTranslationPrompt('hello')
    const system = buildSystemPrompt()
    const user = buildUserPrompt('hello')
    expect(full).toContain(system)
    expect(full).toContain(user)
  })
})
