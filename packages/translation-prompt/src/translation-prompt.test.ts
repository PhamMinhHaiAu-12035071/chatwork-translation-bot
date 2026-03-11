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
