import { beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import type { TranslationIngressCommand } from '@chatwork-bot/core'
import type {
  RoomTranslationBackend,
  RoomTranslationBackendInput,
  RoomTranslationBackendResult,
} from './translation-backend'

function makeCommand(
  overrides: Partial<TranslationIngressCommand> = {},
): TranslationIngressCommand {
  return {
    sourceSystem: 'chatwork',
    sourceEventId: 'msg-123:message_created:1772633778',
    sourceEventType: 'message_created',
    sourceMessageId: 'msg-123',
    sourceRoomId: 98765,
    senderAccountId: 34567,
    rawBody: 'Hello AcmeCorp\nBye AcmeCorp',
    translatableText: 'Hello AcmeCorp\nBye AcmeCorp',
    translationInputs: ['Hello AcmeCorp', 'Bye AcmeCorp'],
    sendTime: 1772633778,
    updateTime: 0,
    audit: {
      receivedAt: new Date().toISOString(),
      rawSourceSnapshot: {
        snapshot: {
          renderTemplate: [
            { type: 'literal', content: 'Hello AcmeCorp' },
            { type: 'literal', content: '\n' },
            { type: 'literal', content: 'Bye AcmeCorp' },
          ],
        },
      },
    },
    ...overrides,
  }
}

function makeObserver() {
  return {
    markRequestReceived: mock(() => undefined),
    logEvent: mock((_level: string, _event: string, _extra?: unknown) => undefined),
    runPhase: mock(async (_phase: string, run: () => Promise<unknown>) => await run()),
    markPhaseStarted: mock((_phase: string, _options?: unknown) => undefined),
    markPhaseCompleted: mock(() => undefined),
    markPhaseFailed: mock((_error: unknown) => undefined),
    completeRequest: mock((_params: unknown) => undefined),
    failRequest: mock((_params: unknown) => undefined),
  }
}

function makeBackend(
  translateImpl: (
    input: RoomTranslationBackendInput<{ token: string }>,
  ) => Promise<RoomTranslationBackendResult>,
): {
  backend: RoomTranslationBackend<{ token: string }>
  translateMock: ReturnType<typeof mock<typeof translateImpl>>
} {
  const translateMock = mock(translateImpl)

  return {
    backend: {
      kind: 'standard',
      translate: translateMock,
    },
    translateMock,
  }
}

describe('createRoomTranslationOrchestrator', () => {
  let createRoomTranslationOrchestrator:
    | ((deps: {
        chatworkApiToken: string
        outputBaseDir?: string
        datasetInputDir?: string
        datasetRunnerCallbackUrl?: string
        resolveOutputOrigin?: typeof resolveOutputOrigin
        writeTranslationOutput?: typeof writeTranslationOutput
        sendTranslatedMessage?: typeof sendTranslatedMessage
        notifyDatasetRunner?: typeof notifyDatasetRunner
        buildDatasetRunnerAckPayload?: typeof buildDatasetRunnerAckPayload
        createPhaseObserver?: () => ReturnType<typeof makeObserver>
      }) => <TRuntimeConfig>(params: {
        command: TranslationIngressCommand
        traceId?: string
        room: {
          id: string
          enabled: boolean
          destinationRoomId: number
          context?: string | null
          protectedKeywords?: {
            keyword: string
            category: 'company' | 'person' | 'project' | 'code' | 'other'
            placeholder?: string
          }[]
        }
        runtimeConfig: TRuntimeConfig
        backend: RoomTranslationBackend<TRuntimeConfig>
        metadata: {
          provider: string
          model: string
          translationStyle: string
        }
      }) => Promise<void>)
    | null = null

  const sendTranslatedMessage = mock(
    (
      _command: TranslationIngressCommand,
      _result: { translatedText: string },
      _config: {
        apiToken: string
        destinationRoomId: number
        translatedSegments?: string[]
      },
    ) =>
      Promise.resolve({
        status: 'sent' as const,
        destinationRoomId: 2222,
        destinationMessageId: 'body-123',
        messages: [],
        sentAt: '2026-04-01T00:00:00.000Z',
      }),
  )
  const writeTranslationOutput = mock((_record: unknown, _baseDir?: string) => Promise.resolve())
  const resolveOutputOrigin = mock((_messageId: string, _inputDir: string) =>
    Promise.resolve({ type: 'manual' as const }),
  )
  const notifyDatasetRunner = mock((_payload: unknown, _config: unknown) => Promise.resolve())
  const buildDatasetRunnerAckPayload = mock((_params: unknown) => ({ status: 'sent' }))

  beforeAll(async () => {
    const mockEnv = {
      CHATWORK_API_TOKEN: 'test-token',
      CHATWORK_BOT_ACCOUNT_ID: 1,
      ROOM_CONFIG_ENCRYPTION_KEY: 'a'.repeat(64),
      TRANSLATOR_PHASE_HEARTBEAT_MS: 10,
      TRANSLATOR_TRANSLATION_BUDGET_MS: 60_000,
      TRANSLATOR_DELIVERY_BUDGET_MS: 15_000,
      TRANSLATOR_ACK_CALLBACK_BUDGET_MS: 10_000,
      TRANSLATOR_PIPELINE_TIMEOUT_MS: 1_800_000,
      TRANSLATOR_STATUS_HISTORY_LIMIT: 20,
    }

    void mock.module('~/env', () => ({ env: mockEnv }))
    void mock.module('../env', () => ({ env: mockEnv }))

    const orchestratorModule = (await import(
      `./room-translation-orchestrator?test=${crypto.randomUUID()}`
    )) as {
      createRoomTranslationOrchestrator: NonNullable<typeof createRoomTranslationOrchestrator>
    }

    createRoomTranslationOrchestrator = orchestratorModule.createRoomTranslationOrchestrator
  })

  beforeEach(() => {
    sendTranslatedMessage.mockClear()
    writeTranslationOutput.mockClear()
    resolveOutputOrigin.mockClear()
    notifyDatasetRunner.mockClear()
    buildDatasetRunnerAckPayload.mockClear()
  })

  function getOrchestratorFactory(): NonNullable<typeof createRoomTranslationOrchestrator> {
    if (createRoomTranslationOrchestrator === null) {
      throw new Error('orchestrator factory not initialized')
    }

    return createRoomTranslationOrchestrator
  }

  it('skips disabled rooms without calling backend or delivery', async () => {
    const observer = makeObserver()
    const { backend, translateMock } = makeBackend(() =>
      Promise.reject(new Error('backend should not run')),
    )
    const orchestrator = getOrchestratorFactory()({
      chatworkApiToken: 'chatwork-token',
      createPhaseObserver: () => observer,
      resolveOutputOrigin,
      writeTranslationOutput,
      sendTranslatedMessage,
      notifyDatasetRunner,
      buildDatasetRunnerAckPayload,
    })

    await orchestrator({
      command: makeCommand(),
      room: {
        id: 'room-1',
        enabled: false,
        destinationRoomId: 2222,
      },
      backend,
      runtimeConfig: { token: 'room-token' },
      metadata: {
        provider: 'openai',
        model: 'gpt-4o',
        translationStyle: 'TECHNICAL',
      },
    })

    expect(translateMock.mock.calls).toHaveLength(0)
    expect(sendTranslatedMessage.mock.calls).toHaveLength(0)
    expect(writeTranslationOutput.mock.calls).toHaveLength(0)
  })

  it('skips effectively empty input when there is no meaningful literal structure', async () => {
    const observer = makeObserver()
    const { backend, translateMock } = makeBackend(() =>
      Promise.reject(new Error('backend should not run')),
    )
    const orchestrator = getOrchestratorFactory()({
      chatworkApiToken: 'chatwork-token',
      createPhaseObserver: () => observer,
      resolveOutputOrigin,
      writeTranslationOutput,
      sendTranslatedMessage,
      notifyDatasetRunner,
      buildDatasetRunnerAckPayload,
    })

    await orchestrator({
      command: makeCommand({
        rawBody: '',
        translatableText: '   ',
        translationInputs: [],
        audit: {
          receivedAt: new Date().toISOString(),
          rawSourceSnapshot: {
            snapshot: {
              renderTemplate: [],
            },
          },
        },
      }),
      room: {
        id: 'room-1',
        enabled: true,
        destinationRoomId: 2222,
      },
      backend,
      runtimeConfig: { token: 'room-token' },
      metadata: {
        provider: 'openai',
        model: 'gpt-4o',
        translationStyle: 'TECHNICAL',
      },
    })

    expect(translateMock.mock.calls).toHaveLength(0)
    expect(sendTranslatedMessage.mock.calls).toHaveLength(0)
  })

  it('skips backend calls but still delivers literal-only structure when translation inputs are empty', async () => {
    const observer = makeObserver()
    const { backend, translateMock } = makeBackend(() =>
      Promise.reject(new Error('backend should not run for literal-only content')),
    )
    const orchestrator = getOrchestratorFactory()({
      chatworkApiToken: 'chatwork-token',
      createPhaseObserver: () => observer,
      resolveOutputOrigin,
      writeTranslationOutput,
      sendTranslatedMessage,
      notifyDatasetRunner,
      buildDatasetRunnerAckPayload,
    })

    await orchestrator({
      command: makeCommand({
        rawBody: '[code]const x = 1[/code]',
        translatableText: '',
        translationInputs: [],
        audit: {
          receivedAt: new Date().toISOString(),
          rawSourceSnapshot: {
            snapshot: {
              renderTemplate: [{ type: 'code', content: 'const x = 1' }],
            },
          },
        },
      }),
      room: {
        id: 'room-1',
        enabled: true,
        destinationRoomId: 2222,
      },
      backend,
      runtimeConfig: { token: 'room-token' },
      metadata: {
        provider: 'openai',
        model: 'gpt-4o',
        translationStyle: 'TECHNICAL',
      },
    })

    expect(translateMock.mock.calls).toHaveLength(0)
    expect(sendTranslatedMessage.mock.calls).toHaveLength(1)
    expect(sendTranslatedMessage.mock.calls[0]?.[2]).toMatchObject({
      translatedSegments: [],
    })
  })

  it('masks cleanText and every translation input, then restores placeholders before delivery', async () => {
    const observer = makeObserver()
    const { backend, translateMock } = makeBackend((input) => {
      expect(input.cleanText).toBe('Hello [COMPANY_1]\nBye [COMPANY_1]')
      expect(input.translationInputs).toEqual(['Hello [COMPANY_1]', 'Bye [COMPANY_1]'])
      expect(input.roomContext).toBe('software team')
      expect(input.keywordSystemHint).toContain('[COMPANY_1]')

      return Promise.resolve({
        sourceLang: 'English',
        translatedText: 'Xin chao [COMPANY_1]\nTam biet [COMPANY_1]',
        translatedSegments: ['Xin chao [COMPANY_1]', 'Tam biet [COMPANY_1]'],
      })
    })
    const orchestrator = getOrchestratorFactory()({
      chatworkApiToken: 'chatwork-token',
      createPhaseObserver: () => observer,
      resolveOutputOrigin,
      writeTranslationOutput,
      sendTranslatedMessage,
      notifyDatasetRunner,
      buildDatasetRunnerAckPayload,
    })

    await orchestrator({
      command: makeCommand(),
      room: {
        id: 'room-1',
        enabled: true,
        destinationRoomId: 2222,
        context: '  software team  ',
        protectedKeywords: [{ keyword: 'AcmeCorp', category: 'company' }],
      },
      backend,
      runtimeConfig: { token: 'room-token' },
      metadata: {
        provider: 'openai',
        model: 'gpt-4o',
        translationStyle: 'TECHNICAL',
      },
    })

    expect(translateMock.mock.calls).toHaveLength(1)
    expect(sendTranslatedMessage.mock.calls).toHaveLength(1)
    expect(sendTranslatedMessage.mock.calls[0]?.[1]).toMatchObject({
      translatedText: 'Xin chao AcmeCorp\nTam biet AcmeCorp',
    })
    expect(sendTranslatedMessage.mock.calls[0]?.[2]).toMatchObject({
      apiToken: 'chatwork-token',
      destinationRoomId: 2222,
      translatedSegments: ['Xin chao AcmeCorp', 'Tam biet AcmeCorp'],
    })
    expect(writeTranslationOutput.mock.calls).toHaveLength(2)
  })

  it('fails closed on segment-count mismatch before delivery starts', async () => {
    const observer = makeObserver()
    const { backend } = makeBackend(() =>
      Promise.resolve({
        sourceLang: 'English',
        translatedText: 'Xin chao',
        translatedSegments: ['Xin chao'],
      }),
    )
    const orchestrator = getOrchestratorFactory()({
      chatworkApiToken: 'chatwork-token',
      createPhaseObserver: () => observer,
      resolveOutputOrigin,
      writeTranslationOutput,
      sendTranslatedMessage,
      notifyDatasetRunner,
      buildDatasetRunnerAckPayload,
    })

    await orchestrator({
      command: makeCommand(),
      room: {
        id: 'room-1',
        enabled: true,
        destinationRoomId: 2222,
      },
      backend,
      runtimeConfig: { token: 'room-token' },
      metadata: {
        provider: 'openai',
        model: 'gpt-4o',
        translationStyle: 'TECHNICAL',
      },
    })

    expect(sendTranslatedMessage.mock.calls).toHaveLength(0)
    expect(writeTranslationOutput.mock.calls).toHaveLength(0)
    expect(observer.failRequest.mock.calls.at(-1)?.[0]).toMatchObject({
      finalStatus: 'failed',
      errorCode: 'INVALID_RESPONSE',
    })
  })
})
