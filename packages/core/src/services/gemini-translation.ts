import { generateText, Output } from 'ai'
import { google } from '@ai-sdk/google'
import type { ITranslationService, TranslationResult } from '~/interfaces/translation'
import { TranslationError } from '~/interfaces/translation'
import { TranslationSchema, buildTranslationPrompt } from './translation-prompt'
import type { GeminiModel } from '~/types/ai'
import { DEFAULT_GEMINI_MODEL } from '~/types/ai'

export class GeminiTranslationService implements ITranslationService {
  constructor(private readonly modelId: GeminiModel = DEFAULT_GEMINI_MODEL) {}

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
