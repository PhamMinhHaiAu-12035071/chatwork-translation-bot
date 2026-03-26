import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TranslationIngressCommand } from '@chatwork-bot/core'
import type { ILLMExecutor, ISchema, PromptPair } from '@chatwork-bot/core'
import type { RoomConfigStore } from '~/services/room-config-store'

// ── Pipeline fixtures (single executor call) ─────────────────────────────────

const pipelineFixtures: unknown[] = [
  {
    sourceLang: 'Japanese',
    translatedSegments: ['A-VI', 'B-VI', 'C-VI'],
  },
]

let executeCallCount = 0
const consoleLogLines: string[] = []
const originalConsoleLog = console.log
const ROOM_CONFIG_KEY_HEX = 'a'.repeat(64)
const DEFAULT_DESTINATION_ROOM_ID = 45678
const mockNotifyDatasetRunner = mock((_payload: unknown, _config: unknown) => Promise.resolve())
const mockComposeTranslatedMessagePair = mock(
  (
    _command: TranslationIngressCommand,
    _params: { translatedSegments: string[]; apiToken: string },
  ) =>
    Promise.resolve({
      metadataMessage: '[info][title]Translation metadata[/title]Event: created[/info]',
      bodyMessage: '[info]A-VI\n\nB-VI\nC-VI[/info]',
    }),
)
const mockSendRoomMessage = mock((_roomId: number, _message: string, _token: string) =>
  Promise.resolve({ message_id: 'mock-id' }),
)

function createMockExecutor(): ILLMExecutor {
  return {
    execute<T>(_prompts: PromptPair, schema: ISchema<T>): Promise<T> {
      const response = pipelineFixtures[executeCallCount % pipelineFixtures.length]
      executeCallCount++
      return Promise.resolve(schema.parse(response))
    },
  }
}

function createMockProvider(id: string, executor: ILLMExecutor, timeoutMs = 1_800_000) {
  return {
    manifest: {
      id,
      defaultModel: 'gpt-4o',
      supportedModels: ['gpt-4o'],
      capabilities: { streaming: false },
      timeoutMs,
    },
    create: (ctx: unknown) => {
      _mockPluginCreate(ctx)
      return executor
    },
  }
}

// ── Module mocks ───────────────────────────────────────────────────────────────

const _mockPluginCreate = mock((_ctx: unknown) => createMockExecutor())
const mockGetProviderPlugin = mock((_id: string) => ({
  ...createMockProvider('openai', createMockExecutor()),
}))

const mockEnv = {
  AI_PROVIDER: 'openai',
  AI_MODEL: 'gpt-4o',
  AI_TRANSLATION_STYLE: 'TECHNICAL',
  CHATWORK_API_TOKEN: 'test-token',
  CHATWORK_DESTINATION_ROOM_ID: 99999,
  TRANSLATOR_PHASE_HEARTBEAT_MS: 10,
  TRANSLATOR_TRANSLATION_BUDGET_MS: 60_000,
  TRANSLATOR_DELIVERY_BUDGET_MS: 15_000,
  TRANSLATOR_ACK_CALLBACK_BUDGET_MS: 10_000,
  TRANSLATOR_PIPELINE_TIMEOUT_MS: 1_800_000,
  TRANSLATOR_STATUS_HISTORY_LIMIT: 20,
}

const testOutputDir = mkdtempSync(join(tmpdir(), 'handler-test-'))
process.env['OUTPUT_BASE_DIR'] = testOutputDir

class MockTranslationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'API_ERROR'
      | 'QUOTA_EXCEEDED'
      | 'INVALID_RESPONSE'
      | 'UNKNOWN'
      | 'ABORTED'
      | 'TIMEOUT',
    public override readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'TranslationError'
  }
}

