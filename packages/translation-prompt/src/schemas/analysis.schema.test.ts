import { describe, it, expect } from 'bun:test'
import { AnalysisSchema, SkoposSchema } from './analysis.schema'

describe('SkoposSchema', () => {
  it('parses valid skopos', () => {
    const result = SkoposSchema.parse({
      purpose: 'informational',
      audience: 'Vietnamese tech team',
      strategy: 'instrumental',
      register: 'semi-formal',
    })
    expect(result.strategy).toBe('instrumental')
  })

  it('rejects unknown strategy', () => {
    expect(() =>
      SkoposSchema.parse({
        purpose: 'informational',
        audience: 'team',
        strategy: 'unknown',
        register: 'formal',
      }),
    ).toThrow()
  })
})

const validStructuredHints = {
  sourceProfile: {
    language: 'japanese',
    medium: 'email',
    domain: 'business',
    hasCode: false,
    hasUrl: false,
    hasJapaneseName: false,
    hasSpecialFormatting: false,
  },
  intentLabels: {
    phraseType: 'keigo_request',
    confidence: 'high',
  },
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
    forbidGenderInference: true,
  },
  reviewFocus: ['formula function'],
}

describe('AnalysisSchema', () => {
  const validAnalysis = {
    skopos: {
      purpose: 'technical',
      audience: 'developers',
      strategy: 'instrumental',
      register: 'semi-formal',
    },
    extratextual: {
      sender: 'PM',
      intention: 'request confirmation',
      audience: 'engineer',
      medium: 'chat',
      temporalContext: 'end of sprint',
    },
    intratextual: {
      subjectMatter: 'release schedule',
      contentSummary: 'asking about deploy timing',
      presuppositions: 'reader knows the project',
      textStructure: 'single paragraph request',
      lexisNotes: 'formal Japanese business register',
      nonVerbalElements: 'none',
    },
    crossCutting: {
      textFunction: 'directive',
      registerTone: 'polite formal',
      expectedEffect: 'reader provides confirmation',
    },
    structuredHints: validStructuredHints,
  }

  it('parses a complete valid analysis', () => {
    const result = AnalysisSchema.parse(validAnalysis)
    expect(result.skopos.strategy).toBe('instrumental')
    expect(result.extratextual.sender).toBe('PM')
    expect(result.intratextual.subjectMatter).toBe('release schedule')
    expect(result.crossCutting.textFunction).toBe('directive')
  })

  it('rejects missing extratextual', () => {
    const { extratextual: _, ...without } = validAnalysis
    expect(() => AnalysisSchema.parse(without)).toThrow()
  })

  it('rejects missing structuredHints', () => {
    const { structuredHints: _, ...without } = validAnalysis
    expect(() => AnalysisSchema.parse(without)).toThrow()
  })
})

