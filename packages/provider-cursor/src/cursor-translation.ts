import { generateText, Output } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { ITranslationService, TranslationResult } from '@chatwork-bot/core'
import { TranslationError } from '@chatwork-bot/core'
import { TranslationSchema, buildTranslationPrompt } from '@chatwork-bot/translation-prompt'

export class CursorTranslationService implements ITranslationService {
  private readonly provider: ReturnType<typeof createOpenAICompatible>

  constructor(
    private readonly modelId: string,
    private readonly baseUrl: string,
  ) {
    this.provider = createOpenAICompatible({
      name: 'cursor',
      baseURL: baseUrl,
    })
  }

  async translate(text: string): Promise<TranslationResult> {
    try {
      const { output } = await generateText({
        model: this.provider(this.modelId),
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
        `Cursor API call failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        'API_ERROR',
        cause,
      )
    }
  }
}
