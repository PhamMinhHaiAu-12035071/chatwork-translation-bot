import { describe, it, expect } from 'bun:test'
import {
  buildAnalysisPrompts,
  buildTranslationPrompts,
  buildReviewPrompts,
  TranslationDraftSchema,
} from './translation-prompt'
import type { AnalysisResult } from './schemas/analysis.schema'

const fakeAnalysis: AnalysisResult = {
  skopos: {
    purpose: 'informational',
    audience: 'Vietnamese engineer',
    strategy: 'instrumental',
    register: 'semi-formal',
  },
  extratextual: {
    sender: 'PM',
    intention: 'request deploy status',
    audience: 'engineer',
    medium: 'chat',
    temporalContext: 'end of sprint',
  },
  intratextual: {
    subjectMatter: 'deployment',
    contentSummary: 'asking for deploy timing confirmation',
    presuppositions: 'reader knows the project timeline',
    textStructure: 'single paragraph',
    lexisNotes: 'business Japanese sonkeigo register',
    nonVerbalElements: 'none',
  },
  crossCutting: {
    textFunction: 'directive',
    registerTone: 'polite-formal',
    expectedEffect: 'reader confirms deploy schedule',
  },
  structuredHints: {
    sourceProfile: {
      language: 'japanese',
      medium: 'chat',
      domain: 'business',
      hasCode: false,
      hasUrl: false,
      hasJapaneseName: false,
      hasSpecialFormatting: false,
    },
    intentLabels: { phraseType: 'general_statement', confidence: 'high' },
    renderingPolicy: {
      strategy: 'functional_vietnamese',
      targetStyle: 'natural_office_vi',
      preserveAmbiguity: false,
      allowNaturalAdaptation: true,
      avoidLiteralFormulaTranslation: true,
    },
    preservationRules: {
      preserveUrl: false,
      preserveCode: false,
      preserveUnits: false,
      preserveChatworkMarkup: false,
      preserveJapaneseNameScript: false,
      allowRomajiGloss: false,
      forbidGenderInference: false,
    },
    reviewFocus: [],
  },
}

describe('buildAnalysisPrompts', () => {
  it('returns PromptPair', () => {
    const result = buildAnalysisPrompts('テスト')
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
  })

  it('embeds source text in user prompt', () => {
    const text = 'お世話になっております。'
    const result = buildAnalysisPrompts(text)
    expect(result.user).toContain(text)
  })
})

describe('buildTranslationPrompts', () => {
  it('returns PromptPair', () => {
    const result = buildTranslationPrompts('テスト', fakeAnalysis)
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
  })

  it('embeds source text in user prompt', () => {
    const text = 'リリースの件でご確認をお願いしたく'
    const result = buildTranslationPrompts(text, fakeAnalysis)
    expect(result.user).toContain(text)
  })

  it('embeds skopos strategy in user prompt', () => {
    const result = buildTranslationPrompts('test', fakeAnalysis)
    expect(result.user).toContain('instrumental')
  })

  it('system prompt mentions Vietnamese as target language', () => {
    const result = buildTranslationPrompts('test', fakeAnalysis)
    expect(result.system.toLowerCase()).toContain('vietnamese')
  })

  it('translation prompt includes structured hints block', () => {
    const result = buildTranslationPrompts('テスト', fakeAnalysis)
    expect(result.user).toContain('Structured Hints')
  })

  it('translation prompt includes phrase type from intentLabels', () => {
    const result = buildTranslationPrompts('テスト', fakeAnalysis)
    expect(result.user).toContain('general_statement')
  })

  it('translation prompt includes preservation rules', () => {
    const result = buildTranslationPrompts('テスト', fakeAnalysis)
    expect(result.user).toContain('preserveJapaneseNameScript')
  })

  it('translation prompt includes rendering policy avoidLiteralFormulaTranslation', () => {
    const result = buildTranslationPrompts('テスト', fakeAnalysis)
    expect(result.user).toContain('avoidLiteralFormulaTranslation')
  })
})

describe('Japanese formula and name rules in system prompt', () => {
  it('system prompt instructs formulaic Japanese to be rendered functionally', () => {
    const result = buildTranslationPrompts('お世話になっております', fakeAnalysis)
    expect(result.system).toMatch(/functional Vietnamese|email formula|do not translate literally/i)
  })

  it('system prompt forbids auto-inserting fixed Vietnamese phrases unless source carries that meaning', () => {
    const result = buildTranslationPrompts('よろしくお願いいたします', fakeAnalysis)
    expect(result.system).toMatch(
      /do not.*insert|forbid.*insert|unless.*source|communicative function/i,
    )
  })

  it('system prompt does not contain rigid word-to-word mapping for よろしくお願いいたします', () => {
    const result = buildTranslationPrompts('よろしくお願いいたします', fakeAnalysis)
    expect(result.system).not.toContain('よろしくお願いいたします → ')
  })

  it('system prompt instructs Japanese names to stay in original Japanese script', () => {
    const result = buildTranslationPrompts('田中さん', fakeAnalysis)
    expect(result.system).toMatch(
      /Japanese.*name.*original.*script|preserve.*name.*script|name.*Japanese.*script/i,
    )
  })

  it('system prompt allows romaji gloss only when allowRomajiGloss is set', () => {
    const result = buildTranslationPrompts('田中さん', fakeAnalysis)
    expect(result.system).toMatch(/romaji.*gloss|allowRomajiGloss/i)
  })

  it('system prompt defines first-mention inline romaji gloss with parentheses for readability', () => {
    const result = buildTranslationPrompts('田中さん', fakeAnalysis)
    expect(result.system).toMatch(
      /first mention|first occurrence|田中さん \(Tanaka\)|inline.*parentheses/i,
    )
  })

  it('system prompt forbids Tanaka-san as the default gloss format', () => {
    const result = buildTranslationPrompts('田中さん', fakeAnalysis)
    expect(result.system).toMatch(/do not use.*Tanaka-san|not.*Tanaka-san.*default/i)
  })

  it('system prompt discourages keeping raw さん on Latin or Vietnamese-readable names', () => {
    const result = buildTranslationPrompts('Thanhさん', fakeAnalysis)
    expect(result.system).toMatch(/Thanhさん|Latin|Vietnamese.*readable|do not retain raw.*さん/i)
  })

  it('system prompt forbids gender inference from names', () => {
    const result = buildTranslationPrompts('田中さん', fakeAnalysis)
    expect(result.system).toMatch(/forbid.*gender|gender.*inference|do not.*anh.*chị|no.*gender/i)
  })

  it('structured hints explain allowRomajiGloss as a first-mention inline readability aid', () => {
    const result = buildTranslationPrompts('田中さん', fakeAnalysis)
    expect(result.user).toContain('allowRomajiGloss')
    expect(result.user).toMatch(/first-mention|inline gloss|readability/i)
  })
})

describe('buildReviewPrompts', () => {
  it('returns PromptPair with round number', () => {
    const result = buildReviewPrompts('original', fakeAnalysis, 'draft vi', 1)
    expect(result.user).toContain('1')
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
