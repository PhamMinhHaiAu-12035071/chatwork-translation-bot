import { describe, expect, it } from 'bun:test'
import {
  buildSingleCallPrompts,
  buildStructuredTranslationPrompts,
  StructuredTranslationDraftSchema,
  TRANSLATION_PROMPT_BUILD_ID,
  TranslationDraftSchema,
} from './translation-prompt'

describe('buildSingleCallPrompts', () => {
  it('returns PromptPair with system and user strings', () => {
    const result = buildSingleCallPrompts('テスト', 'PROFESSIONAL_BUSINESS')
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
  })

  it('wraps the source text in TRANSLATE_TEXT tags', () => {
    const text = 'お世話になっております。'
    const result = buildSingleCallPrompts(text, 'PROFESSIONAL_BUSINESS')

    expect(result.user).toContain('<TRANSLATE_TEXT>')
    expect(result.user).toContain('</TRANSLATE_TEXT>')
    expect(result.user).toContain(text)
  })

  it('user prompt instructs JSON-only output', () => {
    const result = buildSingleCallPrompts('テスト', 'PROFESSIONAL_BUSINESS')
    expect(result.user).toContain('JSON')
    expect(result.user).toContain('sourceLang')
    expect(result.user).toContain('translated')
  })

  it('system prompt is reasonable size — under 5000 chars for any style', () => {
    for (const style of ['NATURAL_CASUAL', 'PROFESSIONAL_BUSINESS', 'TECHNICAL'] as const) {
      const result = buildSingleCallPrompts('テスト', style)
      expect(result.system.length).toBeLessThan(5000)
    }
  })

  it('uses a short translator-first identity anchor', () => {
    const result = buildSingleCallPrompts('Please check this by Friday.', 'PROFESSIONAL_BUSINESS')
    expect(result.system).toMatch(/You are a translator/i)
  })

  it('includes translation doctrine', () => {
    const result = buildSingleCallPrompts('テスト', 'PROFESSIONAL_BUSINESS')
    expect(result.system).toContain('## Translation Doctrine')
  })

  it('includes Japanese source rules', () => {
    const result = buildSingleCallPrompts('テスト', 'PROFESSIONAL_BUSINESS')
    expect(result.system).toContain('## Japanese Source Rules')
  })

  it('includes English source rules', () => {
    const result = buildSingleCallPrompts('Test', 'PROFESSIONAL_BUSINESS')
    expect(result.system).toContain('## English Source Rules')
  })

  it('includes security rules', () => {
    const result = buildSingleCallPrompts('テスト', 'PROFESSIONAL_BUSINESS')
    expect(result.system).toContain('## Output & Security Rules')
  })

  it('includes active style section', () => {
    const result = buildSingleCallPrompts('テスト', 'PROFESSIONAL_BUSINESS')
    expect(result.system).toContain('## Active Style: PROFESSIONAL_BUSINESS')
  })

  it('includes romanization examples', () => {
    const result = buildSingleCallPrompts('山田太郎さん', 'PROFESSIONAL_BUSINESS')
    expect(result.system).toContain('Sasaki-san')
    expect(result.system).toContain('Hepburn')
  })

  it('includes company romanization examples', () => {
    const result = buildSingleCallPrompts('テスト', 'PROFESSIONAL_BUSINESS')
    expect(result.system).toContain('DExpert Kihon-bu')
  })
})

describe('buildStructuredTranslationPrompts', () => {
  it('returns PromptPair for multi-segment inputs', () => {
    const result = buildStructuredTranslationPrompts(
      ['テスト1', 'テスト2'],
      'PROFESSIONAL_BUSINESS',
    )
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
  })

  it('wraps segments in TRANSLATE_SEGMENTS tags', () => {
    const segments = ['Hello', 'World']
    const result = buildStructuredTranslationPrompts(segments, 'PROFESSIONAL_BUSINESS')
    expect(result.user).toContain('<TRANSLATE_SEGMENTS>')
    expect(result.user).toContain('</TRANSLATE_SEGMENTS>')
    expect(result.user).toContain(JSON.stringify(segments, null, 2))
  })

  it('instructs to preserve array order and length', () => {
    const result = buildStructuredTranslationPrompts(['A', 'B'], 'PROFESSIONAL_BUSINESS')
    expect(result.user).toMatch(/Preserve array order/i)
  })

  it('includes full message context when provided', () => {
    const fullContext = 'This is the full original message.'
    const result = buildStructuredTranslationPrompts(
      ['segment 1', 'segment 2'],
      'PROFESSIONAL_BUSINESS',
      fullContext,
    )
    expect(result.user).toContain('<MESSAGE_CONTEXT>')
    expect(result.user).toContain(fullContext)
    expect(result.user).toContain('</MESSAGE_CONTEXT>')
  })

  it('omits MESSAGE_CONTEXT block when fullMessageContext is undefined', () => {
    const result = buildStructuredTranslationPrompts(
      ['segment 1', 'segment 2'],
      'PROFESSIONAL_BUSINESS',
      undefined,
    )
    expect(result.user).not.toContain('<MESSAGE_CONTEXT>')
  })
})

describe('roomContext injection', () => {
  it('omits ## Room Context section when roomContext is undefined', () => {
    const result = buildSingleCallPrompts('テスト', 'PROFESSIONAL_BUSINESS', undefined)
    expect(result.system).not.toContain('## Room Context')
  })

  it('includes ## Room Context section when roomContext is provided', () => {
    const roomContext = 'Team members: Alice (Senior), Bob (Junior)'
    const result = buildSingleCallPrompts('テスト', 'PROFESSIONAL_BUSINESS', roomContext)
    expect(result.system).toContain('## Room Context')
    expect(result.system).toContain(roomContext)
  })
})

