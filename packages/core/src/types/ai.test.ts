import { describe, expect, it } from 'bun:test'
import { toAIProvider } from './ai'

describe('toAIProvider', () => {
  it('returns the same string value', () => {
    const provider = toAIProvider('gemini')
    expect(provider as string).toBe('gemini')
  })

  it('works with any string', () => {
    expect(toAIProvider('openai') as string).toBe('openai')
    expect(toAIProvider('groq') as string).toBe('groq')
  })
})
