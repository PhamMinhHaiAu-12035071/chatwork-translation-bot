import { beforeAll, describe, expect, it, mock } from 'bun:test'
import type { GeminiTranslationService as GeminiTranslationServiceType } from './gemini-translation'

// Mock BEFORE importing the module under test
void mock.module('ai', () => ({
  generateText: mock(() =>
    Promise.resolve({
      output: { sourceLang: 'en', translated: 'Xin chào thế giới' },
    }),
  ),
  Output: {
    object: mock((config: unknown) => config),
  },
}))

void mock.module('@ai-sdk/google', () => ({
  google: mock((_modelId: string) => ({ provider: 'google', modelId: _modelId })),
}))

describe('GeminiTranslationService', () => {
  let GeminiTranslationService: typeof GeminiTranslationServiceType

  beforeAll(async () => {
    const mod = await import('./gemini-translation')
    GeminiTranslationService = mod.GeminiTranslationService
  })

  it('translates text and returns TranslationResult', async () => {
    const service = new GeminiTranslationService()
    const result = await service.translate('Hello World')

    expect(result.originalText).toBe('Hello World')
    expect(result.translatedText).toBe('Xin chào thế giới')
    expect(result.sourceLang).toBe('en')
    expect(result.targetLang).toBe('vi')
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('uses default model gemini-2.5-pro when no modelId given', async () => {
    const { google } = await import('@ai-sdk/google')
    const service = new GeminiTranslationService()
    await service.translate('test')
    expect(google).toHaveBeenCalledWith('gemini-2.5-pro')
  })

  it('uses custom modelId when provided', async () => {
    const { google } = await import('@ai-sdk/google')
    const service = new GeminiTranslationService('gemini-2.0-flash')
    await service.translate('test')
    expect(google).toHaveBeenCalledWith('gemini-2.0-flash')
  })
})
