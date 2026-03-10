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
}

describe('buildReviewPrompts', () => {
  it('returns PromptPair with system and user fields', () => {
    const prompts = buildReviewPrompts('original text', fakeAnalysis, 'draft vi', 1)
    expect(typeof prompts.system).toBe('string')
    expect(typeof prompts.user).toBe('string')
  })

  it('user prompt contains the original text', () => {
    const prompts = buildReviewPrompts('original text', fakeAnalysis, 'draft vi', 1)
    expect((prompts.user as string)).toContain('original text')
  })

  it('user prompt contains the current draft', () => {
    const prompts = buildReviewPrompts('original text', fakeAnalysis, 'bản dịch hiện tại', 1)
    expect((prompts.user as string)).toContain('bản dịch hiện tại')
  })

  it('system prompt includes all 3 persona names', () => {
    const prompts = buildReviewPrompts('test', fakeAnalysis, 'draft', 1)
    expect((prompts.system as string)).toContain('Fresh Reader')
    expect((prompts.system as string)).toContain('Linguist')
    expect((prompts.system as string)).toContain('Tuổi Trẻ')
  })

  it('system prompt includes all 5 MQM-Lite axes', () => {
    const prompts = buildReviewPrompts('test', fakeAnalysis, 'draft', 1)
    expect((prompts.system as string)).toContain('naturalFlow')
    expect((prompts.system as string)).toContain('culturalFidelity')
    expect((prompts.system as string)).toContain('readerExperience')
    expect((prompts.system as string)).toContain('semanticAccuracy')
    expect((prompts.system as string)).toContain('targetConventions')
  })

  it('includes round number in user prompt', () => {
    const prompts = buildReviewPrompts('test', fakeAnalysis, 'draft', 3)
    expect((prompts.user as string)).toContain('3')
  })

  it('includes escalated note when escalated=true', () => {
    const prompts = buildReviewPrompts('test', fakeAnalysis, 'draft', 4, true)
    expect((prompts.system as string)).toMatch(/escalat/i)
  })
})
