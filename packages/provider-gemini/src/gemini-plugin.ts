import { generateText, Output } from 'ai'
import { google } from '@ai-sdk/google'
import type { ITranslationService, TranslationResult } from '@chatwork-bot/core'
import { TranslationError, GEMINI_MODEL_VALUES, DEFAULT_GEMINI_MODEL } from '@chatwork-bot/core'
import type { ProviderPlugin, ProviderCreateContext } from '@chatwork-bot/core'
import { TranslationSchema, buildTranslationPrompt } from '@chatwork-bot/translation-prompt'

class GeminiTranslationService implements ITranslationService {
  constructor(private readonly modelId: string = DEFAULT_GEMINI_MODEL) {}

  async translate(text: string): Promise<TranslationResult> {
    try {
      const { output } = await generateText({
        model: google(this.modelId),
        output: Output.object({ schema: TranslationSchema }),
        prompt: buildTranslationPrompt(text),
        temperature: 0,
        maxOutputTokens: 1200,
      })
      return {
        cleanText: text,
        translatedText: output.translated,
        sourceLang: output.sourceLang,
        targetLang: 'Vietnamese',
        timestamp: new Date().toISOString(),
      }
    } catch (cause) {
      throw new TranslationError(
        `Gemini API call failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        'API_ERROR',
        cause,
      )
    }
  }
}

export const geminiPlugin: ProviderPlugin = {
  manifest: {
    id: 'gemini',
    supportedModels: GEMINI_MODEL_VALUES,
    defaultModel: DEFAULT_GEMINI_MODEL,
    capabilities: { streaming: false },
  },
  create(ctx: ProviderCreateContext): ITranslationService {
    return new GeminiTranslationService(ctx.modelId)
  },
}
