import { describe, expect, it } from 'bun:test'
import {
  AI_PROVIDER_VALUES,
  GEMINI_MODEL_VALUES,
  OPENAI_MODEL_VALUES,
  CURSOR_MODEL_VALUES,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_CURSOR_MODEL,
} from './ai'

describe('AI type domains', () => {
  it('AI_PROVIDER_VALUES includes cursor, gemini, openai', () => {
    expect(AI_PROVIDER_VALUES).toContain('cursor')
    expect(AI_PROVIDER_VALUES).toContain('gemini')
    expect(AI_PROVIDER_VALUES).toContain('openai')
  })

  it('GEMINI_MODEL_VALUES includes default', () => {
    expect(GEMINI_MODEL_VALUES.length).toBeGreaterThan(0)
    expect(GEMINI_MODEL_VALUES).toContain(DEFAULT_GEMINI_MODEL)
  })

  it('OPENAI_MODEL_VALUES includes default', () => {
    expect(OPENAI_MODEL_VALUES.length).toBeGreaterThan(0)
    expect(OPENAI_MODEL_VALUES).toContain(DEFAULT_OPENAI_MODEL)
  })

  it('CURSOR_MODEL_VALUES includes all core cursor models', () => {
    expect(CURSOR_MODEL_VALUES).toContain('claude-sonnet-4-5')
    expect(CURSOR_MODEL_VALUES).toContain('claude-sonnet-4-6')
    expect(CURSOR_MODEL_VALUES).toContain('gpt-4o')
    expect(CURSOR_MODEL_VALUES).toContain('cursor-small')
  })

  it('DEFAULT_CURSOR_MODEL is claude-sonnet-4-5', () => {
    expect(DEFAULT_CURSOR_MODEL).toBe('claude-sonnet-4-5')
  })

  it('all defaults are included in their respective model value arrays', () => {
    expect(GEMINI_MODEL_VALUES).toContain(DEFAULT_GEMINI_MODEL)
    expect(OPENAI_MODEL_VALUES).toContain(DEFAULT_OPENAI_MODEL)
    expect(CURSOR_MODEL_VALUES).toContain(DEFAULT_CURSOR_MODEL)
  })
})
