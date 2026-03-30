import type { TranslationStyle } from '~/types/translation-style'
import type { ILLMExecutor } from './llm-executor'

export interface ProviderCreateContext {
  modelId: string
  apiKey?: string
  baseUrl?: string
  translationStyle?: TranslationStyle
}

export interface ProviderManifest {
  readonly id: string
  readonly supportedModels: readonly string[]
  readonly defaultModel: string
  readonly capabilities: {
    readonly streaming: boolean
  }
  readonly timeoutMs?: number
}

export interface ProviderPlugin {
  readonly manifest: ProviderManifest
  create(ctx: ProviderCreateContext): ILLMExecutor
}
