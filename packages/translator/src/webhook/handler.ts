import { createHash } from 'node:crypto'
import { getProviderPlugin } from '@chatwork-bot/core'
import type { TranslationIngressCommand } from '@chatwork-bot/core'
import { TRANSLATION_PROMPT_BUILD_ID } from '@chatwork-bot/translation-prompt'
import { hasMeaningfulLiteralStructure } from '~/services/message-structure'
import type { RoomConfigStore } from '~/services/room-config-store'
import { env } from '~/env'
import {
  hasExplicitPipelineTimeoutOverride,
  resolvePipelineTimeout,
} from '~/services/pipeline-timeout'
import { createRoomTranslationOrchestrator } from '~/services/room-translation-orchestrator'
import {
  StandardTranslationBackend,
  type StandardTranslationRuntimeConfig,
} from '~/services/standard-translation-backend'

interface HandleTranslateRequestDeps {
  store: RoomConfigStore
  chatworkApiToken: string
  resolveProviderPlugin?: typeof getProviderPlugin
  standardBackend?: StandardTranslationBackend
  orchestrateRoomTranslation?: ReturnType<typeof createRoomTranslationOrchestrator>
  pipelineTimeoutMs?: number
  getPipelineTimeoutMs?: () => number
  hasExplicitPipelineTimeoutOverride?: () => boolean
  resolvePipelineTimeout?: typeof resolvePipelineTimeout
}

interface TranslateRequestContext {
  traceId?: string
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

let translateRequestHandler:
  | ((command: TranslationIngressCommand, context?: TranslateRequestContext) => Promise<void>)
  | null = null

export function initTranslateHandler(deps: HandleTranslateRequestDeps): void {
  translateRequestHandler = createHandleTranslateRequest(deps)
}

export function createHandleTranslateRequest(deps: HandleTranslateRequestDeps) {
  const orchestrateRoomTranslation =
    deps.orchestrateRoomTranslation ??
    createRoomTranslationOrchestrator({
      chatworkApiToken: deps.chatworkApiToken,
    })
  const standardBackend =
    deps.standardBackend ??
    new StandardTranslationBackend({
      decryptApiToken: (encryptedAiApiToken) => deps.store.decryptApiToken(encryptedAiApiToken),
      ...(deps.resolveProviderPlugin !== undefined
        ? { resolveProviderPlugin: deps.resolveProviderPlugin }
        : {}),
    })
  const resolveProviderPlugin = deps.resolveProviderPlugin ?? getProviderPlugin
  const resolveTimeout = deps.resolvePipelineTimeout ?? resolvePipelineTimeout
  const hasExplicitTimeoutOverride =
    deps.hasExplicitPipelineTimeoutOverride ?? hasExplicitPipelineTimeoutOverride
  const getPipelineTimeoutMs =
    deps.getPipelineTimeoutMs ??
    (() => deps.pipelineTimeoutMs ?? env.TRANSLATOR_PIPELINE_TIMEOUT_MS)

  return async function handleTranslateRequest(
    command: TranslationIngressCommand,
    context: TranslateRequestContext = {},
  ): Promise<void> {
    const traceId = context.traceId ?? crypto.randomUUID()
    const roomConfig = deps.store.getByOriginalRoomId(command.sourceRoomId)

    if (roomConfig === null) {
      console.log(
        JSON.stringify({
          level: 'warn',
          service: 'translator',
          event: 'translation_skipped_no_room_config',
          timestamp: new Date().toISOString(),
          traceId,
          sourceRoomId: command.sourceRoomId,
          sourceMessageId: command.sourceMessageId,
        }),
      )
      return
    }

    if (!roomConfig.enabled) {
      console.log(
        JSON.stringify({
          level: 'info',
          service: 'translator',
          event: 'translation_skipped_room_disabled',
          timestamp: new Date().toISOString(),
          traceId,
          sourceRoomId: command.sourceRoomId,
          roomConfigId: roomConfig.id,
          sourceMessageId: command.sourceMessageId,
          nextExpectedAction: 'enable_room',
        }),
      )
      return
    }

    if (command.translatableText.trim() === '' && !hasMeaningfulLiteralStructure(command)) {
      console.log(
        JSON.stringify({
          level: 'info',
          service: 'translator',
          event: 'translation_skipped_empty',
          timestamp: new Date().toISOString(),
          traceId,
          sourceMessageId: command.sourceMessageId,
          sourceEventType: command.sourceEventType,
          rawBodyLength: command.rawBody.length,
          rawBodyPreview: command.rawBody.slice(0, 300),
        }),
      )
      return
    }

    const plugin = resolveProviderPlugin(roomConfig.aiProvider)
    const modelId = roomConfig.aiModel ?? plugin.manifest.defaultModel
    const translationStyle = roomConfig.translationStyle
    const { effectiveTimeoutMs, timeoutSource } = resolveTimeout({
      envTimeoutMs: getPipelineTimeoutMs(),
      hasEnvOverride: hasExplicitTimeoutOverride(),
      providerTimeoutMs: plugin.manifest.timeoutMs,
    })

    await orchestrateRoomTranslation({
      command,
      traceId,
      room: {
        id: roomConfig.id,
        enabled: roomConfig.enabled,
        destinationRoomId: roomConfig.destinationRoomId,
        context: roomConfig.context,
        ...(roomConfig.protectedKeywords !== undefined
          ? { protectedKeywords: roomConfig.protectedKeywords }
          : {}),
      },
      backend: standardBackend,
      runtimeConfig: {
        roomConfig,
        timeoutMs: effectiveTimeoutMs,
        plugin,
        modelId,
      } satisfies StandardTranslationRuntimeConfig,
      metadata: {
        provider: roomConfig.aiProvider,
        model: modelId,
        translationStyle,
        pipelineTimeoutMs: effectiveTimeoutMs,
        pipelineTimeoutSource: timeoutSource,
        buildOutputLlm: ({ backendResult }) => {
          const debug = backendResult.debug as
            | {
                prompts?: { system: string; user: string }
                promptMode?: 'single_text' | 'structured_segments'
                generation?: {
                  temperature: number | null
                  maxOutputTokens: number | null
                  providerOptions: Record<string, unknown> | null
                  providerManaged: boolean
                }
              }
            | undefined
          if (
            debug?.prompts === undefined ||
            debug.promptMode === undefined ||
            debug.generation === undefined
          ) {
            return undefined
          }

          return {
            provider: roomConfig.aiProvider,
            model: modelId,
            translationStyle,
            promptMode: debug.promptMode,
            promptBuildId: TRANSLATION_PROMPT_BUILD_ID,
            prompt: {
              system: debug.prompts.system,
              user: debug.prompts.user,
              systemSha256: sha256(debug.prompts.system),
              userSha256: sha256(debug.prompts.user),
            },
            generation: debug.generation,
          }
        },
      },
    })
  }
}

export async function handleTranslateRequest(
  command: TranslationIngressCommand,
  context?: TranslateRequestContext,
): Promise<void> {
  if (translateRequestHandler === null) {
    throw new Error('Translate handler not initialized')
  }

  return translateRequestHandler(command, context)
}
