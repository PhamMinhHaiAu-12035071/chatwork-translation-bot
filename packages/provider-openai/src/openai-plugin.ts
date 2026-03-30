import { generateText, Output } from 'ai'
import { createOpenAI, openai } from '@ai-sdk/openai'
import type { ILLMExecutor, PromptPair, ISchema } from '@chatwork-bot/core'
import { TranslationError } from '@chatwork-bot/core'
import type { ProviderPlugin, ProviderCreateContext } from '@chatwork-bot/core'

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
const DEFAULT_OPENAI_TIMEOUT_MS = 1_800_000
const DEFAULT_MAX_OUTPUT_TOKENS = 4000

function isAbortError(error: unknown): error is Error {
  return error instanceof Error && error.name === 'AbortError'
}

function resolveTemperature(style?: ProviderCreateContext['translationStyle']): number {
  switch (style) {
    case 'NATURAL_CASUAL':
      return 0.55
    case 'PROFESSIONAL_BUSINESS':
      return 0.15
    case 'TECHNICAL':
    default:
      return 0
  }
}

// Module-level export — used by index.ts for startup banner (avoids regex duplication)
export function supportsThinking(modelId: string): boolean {
  return /^(gpt-5|o1|o3|o4)/.test(modelId)
}

class OpenAIExecutor implements ILLMExecutor {
  private readonly provider: ReturnType<typeof createOpenAI>

  constructor(
    private readonly modelId: string,
    private readonly apiKey?: string,
    private readonly baseUrl?: string,
    private readonly translationStyle?: ProviderCreateContext['translationStyle'],
  ) {
    this.provider =
      apiKey !== undefined || baseUrl !== undefined
        ? createOpenAI({
            ...(apiKey !== undefined ? { apiKey } : {}),
            ...(baseUrl !== undefined ? { baseURL: baseUrl } : {}),
          })
        : openai
  }

  private resolveThinking(
    modelId: string,
    style?: ProviderCreateContext['translationStyle'],
  ): Record<string, Record<string, string>> | null {
    if (!supportsThinking(modelId)) return null
    const effort =
      style === 'NATURAL_CASUAL'
        ? 'low'
        : ((process.env['OPENAI_REASONING_EFFORT'] ?? 'medium') as 'low' | 'medium' | 'high')
    return { openai: { reasoningEffort: effort } }
  }

  describeExecution() {
    return {
      generation: {
        temperature: resolveTemperature(this.translationStyle),
        maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
        providerOptions: this.resolveThinking(this.modelId, this.translationStyle),
        providerManaged: false,
      },
    }
  }

  async execute<T>(
    prompts: PromptPair,
    schema: ISchema<T>,
    options?: { signal?: AbortSignal },
  ): Promise<T> {
    try {
      const execution = this.describeExecution()
      const { output } = await generateText({
        model: this.provider(this.modelId),
        system: prompts.system,
        prompt: prompts.user,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
        output: Output.object({ schema: schema as any }),
        temperature: execution.generation.temperature,
        maxOutputTokens: execution.generation.maxOutputTokens,
        ...(execution.generation.providerOptions
          ? { providerOptions: execution.generation.providerOptions }
          : {}),
        ...(options?.signal && { abortSignal: options.signal }),
      })
      return output as T
    } catch (cause) {
      if (isAbortError(cause)) {
        if (options?.signal?.reason instanceof TranslationError) {
          throw options.signal.reason
        }

        throw new TranslationError('OpenAI API call aborted', 'ABORTED', cause)
      }

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
    defaultModel: 'gpt-5.4-pro',
    capabilities: { streaming: false },
    timeoutMs: DEFAULT_OPENAI_TIMEOUT_MS,
  },
  create(ctx: ProviderCreateContext): ILLMExecutor {
    return new OpenAIExecutor(ctx.modelId, ctx.apiKey, ctx.baseUrl, ctx.translationStyle)
  },
}
