import { generateText } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { ITranslationService, TranslationResult, TranslateOptions } from '@chatwork-bot/core'
import { TranslationError } from '@chatwork-bot/core'
import { TranslationSchema, buildTranslationPrompt } from '@chatwork-bot/translation-prompt'
import { extractJsonFromText } from './extract-json'

const JSON_FORMAT_INSTRUCTION = `

IMPORTANT: Respond ONLY with a valid JSON object. No markdown, no code blocks, no explanation.
The JSON must have exactly these fields:
{"sourceLang": "<detected language name in English>", "translated": "<Vietnamese translation>"}`

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

  async translate(text: string, options?: TranslateOptions): Promise<TranslationResult> {
    let rawText: string
    try {
      const result = await generateText({
        model: this.provider(this.modelId),
        prompt: buildTranslationPrompt(text) + JSON_FORMAT_INSTRUCTION,
        ...(options?.signal && { abortSignal: options.signal }),
      })
      rawText = result.text
    } catch (cause) {
      throw new TranslationError(
        `Cursor API call failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        'API_ERROR',
        cause,
      )
    }

    let json: unknown
    try {
      json = extractJsonFromText(rawText)
    } catch (cause) {
      throw new TranslationError(
        `No JSON in Cursor response: ${cause instanceof Error ? cause.message : String(cause)}`,
        'API_ERROR',
        cause,
      )
    }

    const result = TranslationSchema.safeParse(json)
    if (!result.success) {
      throw new TranslationError(
        `Invalid Cursor response schema: ${result.error.message}`,
        'INVALID_RESPONSE',
        result.error,
      )
    }

    return {
      cleanText: text,
      translatedText: result.data.translated,
      sourceLang: result.data.sourceLang,
      targetLang: 'Vietnamese',
      timestamp: new Date().toISOString(),
    }
  }
}
