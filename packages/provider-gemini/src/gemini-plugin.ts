import { generateText, Output } from 'ai'
import { google } from '@ai-sdk/google'
import type { ITranslationService, TranslationResult, TranslateOptions } from '@chatwork-bot/core'
import { TranslationError } from '@chatwork-bot/core'
import type { ProviderPlugin, ProviderCreateContext } from '@chatwork-bot/core'
import { TranslationSchema, buildTranslationPrompt } from '@chatwork-bot/translation-prompt'

export const GEMINI_MODEL_VALUES = [
  // Gemini 3.1 (Feb 2026)
  'gemini-3.1-pro-preview',
  'gemini-3.1-flash',
  'gemini-3.1-flash-lite',
  // Gemini 3 (Nov 2025, GA)
  'gemini-3-pro-preview',
  'gemini-3-flash',
  // Gemini 2.5 (stable)
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  // Gemini 2.0 (older, still supported)
  'gemini-2.0-flash',
] as const
export type GeminiModel = (typeof GEMINI_MODEL_VALUES)[number]
export const DEFAULT_GEMINI_MODEL: GeminiModel = 'gemini-2.5-pro'

class GeminiTranslationService implements ITranslationService {
  constructor(private readonly modelId: string = DEFAULT_GEMINI_MODEL) {}

  async translate(text: string, options?: TranslateOptions): Promise<TranslationResult> {
    try {
      const { output } = await generateText({
        model: google(this.modelId),
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
    requiredEnvKeys: ['GOOGLE_GENERATIVE_AI_API_KEY'],
  },
  create(ctx: ProviderCreateContext): ITranslationService {
    return new GeminiTranslationService(ctx.modelId)
  },
}
