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
      'gpt-5.4',
      'gpt-5.2',
      'gpt-5.1',
      'gpt-5-mini',
      'gpt-4.1',
    ])
    expect(providerModule.PROVIDER_MODELS.gemini.map((model) => model.value)).toEqual([
      'gemini-3.1-pro-preview',
      'gemini-3.1-flash-lite-preview',
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
    ])
    expect(providerModule.TRANSLATION_STYLE_LABELS.TECHNICAL).toBe('Technical')
  })
})
