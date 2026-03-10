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
})
