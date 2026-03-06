import type { ITranslationService } from './translation'

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
}

export interface ProviderPlugin {
  readonly manifest: ProviderManifest
  create(ctx: ProviderCreateContext): ITranslationService
}
