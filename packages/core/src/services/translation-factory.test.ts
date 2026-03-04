import { describe, expect, it } from 'bun:test'
import { TranslationServiceFactory } from './translation-factory'
import { GeminiTranslationService } from './gemini-translation'
import { OpenAITranslationService } from './openai-translation'

describe('TranslationServiceFactory', () => {
  it('creates GeminiTranslationService for gemini provider', () => {
    const service = TranslationServiceFactory.create('gemini')
    expect(service).toBeInstanceOf(GeminiTranslationService)
  })

  it('creates OpenAITranslationService for openai provider', () => {
    const service = TranslationServiceFactory.create('openai')
    expect(service).toBeInstanceOf(OpenAITranslationService)
  })

  it('passes modelOverride to GeminiTranslationService', () => {
    const service = TranslationServiceFactory.create('gemini', 'gemini-2.0-flash')
    expect(service).toBeInstanceOf(GeminiTranslationService)
  })

  it('passes modelOverride to OpenAITranslationService', () => {
    const service = TranslationServiceFactory.create('openai', 'gpt-4o-mini')
    expect(service).toBeInstanceOf(OpenAITranslationService)
  })
})
