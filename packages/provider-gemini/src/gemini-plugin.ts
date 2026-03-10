import { generateText, Output } from 'ai'
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

class GeminiExecutor implements ILLMExecutor {
  constructor(private readonly modelId: string = DEFAULT_GEMINI_MODEL) {}

  async execute<T>(
    prompts: PromptPair,
    schema: ISchema<T>,
    options?: { signal?: AbortSignal },
  ): Promise<T> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { output } = await generateText({
        model: google(this.modelId),
        system: prompts.system,
        prompt: prompts.user,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        output: Output.object({ schema: schema as any }),
        temperature: 0,
        maxOutputTokens: 4000,
        ...(options?.signal && { abortSignal: options.signal }),
      })
      return output as T
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
  create(ctx: ProviderCreateContext): ILLMExecutor {
    return new GeminiExecutor(ctx.modelId)
  },
}
