import { describe, it, expect } from 'bun:test'
import { buildSingleCallPrompts, TranslationDraftSchema } from './translation-prompt'

describe('buildSingleCallPrompts', () => {
  it('returns PromptPair with system and user strings', () => {
    const result = buildSingleCallPrompts('テスト')
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
  })

  it('embeds source text in user prompt', () => {
    const text = 'お世話になっております。'
    const result = buildSingleCallPrompts(text)
    expect(result.user).toContain(text)
  })

  it('user prompt instructs JSON-only output', () => {
    const result = buildSingleCallPrompts('テスト')
    expect(result.user).toContain('JSON')
    expect(result.user).toContain('sourceLang')
    expect(result.user).toContain('translated')
  })

  it('system prompt contains expert persona', () => {
    const result = buildSingleCallPrompts('テスト')
    expect(result.system).toMatch(/20 years|elite.*translator|professional translator/i)
  })

  it('system prompt contains Vietnamese as target language', () => {
    const result = buildSingleCallPrompts('テスト')
    expect(result.system.toLowerCase()).toContain('vietnamese')
  })

  it('system prompt contains keigo register mapping', () => {
    const result = buildSingleCallPrompts('テスト')
    expect(result.system).toContain('Keigo')
    expect(result.system).toContain('敬語')
  })

  it('system prompt contains business formula rendering rules', () => {
    const result = buildSingleCallPrompts('お世話になっております')
    expect(result.system).toMatch(/functional Vietnamese|email formula|do not translate literally/i)
  })

  it('system prompt forbids gender inference from names', () => {
    const result = buildSingleCallPrompts('田中さん')
    expect(result.system).toMatch(/forbid.*gender|gender.*inference|do not.*anh.*chị|no.*gender/i)
  })

  it('system prompt contains humanizer anti-machine-translation rules', () => {
    const result = buildSingleCallPrompts('テスト')
    expect(result.system).toMatch(/không chỉ.*mà còn|machine.translation|DO NOT write/i)
  })

  it('system prompt contains hard constraints', () => {
    const result = buildSingleCallPrompts('テスト')
    expect(result.system).toMatch(/Hard Constraints|Do NOT add translator notes/i)
  })

  it('system prompt contains self-critique gate instruction', () => {
    const result = buildSingleCallPrompts('テスト')
    expect(result.system).toMatch(/natural flow|cultural fidelity|semantic accuracy/i)
  })

  it('system prompt contains IT/business terms to keep in English', () => {
    const result = buildSingleCallPrompts('テスト')
    expect(result.system).toMatch(/deploy|sprint|release/i)
  })
})

describe('TranslationDraftSchema', () => {
  it('parses valid draft', () => {
    const result = TranslationDraftSchema.parse({ sourceLang: 'Japanese', translated: 'Xin chào' })
    expect(result.sourceLang).toBe('Japanese')
  })

  it('rejects empty translated', () => {
    expect(() => TranslationDraftSchema.parse({ sourceLang: 'Japanese', translated: '' })).toThrow()
  })
})