describe('StructuredHintsSchema', () => {
  it('parses a valid structuredHints payload', () => {
    const fullAnalysis = {
      skopos: {
        purpose: 'technical',
        audience: 'developers',
        strategy: 'instrumental',
        register: 'semi-formal',
      },
      extratextual: {
        sender: 'PM',
        intention: 'request confirmation',
        audience: 'engineer',
        medium: 'chat',
        temporalContext: 'end of sprint',
      },
      intratextual: {
        subjectMatter: 'release schedule',
        contentSummary: 'asking about deploy timing',
        presuppositions: 'reader knows the project',
        textStructure: 'single paragraph request',
        lexisNotes: 'formal Japanese business register',
        nonVerbalElements: 'none',
      },
      crossCutting: {
        textFunction: 'directive',
        registerTone: 'polite formal',
        expectedEffect: 'reader provides confirmation',
      },
      structuredHints: validStructuredHints,
    }
    const result = AnalysisSchema.parse(fullAnalysis)
    expect(result.structuredHints.intentLabels.phraseType).toBe('keigo_request')
    expect(result.structuredHints.intentLabels.confidence).toBe('high')
    expect(result.structuredHints.renderingPolicy.strategy).toBe('functional_vietnamese')
    expect(result.structuredHints.renderingPolicy.targetStyle).toBe('natural_office_vi')
    expect(result.structuredHints.preservationRules.forbidGenderInference).toBe(true)
    expect(result.structuredHints.reviewFocus).toEqual(['formula function'])
  })

  it('rejects invalid phraseType enum value', () => {
    const badHints = {
      ...validStructuredHints,
      intentLabels: { phraseType: 'invalid_phrase_type', confidence: 'high' },
    }
    expect(() =>
      AnalysisSchema.parse({
        skopos: {
          purpose: 'technical',
          audience: 'developers',
          strategy: 'instrumental',
          register: 'semi-formal',
        },
        extratextual: {
          sender: 'PM',
          intention: 'req',
          audience: 'eng',
          medium: 'chat',
          temporalContext: 'now',
        },
        intratextual: {
          subjectMatter: 'x',
          contentSummary: 'x',
          presuppositions: 'x',
          textStructure: 'x',
          lexisNotes: 'x',
          nonVerbalElements: 'x',
        },
        crossCutting: { textFunction: 'x', registerTone: 'x', expectedEffect: 'x' },
        structuredHints: badHints,
      }),
    ).toThrow()
  })

  it('rejects invalid confidence enum value', () => {
    const badHints = {
      ...validStructuredHints,
      intentLabels: { phraseType: 'general_statement', confidence: 'very_high' },
    }
    expect(() =>
      AnalysisSchema.parse({
        skopos: {
          purpose: 'technical',
          audience: 'developers',
          strategy: 'instrumental',
          register: 'semi-formal',
        },
        extratextual: {
          sender: 'PM',
          intention: 'req',
          audience: 'eng',
          medium: 'chat',
          temporalContext: 'now',
        },
        intratextual: {
          subjectMatter: 'x',
          contentSummary: 'x',
          presuppositions: 'x',
          textStructure: 'x',
          lexisNotes: 'x',
          nonVerbalElements: 'x',
        },
        crossCutting: { textFunction: 'x', registerTone: 'x', expectedEffect: 'x' },
        structuredHints: badHints,
      }),
    ).toThrow()
  })

  it('enforces required preservation booleans are present', () => {
    const { preservationRules: _, ...hintsWithoutPreservation } = validStructuredHints
    expect(() =>
      AnalysisSchema.parse({
        skopos: {
          purpose: 'technical',
          audience: 'developers',
          strategy: 'instrumental',
          register: 'semi-formal',
        },
        extratextual: {
          sender: 'PM',
          intention: 'req',
          audience: 'eng',
          medium: 'chat',
          temporalContext: 'now',
        },
        intratextual: {
          subjectMatter: 'x',
          contentSummary: 'x',
          presuppositions: 'x',
          textStructure: 'x',
          lexisNotes: 'x',
          nonVerbalElements: 'x',
        },
        crossCutting: { textFunction: 'x', registerTone: 'x', expectedEffect: 'x' },
        structuredHints: hintsWithoutPreservation,
      }),
    ).toThrow()
  })

  it('rejects invalid renderingPolicy strategy enum value', () => {
    const badHints = {
      ...validStructuredHints,
      renderingPolicy: { ...validStructuredHints.renderingPolicy, strategy: 'literal' },
    }
    expect(() =>
      AnalysisSchema.parse({
        skopos: {
          purpose: 'technical',
          audience: 'developers',
          strategy: 'instrumental',
          register: 'semi-formal',
        },
        extratextual: {
          sender: 'PM',
          intention: 'req',
          audience: 'eng',
          medium: 'chat',
          temporalContext: 'now',
        },
        intratextual: {
          subjectMatter: 'x',
          contentSummary: 'x',
          presuppositions: 'x',
          textStructure: 'x',
          lexisNotes: 'x',
          nonVerbalElements: 'x',
        },
        crossCutting: { textFunction: 'x', registerTone: 'x', expectedEffect: 'x' },
        structuredHints: badHints,
      }),
    ).toThrow()
  })
})
