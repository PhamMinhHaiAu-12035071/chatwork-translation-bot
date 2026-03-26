import { describe, expect, it } from 'bun:test'

describe('provider model metadata', () => {
  it('exposes provider labels, models, and translation style labels used by the forms', async () => {
    const providerModule = await import('~/lib/provider-models').catch(() => null)

    expect(providerModule).not.toBeNull()
    if (!providerModule) {
      return
    }

    expect(providerModule.PROVIDER_LABELS.openai).toBe('OpenAI')
    expect(providerModule.PROVIDER_LABELS.gemini).toBe('Google Gemini')
    expect(providerModule.PROVIDER_MODELS.openai.map((model) => model.value)).toEqual([
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
    ])
    expect(providerModule.PROVIDER_MODELS.gemini.map((model) => model.value)).toEqual([
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-2.0-flash',
    ])
    expect(providerModule.TRANSLATION_STYLE_LABELS.TECHNICAL).toBe('Technical')
  })
})
