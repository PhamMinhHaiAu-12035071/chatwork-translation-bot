import type { ITranslationService } from '../interfaces/translation'
import type { AIProvider, GeminiModel, OpenAIModel } from '../types/ai'
import { DEFAULT_GEMINI_MODEL, DEFAULT_OPENAI_MODEL } from '../types/ai'
import { GeminiTranslationService } from './gemini-translation'
import { OpenAITranslationService } from './openai-translation'

interface ITranslationServiceFactory {
  create(provider: 'gemini', modelOverride?: GeminiModel): ITranslationService
  create(provider: 'openai', modelOverride?: OpenAIModel): ITranslationService
  create(provider: AIProvider, modelOverride?: string): ITranslationService
}

export const TranslationServiceFactory: ITranslationServiceFactory = {
  create(provider: AIProvider, modelOverride?: string): ITranslationService {
    if (provider === 'gemini') {
      return new GeminiTranslationService(
        (modelOverride as GeminiModel | undefined) ?? DEFAULT_GEMINI_MODEL,
      )
    }
    return new OpenAITranslationService(
      (modelOverride as OpenAIModel | undefined) ?? DEFAULT_OPENAI_MODEL,
    )
  },
}
