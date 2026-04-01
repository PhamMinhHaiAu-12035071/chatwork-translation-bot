import type { TranslationIngressCommand } from '@chatwork-bot/core'
import { createRoomTranslationOrchestrator } from '~/services/room-translation-orchestrator'
import type { FreeRoomConfigStore } from '~/services/free-room-config-store'
import type {
  FreeTranslationBackend,
  FreeTranslationRuntimeConfig,
} from '~/services/free-translation-backend'

interface HandleFreeTranslateRequestDeps {
  store: Pick<FreeRoomConfigStore, 'getByOriginalRoomId'>
  chatworkApiToken: string
  backend: FreeTranslationBackend
}

interface TranslateRequestContext {
  traceId?: string
}

let freeTranslateRequestHandler:
  | ((command: TranslationIngressCommand, context?: TranslateRequestContext) => Promise<void>)
  | null = null

export function initFreeTranslateHandler(deps: HandleFreeTranslateRequestDeps): void {
  freeTranslateRequestHandler = createHandleFreeTranslateRequest(deps)
}

export function createHandleFreeTranslateRequest(deps: HandleFreeTranslateRequestDeps) {
  const orchestrateRoomTranslation = createRoomTranslationOrchestrator({
    chatworkApiToken: deps.chatworkApiToken,
  })

  return async function handleFreeTranslateRequest(
    command: TranslationIngressCommand,
    context: TranslateRequestContext = {},
  ): Promise<void> {
    const traceId = context.traceId ?? crypto.randomUUID()
    const roomConfig = deps.store.getByOriginalRoomId(command.sourceRoomId)

    if (roomConfig === null) {
      console.log(
        JSON.stringify({
          level: 'info',
          service: 'translator',
          event: 'translation_free_skipped_no_room_config',
          timestamp: new Date().toISOString(),
          traceId,
          sourceRoomId: command.sourceRoomId,
          sourceMessageId: command.sourceMessageId,
        }),
      )
      return
    }

    await orchestrateRoomTranslation<FreeTranslationRuntimeConfig>({
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
      backend: deps.backend,
      runtimeConfig: {
        kagiStyle: roomConfig.kagiStyle,
        context: roomConfig.context,
      },
      metadata: {
        provider: 'kagi',
        model: 'kagi-translate-web',
        translationStyle: roomConfig.kagiStyle,
      },
    })
  }
}

export async function handleFreeTranslateRequest(
  command: TranslationIngressCommand,
  context?: TranslateRequestContext,
): Promise<void> {
  if (freeTranslateRequestHandler === null) {
    throw new Error('Free translate handler not initialized')
  }

  return freeTranslateRequestHandler(command, context)
}
