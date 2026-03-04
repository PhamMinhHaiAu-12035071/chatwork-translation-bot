import { beforeAll, describe, expect, it, mock } from 'bun:test'
import type { OpenAITranslationService as OpenAITranslationServiceType } from './openai-translation'

void mock.module('ai', () => ({
  generateText: mock(() =>
    Promise.resolve({
      output: { sourceLang: 'Japanese', translated: 'おはようございます、世界！' },
    }),
  ),
  Output: {
    object: mock((config: unknown) => config),
  },
}))

void mock.module('@ai-sdk/openai', () => ({
  openai: mock((_modelId: string) => ({ provider: 'openai', modelId: _modelId })),
}))

describe('OpenAITranslationService', () => {
  let OpenAITranslationService: typeof OpenAITranslationServiceType

  beforeAll(async () => {
    const mod = await import('./openai-translation')
    OpenAITranslationService = mod.OpenAITranslationService
  })

  it('translates text and returns TranslationResult', async () => {
    const service = new OpenAITranslationService()
    const result = await service.translate('おはようございます、世界！')

    expect(result.originalText).toBe('おはようございます、世界！')
    expect(result.sourceLang).toBe('Japanese')
    expect(result.targetLang).toBe('Vietnamese')
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('uses default model gpt-4o when no modelId given', async () => {
    const { openai } = await import('@ai-sdk/openai')
    const service = new OpenAITranslationService()
    await service.translate('test')
    expect(openai).toHaveBeenCalledWith('gpt-4o')
  })

  it('uses custom modelId when provided', async () => {
    const { openai } = await import('@ai-sdk/openai')
    const service = new OpenAITranslationService('gpt-4o-mini')
    await service.translate('test')
    expect(openai).toHaveBeenCalledWith('gpt-4o-mini')
  })
})
