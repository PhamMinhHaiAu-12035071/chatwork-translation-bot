import { describe, it, expect } from 'bun:test'
import { buildAnalysisPrompts } from './analysis'

describe('buildAnalysisPrompts', () => {
  it('returns a PromptPair with system and user fields', () => {
    const prompts = buildAnalysisPrompts('Hello world')
    expect(typeof prompts.system).toBe('string')
    expect(typeof prompts.user).toBe('string')
  })

  it('embeds the source text in the user prompt', () => {
    const text = 'こんにちは、お世話になっております。'
    const prompts = buildAnalysisPrompts(text)
    expect(prompts.user as string).toContain(text)
  })

  it('system prompt contains all 5 extratextual dimension names', () => {
    const prompts = buildAnalysisPrompts('test')
    expect((prompts.system as string)).toContain('sender')
    expect((prompts.system as string)).toContain('intention')
    expect((prompts.system as string)).toContain('audience')
    expect((prompts.system as string)).toContain('medium')
    expect((prompts.system as string)).toContain('temporalContext')
  })

  it('system prompt contains all 6 intratextual dimension names', () => {
    const prompts = buildAnalysisPrompts('test')
    expect((prompts.system as string)).toContain('subjectMatter')
    expect((prompts.system as string)).toContain('contentSummary')
    expect((prompts.system as string)).toContain('presuppositions')
    expect((prompts.system as string)).toContain('textStructure')
    expect((prompts.system as string)).toContain('lexisNotes')
    expect((prompts.system as string)).toContain('nonVerbalElements')
  })

  it('system prompt contains all 3 cross-cutting dimension names', () => {
    const prompts = buildAnalysisPrompts('test')
    expect((prompts.system as string)).toContain('textFunction')
    expect((prompts.system as string)).toContain('registerTone')
    expect((prompts.system as string)).toContain('expectedEffect')
  })

  it('system prompt describes all 4 skopos fields', () => {
    const prompts = buildAnalysisPrompts('test')
    expect((prompts.system as string)).toContain('instrumental')
    expect((prompts.system as string)).toContain('documentary')
    expect((prompts.system as string)).toContain('formal')
  })

  it('user prompt instructs to output JSON only', () => {
    const prompts = buildAnalysisPrompts('test')
    expect((prompts.user as string).toLowerCase()).toContain('json')
  })
})
