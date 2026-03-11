import { generateText } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { ILLMExecutor, PromptPair, ISchema } from '@chatwork-bot/core'
import { TranslationError } from '@chatwork-bot/core'
import { extractJsonFromText } from './extract-json'

export class CursorExecutor implements ILLMExecutor {
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

  async execute<T>(
    prompts: PromptPair,
    schema: ISchema<T>,
    options?: { signal?: AbortSignal },
  ): Promise<T> {
    let rawText: string
    try {
      const result = await generateText({
        model: this.provider(this.modelId),
        system: prompts.system,
        prompt: prompts.user,
        ...(options?.signal && { abortSignal: options.signal }),
      })
      rawText = result.text
    } catch (cause) {
      const isAbort = cause instanceof Error && cause.name === 'AbortError'
      throw new TranslationError(
        `Cursor API call failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        isAbort ? 'TIMEOUT' : 'API_ERROR',
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

    try {
      return schema.parse(json)
    } catch (cause) {
      throw new TranslationError(
        `Invalid Cursor response schema: ${cause instanceof Error ? cause.message : String(cause)}`,
        'INVALID_RESPONSE',
        cause,
      )
    }
  }
}
