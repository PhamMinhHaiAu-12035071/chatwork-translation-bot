import { generateText, Output } from 'ai'
import { openai } from '@ai-sdk/openai'
import type { ITranslationService, TranslationResult } from '@chatwork-bot/core'
import { TranslationError, OPENAI_MODEL_VALUES, DEFAULT_OPENAI_MODEL } from '@chatwork-bot/core'
import type { ProviderPlugin, ProviderCreateContext } from '@chatwork-bot/core'
import { TranslationSchema, buildTranslationPrompt } from '@chatwork-bot/translation-prompt'

class OpenAITranslationService implements ITranslationService {
  constructor(private readonly modelId: string = DEFAULT_OPENAI_MODEL) {}

  async translate(text: string): Promise<TranslationResult> {
    try {
      const { output } = await generateText({
        model: openai(this.modelId),
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
        `OpenAI API call failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        'API_ERROR',
        cause,
      )
    }
  }
}

export const openaiPlugin: ProviderPlugin = {
  manifest: {
    id: 'openai',
    supportedModels: OPENAI_MODEL_VALUES,
    defaultModel: DEFAULT_OPENAI_MODEL,
    capabilities: { streaming: false },
  },
  create(ctx: ProviderCreateContext): ITranslationService {
    return new OpenAITranslationService(ctx.modelId)
  },
}
