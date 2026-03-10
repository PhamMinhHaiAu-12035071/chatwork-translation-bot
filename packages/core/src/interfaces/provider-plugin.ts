import type { ILLMExecutor } from './llm-executor'

export interface ProviderCreateContext {
  modelId: string
  baseUrl?: string
}

export interface ProviderManifest {
  readonly id: string
  readonly supportedModels: readonly string[]
  readonly defaultModel: string
  readonly capabilities: {
    readonly streaming: boolean
  }
  readonly timeoutMs?: number
  readonly requiredEnvKeys: readonly string[]
}

export interface ProviderPlugin {
  readonly manifest: ProviderManifest
  create(ctx: ProviderCreateContext): ILLMExecutor
}
