import { generateText, Output } from 'ai'
import { openai } from '@ai-sdk/openai'
import type { ITranslationService, TranslationResult, TranslateOptions } from '@chatwork-bot/core'
import { TranslationError } from '@chatwork-bot/core'
import type { ProviderPlugin, ProviderCreateContext } from '@chatwork-bot/core'
import { TranslationSchema, buildTranslationPrompt } from '@chatwork-bot/translation-prompt'

export const OPENAI_MODEL_VALUES = [
  // GPT-5.x (2026 frontier)
  'gpt-5.4',
  'gpt-5.4-pro',
  'gpt-5.2',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-5.3-codex',
  // GPT-4.1 (still widely used)
  'gpt-4.1',
  'gpt-4.1-mini',
  // GPT-4o (deprecated in ChatGPT but API still available)
  'gpt-4o',
  'gpt-4o-mini',
] as const
export type OpenAIModel = (typeof OPENAI_MODEL_VALUES)[number]
export const DEFAULT_OPENAI_MODEL: OpenAIModel = 'gpt-5.4'

class OpenAITranslationService implements ITranslationService {
  constructor(private readonly modelId: string = DEFAULT_OPENAI_MODEL) {}

  async translate(text: string, options?: TranslateOptions): Promise<TranslationResult> {
    try {
      const { output } = await generateText({
        model: openai(this.modelId),
        output: Output.object({ schema: TranslationSchema }),
        prompt: buildTranslationPrompt(text),
        temperature: 0,
        maxOutputTokens: 1200,
        ...(options?.signal && { abortSignal: options.signal }),
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
    requiredEnvKeys: ['OPENAI_API_KEY'],
  },
  create(ctx: ProviderCreateContext): ITranslationService {
    return new OpenAITranslationService(ctx.modelId)
  },
}
