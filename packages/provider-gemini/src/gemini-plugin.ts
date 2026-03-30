import { generateText, Output, type FlexibleSchema } from 'ai'
import { createGoogleGenerativeAI, google } from '@ai-sdk/google'
import type { ILLMExecutor, PromptPair, ISchema } from '@chatwork-bot/core'
import { TranslationError } from '@chatwork-bot/core'
import type { ProviderPlugin, ProviderCreateContext } from '@chatwork-bot/core'

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
const DEFAULT_GEMINI_TIMEOUT_MS = 1_800_000
const DEFAULT_MAX_OUTPUT_TOKENS = 4000

function isAbortError(error: unknown): error is Error {
  return error instanceof Error && error.name === 'AbortError'
}

function resolveTemperature(style?: ProviderCreateContext['translationStyle']): number {
  switch (style) {
    case 'NATURAL_CASUAL':
      return 0.35
    case 'PROFESSIONAL_BUSINESS':
      return 0.15
    case 'TECHNICAL':
    default:
      return 0
  }
}

// Module-level export — used by index.ts for startup banner (avoids regex duplication)
export function supportsThinking(modelId: string): boolean {
  return (
    modelId.startsWith('gemini-3.') ||
    modelId.startsWith('gemini-3-') ||
    modelId.startsWith('gemini-2.5')
  )
}

class GeminiExecutor implements ILLMExecutor {
  private readonly provider: ReturnType<typeof createGoogleGenerativeAI>

  constructor(
    private readonly modelId: string,
    apiKey?: string,
    private readonly translationStyle?: ProviderCreateContext['translationStyle'],
  ) {
    this.provider = apiKey !== undefined ? createGoogleGenerativeAI({ apiKey }) : google
  }

  private resolveThinking(
    modelId: string,
  ): NonNullable<Parameters<typeof generateText>[0]['providerOptions']> | null {
    type PO = NonNullable<Parameters<typeof generateText>[0]['providerOptions']>
    if (modelId.startsWith('gemini-3.') || modelId.startsWith('gemini-3-')) {
      return { google: { thinkingConfig: { thinkingLevel: 'medium' } } } as PO
    }
    if (modelId.startsWith('gemini-2.5')) {
      return { google: { thinkingConfig: { thinkingBudget: 8192 } } } as PO
    }
    return null
  }

  describeExecution() {
    return {
      generation: {
        temperature: resolveTemperature(this.translationStyle),
        maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
        providerOptions: this.resolveThinking(this.modelId),
        providerManaged: false,
      },
    }
  }

  async execute<T>(
    prompts: PromptPair,
    schema: ISchema<T>,
    options?: { signal?: AbortSignal },
  ): Promise<T> {
    const outputSchema = schema as unknown as FlexibleSchema<T>
    const execution = this.describeExecution()

    try {
      const { output } = await generateText({
        model: this.provider(this.modelId),
        system: prompts.system,
        prompt: prompts.user,
        output: Output.object({ schema: outputSchema }),
        temperature: execution.generation.temperature,
        maxOutputTokens: execution.generation.maxOutputTokens,
        ...(execution.generation.providerOptions
          ? { providerOptions: execution.generation.providerOptions }
          : {}),
        ...(options?.signal && { abortSignal: options.signal }),
      })
      return output
    } catch (cause) {
      if (isAbortError(cause)) {
        if (options?.signal?.reason instanceof TranslationError) {
          throw options.signal.reason
        }

        throw new TranslationError('Gemini API call aborted', 'ABORTED', cause)
      }

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
    defaultModel: 'gemini-3.1-pro-preview',
    capabilities: { streaming: false },
    timeoutMs: DEFAULT_GEMINI_TIMEOUT_MS,
  },
  create(ctx: ProviderCreateContext): ILLMExecutor {
    return new GeminiExecutor(ctx.modelId, ctx.apiKey, ctx.translationStyle)
  },
}
