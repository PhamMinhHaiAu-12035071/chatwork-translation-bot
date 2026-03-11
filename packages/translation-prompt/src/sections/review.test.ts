import { describe, it, expect } from 'bun:test'
import { buildReviewPrompts } from './review'
import type { AnalysisResult } from '~/schemas/analysis.schema'

const fakeAnalysis: AnalysisResult = {
  skopos: {
    purpose: 'informational',
    audience: 'Vietnamese engineer',
    strategy: 'instrumental',
    register: 'semi-formal',
  },
  extratextual: {
    sender: 'PM',
    intention: 'request status',
    audience: 'developer',
    medium: 'chat',
    temporalContext: 'end of day',
  },
  intratextual: {
    subjectMatter: 'deployment',
    contentSummary: 'asking deploy status',
    presuppositions: 'reader knows the project',
    textStructure: 'single paragraph',
    lexisNotes: 'standard business Japanese',
    nonVerbalElements: 'none',
  },
  crossCutting: {
    textFunction: 'directive',
    registerTone: 'polite formal',
    expectedEffect: 'reader provides status update',
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

describe('buildReviewPrompts', () => {
  it('returns PromptPair with system and user fields', () => {
    const prompts = buildReviewPrompts('original text', fakeAnalysis, 'draft vi', 1)
    expect(typeof prompts.system).toBe('string')
    expect(typeof prompts.user).toBe('string')
  })

  it('user prompt contains the original text', () => {
    const prompts = buildReviewPrompts('original text', fakeAnalysis, 'draft vi', 1)
    expect(prompts.user).toContain('original text')
  })

  it('user prompt contains the current draft', () => {
    const prompts = buildReviewPrompts('original text', fakeAnalysis, 'bản dịch hiện tại', 1)
    expect(prompts.user).toContain('bản dịch hiện tại')
  })

  it('system prompt includes all 3 persona names', () => {
    const prompts = buildReviewPrompts('test', fakeAnalysis, 'draft', 1)
    expect(prompts.system).toContain('Fresh Reader')
    expect(prompts.system).toContain('Linguist')
    expect(prompts.system).toContain('Tuổi Trẻ')
  })

  it('system prompt includes all 5 MQM-Lite axes', () => {
    const prompts = buildReviewPrompts('test', fakeAnalysis, 'draft', 1)
    expect(prompts.system).toContain('naturalFlow')
    expect(prompts.system).toContain('culturalFidelity')
    expect(prompts.system).toContain('readerExperience')
    expect(prompts.system).toContain('semanticAccuracy')
    expect(prompts.system).toContain('targetConventions')
  })

  it('includes round number in user prompt', () => {
    const prompts = buildReviewPrompts('test', fakeAnalysis, 'draft', 3)
    expect(prompts.user).toContain('3')
  })

  it('includes escalated note when escalated=true', () => {
    const prompts = buildReviewPrompts('test', fakeAnalysis, 'draft', 4, true)
    expect(prompts.system).toMatch(/escalat/i)
  })

  it('review prompt includes structured hints block', () => {
    const prompts = buildReviewPrompts('test', fakeAnalysis, 'draft', 1)
    expect(prompts.user).toContain('Structured Hints')
  })

  it('review prompt includes preservationRules field name', () => {
    const prompts = buildReviewPrompts('original', fakeAnalysis, 'draft', 1)
    expect(prompts.user).toContain('preserveJapaneseNameScript')
  })

  it('review prompt includes rendering strategy', () => {
    const prompts = buildReviewPrompts('test', fakeAnalysis, 'draft', 1)
    expect(prompts.user).toContain('functional_vietnamese')
  })
})
