import { generateText } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { ILLMExecutor, PromptPair, ISchema } from '@chatwork-bot/core'
import { TranslationError } from '@chatwork-bot/core'
import { extractJsonFromText } from './extract-json'
import { withRetry } from './retry'

export class CursorExecutor implements ILLMExecutor {
  private readonly provider: ReturnType<typeof createOpenAICompatible>

  constructor(
    private readonly modelId: string,
    private readonly baseUrl: string,
    private readonly sleepFn: (ms: number) => Promise<void> = Bun.sleep,
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
    const json = await withRetry(
      async () => {
        const rawText = await (async () => {
          try {
            const result = await generateText({
              model: this.provider(this.modelId),
              system: prompts.system,
              prompt: prompts.user,
              ...(options?.signal && { abortSignal: options.signal }),
            })
            return result.text
          } catch (cause) {
            const isAbort = cause instanceof Error && cause.name === 'AbortError'
            throw new TranslationError(
              `Cursor API call failed: ${cause instanceof Error ? cause.message : String(cause)}`,
              isAbort ? 'TIMEOUT' : 'API_ERROR',
              cause,
            )
          }
        })()

        try {
          return extractJsonFromText(rawText)
        } catch (cause) {
          throw new TranslationError(
            `No JSON in Cursor response: ${cause instanceof Error ? cause.message : String(cause)}`,
            'API_ERROR',
            cause,
          )
        }
      },
      { ...(options?.signal && { signal: options.signal }), sleepFn: this.sleepFn },
    )

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

  describeExecution() {
    return {
      generation: {
        temperature: null,
        maxOutputTokens: null,
        providerOptions: null,
        providerManaged: true,
      },
    }
  }
}
