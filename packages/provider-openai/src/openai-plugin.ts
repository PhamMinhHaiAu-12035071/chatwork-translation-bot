import { generateText, Output } from 'ai'
import { openai } from '@ai-sdk/openai'
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
export const DEFAULT_OPENAI_MODEL: OpenAIModel = 'gpt-5.4'

class OpenAIExecutor implements ILLMExecutor {
  constructor(private readonly modelId: string = DEFAULT_OPENAI_MODEL) {}

  async execute<T>(
    prompts: PromptPair,
    schema: ISchema<T>,
    options?: { signal?: AbortSignal },
  ): Promise<T> {
    try {
      const { output } = await generateText({
        model: openai(this.modelId),
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
    defaultModel: DEFAULT_OPENAI_MODEL,
    capabilities: { streaming: false },
    requiredEnvKeys: ['OPENAI_API_KEY'],
  },
  create(ctx: ProviderCreateContext): ILLMExecutor {
    return new OpenAIExecutor(ctx.modelId)
  },
}
