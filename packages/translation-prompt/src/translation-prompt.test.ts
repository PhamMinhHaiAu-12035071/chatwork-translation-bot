import { describe, it, expect } from 'bun:test'
import {
  buildSingleCallPrompts,
  buildStructuredTranslationPrompts,
  StructuredTranslationDraftSchema,
  TranslationDraftSchema,
} from './translation-prompt'

describe('buildSingleCallPrompts', () => {
  it('returns PromptPair with system and user strings', () => {
    const result = buildSingleCallPrompts('テスト', 'PROFESSIONAL_BUSINESS')
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
  })

  it('embeds source text in user prompt', () => {
    const text = 'お世話になっております。'
    const result = buildSingleCallPrompts(text, 'PROFESSIONAL_BUSINESS')
    expect(result.user).toContain(text)
  })

  it('user prompt instructs JSON-only output', () => {
    const result = buildSingleCallPrompts('テスト', 'PROFESSIONAL_BUSINESS')
    expect(result.user).toContain('JSON')
    expect(result.user).toContain('sourceLang')
    expect(result.user).toContain('translated')
  })

  it('system prompt contains expert persona', () => {
    const result = buildSingleCallPrompts('テスト', 'PROFESSIONAL_BUSINESS')
    expect(result.system).toMatch(/20 years|elite.*translator|professional translator/i)
  })

  it('system prompt contains Vietnamese as target language', () => {
    const result = buildSingleCallPrompts('テスト', 'PROFESSIONAL_BUSINESS')
    expect(result.system.toLowerCase()).toContain('vietnamese')
  })

  it('system prompt contains keigo register mapping', () => {
    const result = buildSingleCallPrompts('テスト', 'PROFESSIONAL_BUSINESS')
    expect(result.system).toContain('Keigo')
    expect(result.system).toContain('敬語')
  })

  it('system prompt contains business formula rendering rules', () => {
    const result = buildSingleCallPrompts('お世話になっております', 'PROFESSIONAL_BUSINESS')
    expect(result.system).toMatch(/functional Vietnamese|email formula|do not translate literally/i)
  })

  it('system prompt forbids gender inference from names', () => {
    const result = buildSingleCallPrompts('田中さん', 'PROFESSIONAL_BUSINESS')
    expect(result.system).toMatch(/forbid.*gender|gender.*inference|do not.*anh.*chị|no.*gender/i)
  })

  it('system prompt contains humanizer anti-machine-translation rules', () => {
    const result = buildSingleCallPrompts('テスト', 'PROFESSIONAL_BUSINESS')
    expect(result.system).toMatch(/không chỉ.*mà còn|machine.translation|DO NOT write/i)
  })

  it('system prompt contains hard constraints', () => {
    const result = buildSingleCallPrompts('テスト', 'PROFESSIONAL_BUSINESS')
    expect(result.system).toMatch(/Hard Constraints|Do NOT add translator notes/i)
  })

  it('system prompt contains self-critique gate instruction', () => {
    const result = buildSingleCallPrompts('テスト', 'PROFESSIONAL_BUSINESS')
    expect(result.system).toMatch(/natural flow|cultural fidelity|semantic accuracy/i)
  })

  it('system prompt contains IT/business terms to keep in English', () => {
    const result = buildSingleCallPrompts('テスト', 'PROFESSIONAL_BUSINESS')
    expect(result.system).toMatch(/deploy|sprint|release/i)
  })

  it('injects the active style block into single-call prompts', () => {
    const result = buildSingleCallPrompts('テスト', 'TECHNICAL')
    expect(result.system).toContain('Active Translation Style')
    expect(result.system).toContain('TECHNICAL')
    expect(result.system).toMatch(/technical precision|terminology consistency/i)
  })

  it('keeps fidelity-first wording inside the style policy', () => {
    const result = buildSingleCallPrompts('テスト', 'NATURAL_CASUAL')
    expect(result.system).toMatch(/preserve fidelity|source meaning|politeness intent/i)
  })
})

describe('buildStructuredTranslationPrompts', () => {
  it('returns PromptPair with system and user strings', () => {
    const result = buildStructuredTranslationPrompts(['一つ目', '二つ目'], 'PROFESSIONAL_BUSINESS')
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
  })

  it('embeds source segments in user prompt', () => {
    const segments = ['お世話になっております。', '資料をご確認ください。']
    const result = buildStructuredTranslationPrompts(segments, 'PROFESSIONAL_BUSINESS')

    for (const segment of segments) {
      expect(result.user).toContain(segment)
    }
  })

  it('instructs the model to preserve array length and order', () => {
    const result = buildStructuredTranslationPrompts(['一つ目', '二つ目'], 'PROFESSIONAL_BUSINESS')
    expect(result.user).toMatch(/preserve.*length.*order|do not merge|do not reorder/i)
    expect(result.user).toContain('translatedSegments')
  })

  it('instructs JSON-only output with translatedSegments', () => {
    const result = buildStructuredTranslationPrompts(['テスト'], 'PROFESSIONAL_BUSINESS')
    expect(result.user).toContain('JSON')
    expect(result.user).toContain('sourceLang')
    expect(result.user).toContain('translatedSegments')
  })

  it('injects the active style block into structured prompts', () => {
    const result = buildStructuredTranslationPrompts(['一つ目'], 'NATURAL_CASUAL')
    expect(result.system).toContain('Active Translation Style')
    expect(result.system).toContain('NATURAL_CASUAL')
  })
})

describe('translation style profiles', () => {
  it('defines stable profile content for all three presets', async () => {
    const { TRANSLATION_STYLE_PROFILES } = await import('~/sections/translation-style-profiles')

    expect(TRANSLATION_STYLE_PROFILES.NATURAL_CASUAL).toMatchObject({
      name: 'Natural / Casual',
    })
    expect(TRANSLATION_STYLE_PROFILES.PROFESSIONAL_BUSINESS).toMatchObject({
      name: 'Professional / Business',
    })
    expect(TRANSLATION_STYLE_PROFILES.TECHNICAL).toMatchObject({
      name: 'Technical',
    })
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

describe('StructuredTranslationDraftSchema', () => {
  it('parses valid structured translation draft', () => {
    const result = StructuredTranslationDraftSchema.parse({
      sourceLang: 'Japanese',
      translatedSegments: ['Xin chào', 'Vui lòng xem tài liệu.'],
    })
    expect(result.sourceLang).toBe('Japanese')
    expect(result.translatedSegments).toEqual(['Xin chào', 'Vui lòng xem tài liệu.'])
  })

  it('rejects an empty translatedSegments array', () => {
    expect(() =>
      StructuredTranslationDraftSchema.parse({
        sourceLang: 'Japanese',
        translatedSegments: [],
      }),
    ).toThrow()
  })
})
