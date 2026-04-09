import { beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import type { TranslationIngressCommand } from '@chatwork-bot/core'
import type { FreeRoomConfigStore } from '~/services/free-room-config-store'
import type { RoomTranslationBackend } from '~/services/translation-backend'

const mockOrchestrateRoomTranslation = mock((_params: unknown) => Promise.resolve())

void mock.module('~/services/room-translation-orchestrator', () => ({
  createRoomTranslationOrchestrator: () => mockOrchestrateRoomTranslation,
}))

function makeCommand(overrides?: Partial<TranslationIngressCommand>): TranslationIngressCommand {
  return {
    sourceSystem: 'chatwork',
    sourceEventId: '789012345:message_created:1498028130',
    sourceEventType: 'message_created',
    sourceMessageId: '789012345',
    sourceRoomId: 567890123,
    senderAccountId: 123456,
    rawBody: 'Hello World',
    translatableText: 'Hello World',
    translationInputs: ['Hello World'],
    sendTime: 1498028125,
    updateTime: 0,
    audit: {
      receivedAt: new Date().toISOString(),
      rawSourceSnapshot: {
        webhook_setting_id: '12345',
        webhook_event_type: 'message_created',
        webhook_event_time: 1498028130,
        webhook_event: {
          message_id: '789012345',
          room_id: 567890123,
          account_id: 123456,
          body: 'Hello World',
          send_time: 1498028125,
          update_time: 0,
        },
      },
    },
    ...overrides,
  }
}

describe('createHandleFreeTranslateRequest', () => {
  let createHandleFreeTranslateRequest: (deps: {
    store: Pick<FreeRoomConfigStore, 'getByOriginalRoomId'>
    chatworkApiToken: string
    backend: RoomTranslationBackend<{ kagiStyle: string; context?: string | null }>
  }) => (command: TranslationIngressCommand, context?: { traceId?: string }) => Promise<void>

  beforeAll(async () => {
    const mod = (await import(`./free-handler?${crypto.randomUUID()}`)) as {
      createHandleFreeTranslateRequest: typeof createHandleFreeTranslateRequest
    }
    createHandleFreeTranslateRequest = mod.createHandleFreeTranslateRequest
  })

  beforeEach(() => {
    mockOrchestrateRoomTranslation.mockClear()
  })

  it('resolves the room from the free store and delegates to the shared orchestrator', async () => {
    const room = {
      id: 'free-room-1',
      originalRoomId: 567890123,
      originalRoomName: 'Test Free Room',
      destinationRoomId: 678901234,
      destinationRoomName: 'Free Output',
      kagiStyle: 'Clear' as const,
      context: 'software team',
      previewUrl:
        'https://translate.kagi.com/?from=auto&to=vi&text=hello&preserveFormatting=true&context=software+team',
      protectedKeywords: [{ keyword: 'Acme', category: 'company' as const }],
      enabled: true,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    }
    const store = {
      getByOriginalRoomId: mock((_sourceRoomId: number) => room),
    } satisfies Pick<FreeRoomConfigStore, 'getByOriginalRoomId'>
    const backend = {
      kind: 'free' as const,
      translate: mock(() =>
        Promise.resolve({
          sourceLang: 'auto',
          translatedText: 'Xin chào',
          translatedSegments: ['Xin chào'],
        }),
      ),
    } satisfies RoomTranslationBackend<{ kagiStyle: string; context?: string | null }>
    const handleFreeTranslateRequest = createHandleFreeTranslateRequest({
      store,
      chatworkApiToken: 'test-token',
      backend,
    })

    await handleFreeTranslateRequest(makeCommand(), { traceId: 'trace-free-1' })

    expect(store.getByOriginalRoomId).toHaveBeenCalledWith(567890123)
    expect(mockOrchestrateRoomTranslation).toHaveBeenCalledTimes(1)
    expect(mockOrchestrateRoomTranslation.mock.calls[0]?.[0]).toMatchObject({
      traceId: 'trace-free-1',
      backend,
      room: {
        id: room.id,
        destinationRoomId: room.destinationRoomId,
        context: room.context,
        enabled: true,
        protectedKeywords: room.protectedKeywords,
      },
      runtimeConfig: {
        kagiStyle: 'Clear',
        context: 'software team',
      },
      metadata: {
        provider: 'kagi',
        model: 'kagi-translate-web',
        translationStyle: 'Clear',
      },
    })
  })

  it('does nothing when there is no matching free room config', async () => {
    const store = {
      getByOriginalRoomId: mock((_sourceRoomId: number) => null),
    } satisfies Pick<FreeRoomConfigStore, 'getByOriginalRoomId'>
    const backend = {
      kind: 'free' as const,
      translate: mock(() =>
        Promise.resolve({
          sourceLang: 'auto',
          translatedText: 'Xin chào',
          translatedSegments: ['Xin chào'],
        }),
      ),
    } satisfies RoomTranslationBackend<{ kagiStyle: string; context?: string | null }>
    const handleFreeTranslateRequest = createHandleFreeTranslateRequest({
      store,
      chatworkApiToken: 'test-token',
      backend,
    })

    await handleFreeTranslateRequest(makeCommand())

    expect(store.getByOriginalRoomId).toHaveBeenCalledWith(567890123)
    expect(mockOrchestrateRoomTranslation).toHaveBeenCalledTimes(0)
  })
})
