import { generateText, Output } from 'ai'
import { openai } from '@ai-sdk/openai'
import type { ITranslationService, TranslationResult } from '../interfaces/translation'
import { TranslationError } from '../interfaces/translation'
import { TranslationSchema, buildTranslationPrompt } from './translation-prompt'

export class OpenAITranslationService implements ITranslationService {
  constructor(private readonly modelId = 'gpt-4o') {}

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
        originalText: text,
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
