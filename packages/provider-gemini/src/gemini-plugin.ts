import { generateText, Output, type FlexibleSchema } from 'ai'
import { google } from '@ai-sdk/google'
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
export const DEFAULT_GEMINI_MODEL: GeminiModel = 'gemini-2.5-pro'
const DEFAULT_GEMINI_TIMEOUT_MS = 1_800_000

function isAbortError(error: unknown): error is Error {
  return error instanceof Error && error.name === 'AbortError'
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
  constructor(private readonly modelId: string = DEFAULT_GEMINI_MODEL) {}

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

  async execute<T>(
    prompts: PromptPair,
    schema: ISchema<T>,
    options?: { signal?: AbortSignal },
  ): Promise<T> {
    const outputSchema = schema as unknown as FlexibleSchema<T>
    const thinking = this.resolveThinking(this.modelId)

    try {
      const { output } = await generateText({
        model: google(this.modelId),
        system: prompts.system,
        prompt: prompts.user,
        output: Output.object({ schema: outputSchema }),
        temperature: 0,
        maxOutputTokens: 4000,
        ...(thinking ? { providerOptions: thinking } : {}),
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
    defaultModel: DEFAULT_GEMINI_MODEL,
    capabilities: { streaming: false },
    timeoutMs: DEFAULT_GEMINI_TIMEOUT_MS,
    requiredEnvKeys: ['GOOGLE_GENERATIVE_AI_API_KEY'],
  },
  create(ctx: ProviderCreateContext): ILLMExecutor {
    return new GeminiExecutor(ctx.modelId)
  },
}
