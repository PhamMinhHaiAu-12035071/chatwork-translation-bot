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
    expect(prompts.user).toContain(text)
  })

  it('system prompt contains all 5 extratextual dimension names', () => {
    const prompts = buildAnalysisPrompts('test')
    expect(prompts.system).toContain('sender')
    expect(prompts.system).toContain('intention')
    expect(prompts.system).toContain('audience')
    expect(prompts.system).toContain('medium')
    expect(prompts.system).toContain('temporalContext')
  })

  it('system prompt contains all 6 intratextual dimension names', () => {
    const prompts = buildAnalysisPrompts('test')
    expect(prompts.system).toContain('subjectMatter')
    expect(prompts.system).toContain('contentSummary')
    expect(prompts.system).toContain('presuppositions')
    expect(prompts.system).toContain('textStructure')
    expect(prompts.system).toContain('lexisNotes')
    expect(prompts.system).toContain('nonVerbalElements')
  })

  it('system prompt contains all 3 cross-cutting dimension names', () => {
    const prompts = buildAnalysisPrompts('test')
    expect(prompts.system).toContain('textFunction')
    expect(prompts.system).toContain('registerTone')
    expect(prompts.system).toContain('expectedEffect')
  })

  it('system prompt describes all 4 skopos fields', () => {
    const prompts = buildAnalysisPrompts('test')
    expect(prompts.system).toContain('instrumental')
    expect(prompts.system).toContain('documentary')
    expect(prompts.system).toContain('formal')
  })

  it('user prompt instructs to output JSON only', () => {
    const prompts = buildAnalysisPrompts('test')
    expect(prompts.user.toLowerCase()).toContain('json')
  })

  it('system prompt requires structuredHints output', () => {
    const prompts = buildAnalysisPrompts('テスト')
    expect(prompts.system).toContain('structuredHints')
  })

  it('system prompt mentions preserve-sensitive fragments', () => {
    const prompts = buildAnalysisPrompts('https://api.example.com')
    expect(prompts.system).toMatch(/preserve|URL|code|unit/i)
  })

  it('system prompt instructs preserveAmbiguity rendering as slash-separated options', () => {
    const prompts = buildAnalysisPrompts('すみません')
    expect(prompts.system).toMatch(/preserveAmbiguity|slash-separated|ambiguous utterance/i)
  })

  it('system prompt documents formula classification phraseType labels', () => {
    const prompts = buildAnalysisPrompts('test')
    expect(prompts.system).toContain('phraseType')
  })
})
