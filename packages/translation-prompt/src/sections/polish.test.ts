import { describe, it, expect } from 'bun:test'
import { POLISH_SYSTEM, buildPolishStyleSection } from './polish'

describe('POLISH_SYSTEM', () => {
  it('contains polish persona', () => {
    expect(POLISH_SYSTEM).toMatch(/native Vietnamese editor|translationese/i)
  })

  it('contains anti-translationese checklist', () => {
    expect(POLISH_SYSTEM).toMatch(/mirror.*source.*structure|Sino-Vietnamese|passive voice/i)
  })

  it('contains polish constraints', () => {
    expect(POLISH_SYSTEM).toMatch(/Do NOT change|do not.*change meaning/i)
  })

  it('instructs to keep good drafts unchanged', () => {
    expect(POLISH_SYSTEM).toMatch(/already good|do not change for the sake of changing/i)
  })
})

describe('buildPolishStyleSection', () => {
  it('includes NATURAL_CASUAL polish criteria', () => {
    const section = buildPolishStyleSection('NATURAL_CASUAL')
    expect(section).toMatch(/Zalo|colleague|conversational/i)
  })

  it('includes PROFESSIONAL_BUSINESS polish criteria', () => {
    const section = buildPolishStyleSection('PROFESSIONAL_BUSINESS')
    expect(section).toMatch(/PM|email|professional/i)
  })

  it('includes TECHNICAL polish criteria', () => {
    const section = buildPolishStyleSection('TECHNICAL')
    expect(section).toMatch(/terminology|precision|fluff/i)
  })
})
