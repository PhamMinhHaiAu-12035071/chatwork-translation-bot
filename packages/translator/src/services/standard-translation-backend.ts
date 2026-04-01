import { getProviderPlugin } from '@chatwork-bot/core'
import type { ProviderCreateContext, ProviderPlugin } from '@chatwork-bot/core'
import { TranslationPipeline } from '~/pipeline/pipeline'
import type { RoomConfig } from '~/types/room-config'
import type { RoomTranslationBackend, RoomTranslationBackendResult } from './translation-backend'

export interface StandardTranslationRuntimeConfig {
  roomConfig: RoomConfig
  timeoutMs: number
  plugin?: ProviderPlugin
  modelId?: string
}

interface StandardTranslationBackendDeps {
  decryptApiToken: (encryptedAiApiToken: string) => Promise<string>
}

export class StandardTranslationBackend implements RoomTranslationBackend<StandardTranslationRuntimeConfig> {
  readonly kind = 'standard' as const

  constructor(private readonly deps: StandardTranslationBackendDeps) {}

  async translate(input: {
    cleanText: string
    translationInputs: string[]
    roomContext?: string
    keywordSystemHint?: string
    runtimeConfig: StandardTranslationRuntimeConfig
    phaseObserver?: {
      onPhaseStarted?: (params: { phase: 'translation' }) => Promise<void> | void
      onPhaseCompleted?: (params: { phase: 'translation' }) => Promise<void> | void
      onPhaseFailed?: (params: { phase: 'translation'; error: unknown }) => Promise<void> | void
    }
  }): Promise<RoomTranslationBackendResult> {
    const { roomConfig, timeoutMs } = input.runtimeConfig
    const aiApiToken = await this.deps.decryptApiToken(roomConfig.encryptedAiApiToken)
    const plugin = input.runtimeConfig.plugin ?? getProviderPlugin(roomConfig.aiProvider)
    const modelId =
      input.runtimeConfig.modelId ?? roomConfig.aiModel ?? plugin.manifest.defaultModel
    const ctx: ProviderCreateContext = {
      modelId,
      apiKey: aiApiToken,
      translationStyle: roomConfig.translationStyle,
    }
    const executor = plugin.create(ctx)

    const pipelineOpts: {
      timeoutMs: number
      translationStyle: typeof roomConfig.translationStyle
      roomContext?: string
      keywordSystemHint?: string
    } = {
      timeoutMs,
      translationStyle: roomConfig.translationStyle,
    }

    if (input.roomContext !== undefined) {
      pipelineOpts.roomContext = input.roomContext
    }
    if (input.keywordSystemHint !== undefined) {
      pipelineOpts.keywordSystemHint = input.keywordSystemHint
    }

    const pipeline = new TranslationPipeline(executor, pipelineOpts)
    const pipelineResult = await pipeline.runStructured(
      {
        cleanText: input.cleanText,
        translationInputs: input.translationInputs,
      },
      {
        ...(input.phaseObserver !== undefined ? { phaseObserver: input.phaseObserver } : {}),
      },
    )

    return {
      sourceLang: pipelineResult.translation.sourceLang,
      translatedText: pipelineResult.translation.translatedText,
      translatedSegments: pipelineResult.translatedSegments,
      debug: {
        prompts: pipelineResult.debug?.prompts,
        promptMode: pipelineResult.debug?.promptMode,
        generation: executor.describeExecution().generation,
      },
    }
  }
}
