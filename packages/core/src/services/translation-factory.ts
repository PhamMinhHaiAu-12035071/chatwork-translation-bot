import type { ITranslationService } from '../interfaces/translation'
import { GeminiTranslationService } from './gemini-translation'
import { OpenAITranslationService } from './openai-translation'

export type AIProvider = 'gemini' | 'openai'

export const TranslationServiceFactory = {
  create(provider: AIProvider, modelOverride?: string): ITranslationService {
    if (provider === 'gemini') {
      return new GeminiTranslationService(modelOverride ?? 'gemini-2.5-pro')
    }
    return new OpenAITranslationService(modelOverride ?? 'gpt-4o')
  },
}