describe('roomContext policy guidance', () => {
  it('treats room context as optional structured or unstructured guidance', () => {
    const result = buildSingleCallPrompts(
      '確認お願いします',
      'PROFESSIONAL_BUSINESS',
      'Tanaka Taro / 田中太郎 (PM, male)',
    )

    expect(result.system).toContain('structured or unstructured notes')
    expect(result.system).toContain('only when clearly stated')
    expect(result.system).toContain('translate conservatively')
  })

  it('prefers a Latin alias over the original Japanese name when both are present', () => {
    const result = buildSingleCallPrompts(
      '田中太郎さん、確認お願いします',
      'PROFESSIONAL_BUSINESS',
      'Tanaka Taro / 田中太郎 (PM, male)',
    )

    expect(result.system).toContain('prefer the Latin alias')
    expect(result.system).toContain('Japanese name only as a matching anchor')
  })

  it('forbids forced romanization when no trusted alias is provided', () => {
    const result = buildSingleCallPrompts(
      '田中太郎さん、確認お願いします',
      'PROFESSIONAL_BUSINESS',
      '田中太郎 (PM, male)',
    )

    expect(result.system).toContain('do not invent a romanized form')
  })
})

describe('mention hint injection', () => {
  it('injects MENTION_CONTEXT block in single call prompt when mentionHint provided', () => {
    const result = buildSingleCallPrompts(
      'お疲れ様です',
      'NATURAL_CASUAL',
      undefined,
      undefined,
      'Directly addressed to 1 person: AuPMH. Use singular address (anh/chị/bạn).',
    )
    expect(result.user).toContain('<MENTION_CONTEXT>')
    expect(result.user).toContain('Directly addressed to 1 person: AuPMH')
    expect(result.user).toContain('</MENTION_CONTEXT>')
    const mentionIdx = result.user.indexOf('<MENTION_CONTEXT>')
    const translateIdx = result.user.indexOf('<TRANSLATE_TEXT>')
    expect(mentionIdx).toBeLessThan(translateIdx)
  })

  it('does NOT inject MENTION_CONTEXT when mentionHint is undefined', () => {
    const result = buildSingleCallPrompts('お疲れ様です', 'NATURAL_CASUAL')
    expect(result.user).not.toContain('<MENTION_CONTEXT>')
  })

  it('injects MENTION_CONTEXT block in structured prompt when mentionHint provided', () => {
    const result = buildStructuredTranslationPrompts(
      ['Segment 1', 'Segment 2'],
      'NATURAL_CASUAL',
      'Full context',
      undefined,
      undefined,
      'Addressed to all room members. Use plural address (mọi người/các anh chị).',
    )
    expect(result.user).toContain('<MENTION_CONTEXT>')
    expect(result.user).toContain('all room members')
    expect(result.user).toContain('</MENTION_CONTEXT>')
    const mentionIdx = result.user.indexOf('<MENTION_CONTEXT>')
    const translateIdx = result.user.indexOf('<TRANSLATE_SEGMENTS>')
    expect(mentionIdx).toBeLessThan(translateIdx)
  })

  it('does NOT inject MENTION_CONTEXT in structured prompt when mentionHint is undefined', () => {
    const result = buildStructuredTranslationPrompts(
      ['Segment 1'],
      'NATURAL_CASUAL',
      'Full context',
    )
    expect(result.user).not.toContain('<MENTION_CONTEXT>')
  })
})

describe('keywordSystemHint injection', () => {
  it('includes keyword system hint when provided', () => {
    const hint = 'Protected keywords: SECRET_KEY, API_TOKEN'
    const result = buildSingleCallPrompts('テスト', 'PROFESSIONAL_BUSINESS', undefined, hint)
    expect(result.system).toContain(hint)
  })

  it('omits keyword hint when undefined', () => {
    const result = buildSingleCallPrompts('テスト', 'PROFESSIONAL_BUSINESS', undefined, undefined)
    expect(result.system.split('\n\n').filter((s) => s.trim()).length).toBeGreaterThan(3)
  })
})

describe('schema validation', () => {
  it('TranslationDraftSchema validates correct output', () => {
    const valid = { sourceLang: 'Japanese', translated: 'Xin chào' }
    expect(() => TranslationDraftSchema.parse(valid)).not.toThrow()
  })

  it('StructuredTranslationDraftSchema validates correct output', () => {
    const valid = { sourceLang: 'English', translatedSegments: ['Xin chào', 'Cảm ơn'] }
    expect(() => StructuredTranslationDraftSchema.parse(valid)).not.toThrow()
  })
})

describe('TRANSLATION_PROMPT_BUILD_ID', () => {
  it('is defined and non-empty', () => {
    expect(TRANSLATION_PROMPT_BUILD_ID).toBeTruthy()
    expect(typeof TRANSLATION_PROMPT_BUILD_ID).toBe('string')
  })
})

describe('buildSingleCallPrompts - Japanese Romanization Integration', () => {
  it('should include JAPANESE_RULES in system prompt', () => {
    const result = buildSingleCallPrompts('テスト', 'PROFESSIONAL_BUSINESS')
    expect(result.system).toContain('## Japanese Source Rules')
    expect(result.system).toContain('Romanization')
  })
})