// Canonical command fixture
function makeCommand(overrides?: Partial<TranslationIngressCommand>): TranslationIngressCommand {
  return {
    sourceSystem: 'chatwork',
    sourceEventId: '2081046619322847232:message_created:1772633778',
    sourceEventType: 'message_created',
    sourceMessageId: '2081046619322847232',
    sourceRoomId: 424846369,
    senderAccountId: 8315321,
    rawBody: 'A\n\nB\nC',
    translatableText: 'A\n\nB\nC',
    translationInputs: ['A', 'B', 'C'],
    sendTime: 1772633778,
    updateTime: 0,
    audit: {
      receivedAt: new Date().toISOString(),
      rawSourceSnapshot: {
        webhook_setting_id: '35555',
        webhook_event_type: 'message_created',
        webhook_event_time: 1772633778,
        webhook_event: {
          message_id: '2081046619322847232',
          room_id: 424846369,
          account_id: 8315321,
          body: 'A\n\nB\nC',
          send_time: 1772633778,
          update_time: 0,
        },
      },
    },
    ...overrides,
  }
}

describe('handleTranslateRequest', () => {
  let createHandleTranslateRequest: (deps: {
    store: RoomConfigStore
    chatworkApiToken: string
  }) => (command: TranslationIngressCommand) => Promise<void>
  let handleTranslateRequest: (command: TranslationIngressCommand) => Promise<void>
  let store: RoomConfigStore
  let storeDataDir: string
  let enabledRoomId: string

  beforeAll(async () => {
    const realCore = await import('@chatwork-bot/core')
    const realChatwork = await import('@chatwork-bot/chatwork')

    void mock.module('@chatwork-bot/core', () => ({
      ...realCore,
      getProviderPlugin: mockGetProviderPlugin,
      TranslationError: MockTranslationError,
    }))

    void mock.module('@chatwork-bot/chatwork', () => ({
      ...realChatwork,
      composeTranslatedMessagePair: mockComposeTranslatedMessagePair,
      sendRoomMessage: mockSendRoomMessage,
    }))

    void mock.module('~/services/dataset-runner-callback', () => ({
      buildDatasetRunnerAckPayload: (params: {
        sourceMessageId: string
        delivery: {
          status: 'sent' | 'partial' | 'failed'
          destinationRoomId: number
          destinationMessageId?: string
          errorCode?: string
          errorMessage?: string
        }
        ackedAt: string
      }) => {
        if (params.delivery.status === 'partial') {
          return {
            sourceMessageId: params.sourceMessageId,
            status: 'failed' as const,
            destinationRoomId: params.delivery.destinationRoomId,
            errorCode: 'PARTIAL_DELIVERY',
            errorMessage:
              params.delivery.errorMessage ?? 'Metadata message sent but body delivery failed',
            ackedAt: params.ackedAt,
          }
        }

        return {
          sourceMessageId: params.sourceMessageId,
          status: params.delivery.status,
          destinationRoomId: params.delivery.destinationRoomId,
          ...(params.delivery.destinationMessageId !== undefined
            ? { destinationMessageId: params.delivery.destinationMessageId }
            : {}),
          ...(params.delivery.errorCode !== undefined
            ? { errorCode: params.delivery.errorCode }
            : {}),
          ...(params.delivery.errorMessage !== undefined
            ? { errorMessage: params.delivery.errorMessage }
            : {}),
          ackedAt: params.ackedAt,
        }
      },
      notifyDatasetRunner: mockNotifyDatasetRunner,
    }))

    void mock.module('../env', () => ({
      env: mockEnv,
    }))

    const mod = await import('./handler')
    createHandleTranslateRequest = mod.createHandleTranslateRequest
  })

  afterAll(() => {
    delete process.env['OUTPUT_BASE_DIR']
    delete process.env['DATASET_INPUT_DIR']
    rmSync(testOutputDir, { recursive: true, force: true })
    console.log = originalConsoleLog
    mock.restore()
  })

  beforeEach(() => {
    executeCallCount = 0
    pipelineFixtures.splice(0, pipelineFixtures.length, {
      sourceLang: 'Japanese',
      translatedSegments: ['A-VI', 'B-VI', 'C-VI'],
    })
    consoleLogLines.length = 0
    mockEnv.TRANSLATOR_PIPELINE_TIMEOUT_MS = 1_800_000
    process.env['TRANSLATOR_PIPELINE_TIMEOUT_MS'] = '1800000'
    mockNotifyDatasetRunner.mockReset()
    mockNotifyDatasetRunner.mockImplementation(() => Promise.resolve())
    _mockPluginCreate.mockReset()
    _mockPluginCreate.mockImplementation((_ctx: unknown) => createMockExecutor())
    mockComposeTranslatedMessagePair.mockReset()
    mockComposeTranslatedMessagePair.mockImplementation(
      (
        _command: TranslationIngressCommand,
        _params: { translatedSegments: string[]; apiToken: string },
      ) =>
        Promise.resolve({
          metadataMessage: '[info][title]Translation metadata[/title]Event: created[/info]',
          bodyMessage: '[info]A-VI\n\nB-VI\nC-VI[/info]',
        }),
    )
    mockSendRoomMessage.mockReset()
    mockSendRoomMessage.mockImplementation((_roomId, _message, _token) =>
      Promise.resolve({ message_id: 'mock-id' }),
    )
    console.log = mock((...args: unknown[]) => {
      consoleLogLines.push(args.map((arg) => String(arg)).join(' '))
    }) as typeof console.log
    mockGetProviderPlugin.mockImplementation((_id: string) =>
      createMockProvider('openai', createMockExecutor()),
    )
  })

  afterEach(async () => {
    const { resetTranslatorObservabilityForTest } =
      await import('~/services/translator-observability-runtime')
    resetTranslatorObservabilityForTest()
    delete process.env['DATASET_INPUT_DIR']
    rmSync(storeDataDir, { recursive: true, force: true })
  })

  beforeEach(async () => {
    const { RoomConfigStore } = await import('~/services/room-config-store')

    storeDataDir = mkdtempSync(join(tmpdir(), 'room-config-store-'))
    store = new RoomConfigStore({
      dataDir: storeDataDir,
      encryptionKeyHex: ROOM_CONFIG_KEY_HEX,
    })
    await store.init()

    const room = await store.create({
      originalRoomId: 424846369,
      destinationRoomId: DEFAULT_DESTINATION_ROOM_ID,
      destinationRoomName: 'Translated Output',
      aiProvider: 'openai',
      aiModel: 'gpt-4o',
      translationStyle: 'TECHNICAL',
      aiApiToken: 'room-openai-token',
      webhookSecret: 'room-webhook-secret',
    })
    enabledRoomId = room.id
    await store.setEnabled(room.id, true)

    handleTranslateRequest = createHandleTranslateRequest({
      store,
      chatworkApiToken: mockEnv.CHATWORK_API_TOKEN,
    })
  })

  it('translates message via registry-resolved provider', async () => {
    const command = makeCommand()

    const getStart = mockGetProviderPlugin.mock.calls.length

    await handleTranslateRequest(command)

    expect(mockGetProviderPlugin.mock.calls.length).toBe(getStart + 1)
    expect(mockGetProviderPlugin.mock.calls.at(-1)?.[0]).toBe('openai')
    expect(_mockPluginCreate.mock.calls.at(-1)?.[0]).toMatchObject({
      modelId: 'gpt-4o',
      apiKey: 'room-openai-token',
    })
    expect(executeCallCount).toBe(1)
  })

  it('skips when source room has no config', async () => {
    const getStart = mockGetProviderPlugin.mock.calls.length

    await handleTranslateRequest(makeCommand({ sourceRoomId: 9999 }))

    expect(mockGetProviderPlugin.mock.calls.length).toBe(getStart)
    expect(executeCallCount).toBe(0)
    expect(
      consoleLogLines.some((line) => line.includes('translation_skipped_no_room_config')),
    ).toBe(true)
  })

  it('skips when room is disabled', async () => {
    await store.setEnabled(enabledRoomId, false)

    const getStart = mockGetProviderPlugin.mock.calls.length

    await handleTranslateRequest(makeCommand())

    expect(mockGetProviderPlugin.mock.calls.length).toBe(getStart)
    expect(executeCallCount).toBe(0)
    expect(consoleLogLines.some((line) => line.includes('translation_skipped_room_disabled'))).toBe(
      true,
    )
  })

  it('uses the room provider, model, token, and destination instead of global env config', async () => {
    await store.update(enabledRoomId, {
      aiProvider: 'gemini',
      aiModel: 'gemini-2.5-pro',
      aiApiToken: 'room-gemini-token',
      translationStyle: 'AUTO_CONTEXT',
    })

    mockGetProviderPlugin.mockImplementation((id: string) =>
      createMockProvider(id, createMockExecutor()),
    )

    await handleTranslateRequest(makeCommand())

    expect(mockGetProviderPlugin.mock.calls.at(-1)?.[0]).toBe('gemini')
    expect(_mockPluginCreate.mock.calls.at(-1)?.[0]).toMatchObject({
      modelId: 'gemini-2.5-pro',
      apiKey: 'room-gemini-token',
    })
    expect(mockSendRoomMessage.mock.calls[0]?.[0]).toBe(DEFAULT_DESTINATION_ROOM_ID)
  })

  it('writes delivery metadata after destination send completes', async () => {
    const command = makeCommand()

    await handleTranslateRequest(command)

    const dateStr = new Date().toISOString().slice(0, 10)
    const filepath = join(
      testOutputDir,
      dateStr,
      '2081046619322847232:message_created:1772633778.json',
    )
    const content = (await Bun.file(filepath).json()) as {
      origin?: { type: string }
      delivery?: { status: string }
    }
    expect(content.origin?.type).toBe('manual')
    expect(content.delivery?.status).toBe('sent')
  })

  it('emits structured lifecycle logs and records completed request in status snapshot', async () => {
    const command = makeCommand()

    await handleTranslateRequest(command)

    const jsonLogs = consoleLogLines
      .filter((line) => line.startsWith('{'))
      .map((line) => JSON.parse(line) as { event: string; translatedText?: string })

    expect(jsonLogs.some((entry) => entry.event === 'translation_request_received')).toBe(true)
    expect(jsonLogs.some((entry) => entry.event === 'translation_phase_started')).toBe(true)
    expect(jsonLogs.some((entry) => entry.event === 'translation_phase_completed')).toBe(true)
    expect(jsonLogs.some((entry) => entry.event === 'translation_delivery_completed')).toBe(true)
    expect(jsonLogs.some((entry) => entry.event === 'translation_request_completed')).toBe(true)
    expect(
      jsonLogs.some((entry) => JSON.stringify(entry).includes('"translationStyle":"TECHNICAL"')),
    ).toBe(true)
    expect(jsonLogs.some((entry) => JSON.stringify(entry).includes('Xin chào thế giới'))).toBe(
      false,
    )

    const { getTranslatorStatusSnapshot } =
      await import('~/services/translator-observability-runtime')
    const snapshot = getTranslatorStatusSnapshot()
    expect(snapshot.activeRequests).toHaveLength(0)
    expect(snapshot.recentResults[0]).toMatchObject({
      sourceMessageId: '2081046619322847232',
      finalStatus: 'completed',
      finalPhase: 'delivery',
      deliveryStatus: 'sent',
      translationStyle: 'TECHNICAL',
    })
  })

  it('enriches automation requests with dataset metadata and completes ack callback', async () => {
    const inputDir = mkdtempSync(join(tmpdir(), 'handler-automation-'))
    process.env['DATASET_INPUT_DIR'] = inputDir
    const sourceMapPath = join(inputDir, 'state', 'source-map', '2081046619322847232.json')
    mkdirSync(join(inputDir, 'state', 'source-map'), { recursive: true })
    await Bun.write(
      sourceMapPath,
      JSON.stringify({
        datasetFile: '001-vfa-thinhntt-2026-03-10.jsonl',
        datasetItemId: 'vfa-001',
        datasetLineNumber: 1,
      }),
    )

    const command = makeCommand()

    await handleTranslateRequest(command)

    const { getTranslatorStatusSnapshot } =
      await import('~/services/translator-observability-runtime')
    const snapshot = getTranslatorStatusSnapshot()
    expect(snapshot.recentResults[0]).toMatchObject({
      originType: 'automation',
      datasetItemId: 'vfa-001',
      finalPhase: 'ack_callback',
      ackStatus: 'sent',
    })
    expect(mockNotifyDatasetRunner.mock.calls.length).toBe(1)

    rmSync(inputDir, { recursive: true, force: true })
  })

  it('posts failed ACK to dataset-runner when translation fails for automation events', async () => {
    const inputDir = mkdtempSync(join(tmpdir(), 'handler-automation-failed-'))
    process.env['DATASET_INPUT_DIR'] = inputDir
    const sourceMapPath = join(inputDir, 'state', 'source-map', '2081046619322847232.json')
    mkdirSync(join(inputDir, 'state', 'source-map'), { recursive: true })
    await Bun.write(
      sourceMapPath,
      JSON.stringify({
        datasetFile: '001-vfa-thinhntt-2026-03-10.jsonl',
        datasetItemId: 'vfa-001',
        datasetLineNumber: 1,
      }),
    )

    mockGetProviderPlugin.mockImplementation(() =>
      createMockProvider('openai', {
        execute: () => Promise.reject(new MockTranslationError('translate failed', 'API_ERROR')),
      } as ILLMExecutor),
    )

    const command = makeCommand()

    await handleTranslateRequest(command)

    const callbackPayload = mockNotifyDatasetRunner.mock.calls.at(0)?.[0] as
      | { status: string; sourceMessageId: string; errorCode: string; errorMessage: string }
      | undefined

    expect(mockNotifyDatasetRunner.mock.calls).toHaveLength(1)
    expect(callbackPayload?.status).toBe('failed')
    expect(callbackPayload?.sourceMessageId).toBe('2081046619322847232')
    expect(callbackPayload?.errorCode).toBe('API_ERROR')
    expect(callbackPayload?.errorMessage).toBe('translate failed')

    rmSync(inputDir, { recursive: true, force: true })
  })

  it('records delivery failures in logs and recent results without throwing', async () => {
    mockSendRoomMessage.mockImplementation((_roomId, _message, _token) =>
      Promise.reject(new Error('destination failed')),
    )

    const command = makeCommand()

    await handleTranslateRequest(command)

    const jsonLogs = consoleLogLines
      .filter((line) => line.startsWith('{'))
      .map((line) => JSON.parse(line) as { event: string; deliveryStatus?: string })
    expect(jsonLogs.some((entry) => entry.event === 'translation_delivery_failed')).toBe(true)

    const { getTranslatorStatusSnapshot } =
      await import('~/services/translator-observability-runtime')
    const snapshot = getTranslatorStatusSnapshot()
    expect(snapshot.recentResults[0]).toMatchObject({
      finalStatus: 'completed',
      deliveryStatus: 'failed',
    })
  })

  it('skips when translatableText is empty', async () => {
    const command = makeCommand({
      translatableText: '',
      translationInputs: [],
      audit: {
        receivedAt: new Date().toISOString(),
        rawSourceSnapshot: {
          snapshot: {
            renderTemplate: [],
          },
        },
      },
    })

    const getStart = mockGetProviderPlugin.mock.calls.length

    await handleTranslateRequest(command)

    expect(mockGetProviderPlugin.mock.calls.length).toBe(getStart)
    expect(executeCallCount).toBe(0)
  })

  it('skips when translatableText is whitespace only', async () => {
    const command = makeCommand({
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
    })

    const getStart = mockGetProviderPlugin.mock.calls.length

    await handleTranslateRequest(command)

    expect(mockGetProviderPlugin.mock.calls.length).toBe(getStart)
    expect(executeCallCount).toBe(0)
  })

  it('sends metadata and translated body messages to the destination room on success', async () => {
    const command = makeCommand()

    await handleTranslateRequest(command)

    expect(mockSendRoomMessage.mock.calls.length).toBe(2)
    expect(mockSendRoomMessage.mock.calls[0]?.[0]).toBe(DEFAULT_DESTINATION_ROOM_ID)
    expect(mockSendRoomMessage.mock.calls[0]?.[1]).toContain('Translation metadata')
    expect(mockSendRoomMessage.mock.calls[1]?.[1]).toContain('A-VI')
  })

  it('skips the LLM but still delivers when translationInputs is empty and the body has meaningful literal structure', async () => {
    mockComposeTranslatedMessagePair.mockImplementationOnce(() =>
      Promise.resolve({
        metadataMessage: '[info][title]Translation metadata[/title]Event: created[/info]',
        bodyMessage: '[code]const x = 1[/code]',
      }),
    )

    const command = makeCommand({
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
    })

    await handleTranslateRequest(command)

    expect(executeCallCount).toBe(0)
    expect(mockSendRoomMessage.mock.calls.length).toBe(2)
    expect(mockSendRoomMessage.mock.calls[1]?.[1]).toBe('[code]const x = 1[/code]')
  })

  it('does not start delivery when structured translation validation fails', async () => {
    pipelineFixtures.splice(0, pipelineFixtures.length, {
      sourceLang: 'Japanese',
      translatedSegments: ['only-one-segment'],
    })

    await handleTranslateRequest(makeCommand())

    expect(mockComposeTranslatedMessagePair.mock.calls.length).toBe(0)
    expect(mockSendRoomMessage.mock.calls.length).toBe(0)

    const { getTranslatorStatusSnapshot } =
      await import('~/services/translator-observability-runtime')
    const snapshot = getTranslatorStatusSnapshot()
    expect(snapshot.recentResults[0]).toMatchObject({
      finalStatus: 'failed',
      errorCode: 'INVALID_RESPONSE',
    })
  })

  it('maps partial delivery to a failed dataset-runner ACK for automation events', async () => {
    const inputDir = mkdtempSync(join(tmpdir(), 'handler-automation-partial-'))
    process.env['DATASET_INPUT_DIR'] = inputDir
    const sourceMapPath = join(inputDir, 'state', 'source-map', '2081046619322847232.json')
    mkdirSync(join(inputDir, 'state', 'source-map'), { recursive: true })
    await Bun.write(
      sourceMapPath,
      JSON.stringify({
        datasetFile: '001-vfa-thinhntt-2026-03-10.jsonl',
        datasetItemId: 'vfa-001',
        datasetLineNumber: 1,
      }),
    )

    mockSendRoomMessage
      .mockImplementationOnce(() => Promise.resolve({ message_id: 'meta-123' }))
      .mockImplementationOnce(() =>
        Promise.reject(new Error('destination body failed after metadata')),
      )

    await handleTranslateRequest(makeCommand())

    const callbackPayload = mockNotifyDatasetRunner.mock.calls.at(0)?.[0] as
      | { status: string; errorCode?: string; errorMessage?: string }
      | undefined

    expect(callbackPayload).toMatchObject({
      status: 'failed',
      errorCode: 'PARTIAL_DELIVERY',
      errorMessage: 'destination body failed after metadata',
    })

    rmSync(inputDir, { recursive: true, force: true })
  })

  it('uses the env timeout override and logs TIMEOUT context when the pipeline times out', async () => {
    mockEnv.TRANSLATOR_PIPELINE_TIMEOUT_MS = 5
    process.env['TRANSLATOR_PIPELINE_TIMEOUT_MS'] = '5'
    mockGetProviderPlugin.mockImplementation(() =>
      createMockProvider(
        'openai',
        {
          execute<T>(
            _prompts: PromptPair,
            _schema: ISchema<T>,
            options?: { signal?: AbortSignal },
          ): Promise<T> {
            return new Promise<T>((_resolve, reject) => {
              const signal = options?.signal
              if (!signal) {
                reject(new Error('abort signal missing'))
                return
              }

              signal.addEventListener('abort', () => {
                reject(
                  signal.reason instanceof Error ? signal.reason : new Error(String(signal.reason)),
                )
              })
            })
          },
        },
        50,
      ),
    )

    const startedAt = Date.now()
    await handleTranslateRequest(makeCommand())
    const elapsedMs = Date.now() - startedAt

    const { getTranslatorStatusSnapshot } =
      await import('~/services/translator-observability-runtime')
    const snapshot = getTranslatorStatusSnapshot()
    expect(snapshot.recentResults[0]).toMatchObject({
      finalStatus: 'failed',
      errorCode: 'TIMEOUT',
    })

    const jsonLogs = consoleLogLines
      .filter((line) => line.startsWith('{'))
      .map(
        (line) =>
          JSON.parse(line) as {
            event: string
            errorCode?: string
            pipelineTimeoutMs?: number
            pipelineTimeoutSource?: string
          },
      )
    const failedLog = jsonLogs.find((entry) => entry.event === 'translation_request_failed')

    expect(elapsedMs).toBeLessThan(50)
    expect(failedLog).toMatchObject({
      errorCode: 'TIMEOUT',
      pipelineTimeoutMs: 5,
      pipelineTimeoutSource: 'env',
    })
  })
})
