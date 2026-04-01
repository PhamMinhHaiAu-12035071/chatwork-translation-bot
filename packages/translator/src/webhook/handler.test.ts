import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TranslationError } from '@chatwork-bot/core'
import type { TranslationIngressCommand, TranslationResult } from '@chatwork-bot/core'
import type { ILLMExecutor, ISchema, PromptPair } from '@chatwork-bot/core'
import type * as OutputWriter from '~/utils/output-writer'
import type { createRoomTranslationOrchestrator as CreateRoomTranslationOrchestrator } from '~/services/room-translation-orchestrator'
import type { RoomConfigStore } from '~/services/room-config-store'
import type { OutputDelivery, OutputDeliveryMessage, OutputRecord } from '~/types/output'
import type { StandardTranslationBackend } from '~/services/standard-translation-backend'

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
const originalConsoleError = console.error
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
type OutputWriterModule = typeof OutputWriter

const mockWriteTranslationOutput = mock((_record: OutputRecord, _baseDir?: string) =>
  Promise.resolve(),
)
let realWriteTranslationOutput: (record: OutputRecord, baseDir?: string) => Promise<void>
let createRoomTranslationOrchestrator: typeof CreateRoomTranslationOrchestrator | null = null
let StandardTranslationBackendCtor: typeof StandardTranslationBackend | null = null

function createMockExecutor(): ILLMExecutor {
  return {
    execute<T>(_prompts: PromptPair, schema: ISchema<T>): Promise<T> {
      const response = pipelineFixtures[executeCallCount % pipelineFixtures.length]
      executeCallCount++
      return Promise.resolve(schema.parse(response))
    },
    describeExecution() {
      return {
        generation: {
          temperature: 0,
          maxOutputTokens: 4000,
          providerOptions: null,
          providerManaged: false,
        },
      }
    },
  }
}

function readJsonLogs(): Record<string, unknown>[] {
  return consoleLogLines
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line) as Record<string, unknown>)
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

function toDeliveryError(error: unknown): { errorCode: string; errorMessage: string } {
  if (error instanceof Error) {
    return {
      errorCode: error.constructor.name,
      errorMessage: error.message,
    }
  }

  return {
    errorCode: 'UnknownError',
    errorMessage: String(error),
  }
}

async function fakeSendTranslatedMessage(
  command: TranslationIngressCommand,
  result: TranslationResult,
  config: {
    apiToken: string
    destinationRoomId: number
    translatedSegments?: string[]
  },
): Promise<OutputDelivery> {
  const sentAt = new Date().toISOString()

  try {
    const translatedSegments =
      config.translatedSegments ??
      (command.translationInputs.length === 0 ? [] : [result.translatedText])
    const { metadataMessage, bodyMessage } = await mockComposeTranslatedMessagePair(command, {
      apiToken: config.apiToken,
      translatedSegments,
    })

    let metadataDelivery: OutputDeliveryMessage
    try {
      const response = await mockSendRoomMessage(
        config.destinationRoomId,
        metadataMessage,
        config.apiToken,
      )
      metadataDelivery = {
        kind: 'metadata',
        status: 'sent',
        destinationMessageId: response.message_id,
      }
    } catch (error) {
      const { errorCode, errorMessage } = toDeliveryError(error)
      return {
        status: 'failed',
        destinationRoomId: config.destinationRoomId,
        sentAt,
        messages: [
          {
            kind: 'metadata',
            status: 'failed',
            errorCode,
            errorMessage,
          },
        ],
        errorCode,
        errorMessage,
      }
    }

    try {
      const response = await mockSendRoomMessage(
        config.destinationRoomId,
        bodyMessage,
        config.apiToken,
      )
      return {
        status: 'sent',
        destinationRoomId: config.destinationRoomId,
        sentAt,
        destinationMessageId: response.message_id,
        messages: [
          metadataDelivery,
          {
            kind: 'body',
            status: 'sent',
            destinationMessageId: response.message_id,
          },
        ],
      }
    } catch (error) {
      const { errorCode, errorMessage } = toDeliveryError(error)
      return {
        status: 'partial',
        destinationRoomId: config.destinationRoomId,
        sentAt,
        messages: [
          metadataDelivery,
          {
            kind: 'body',
            status: 'failed',
            errorCode,
            errorMessage,
          },
        ],
        errorCode,
        errorMessage,
      }
    }
  } catch (error) {
    const { errorCode, errorMessage } = toDeliveryError(error)
    return {
      status: 'failed',
      destinationRoomId: config.destinationRoomId,
      sentAt,
      errorCode,
      errorMessage,
    }
  }
}

function buildDatasetRunnerAckPayload(params: {
  sourceMessageId: string
  delivery: {
    status: 'sent' | 'partial' | 'failed'
    destinationRoomId: number
    destinationMessageId?: string
    errorCode?: string
    errorMessage?: string
  }
  ackedAt: string
}) {
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
    ...(params.delivery.errorCode !== undefined ? { errorCode: params.delivery.errorCode } : {}),
    ...(params.delivery.errorMessage !== undefined
      ? { errorMessage: params.delivery.errorMessage }
      : {}),
    ackedAt: params.ackedAt,
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
    resolveProviderPlugin?: typeof mockGetProviderPlugin
    standardBackend?: StandardTranslationBackend
    orchestrateRoomTranslation?: ReturnType<NonNullable<typeof createRoomTranslationOrchestrator>>
    getPipelineTimeoutMs?: () => number
    hasExplicitPipelineTimeoutOverride?: () => boolean
  }) => (command: TranslationIngressCommand, context?: { traceId?: string }) => Promise<void>
  let handleTranslateRequest: (
    command: TranslationIngressCommand,
    context?: { traceId?: string },
  ) => Promise<void>
  let store: RoomConfigStore
  let storeDataDir: string
  let enabledRoomId: string

  beforeAll(async () => {
    process.env['CHATWORK_API_TOKEN'] = 'test-token'
    process.env['CHATWORK_BOT_ACCOUNT_ID'] = '42'
    process.env['ROOM_CONFIG_ENCRYPTION_KEY'] = ROOM_CONFIG_KEY_HEX
    process.env['ROOM_CONFIG_DATA_DIR'] = testOutputDir
    const outputWriterModuleUnknown: unknown = await import(
      `~/utils/output-writer?real=${crypto.randomUUID()}`
    )
    const realOutputWriter = outputWriterModuleUnknown as OutputWriterModule
    realWriteTranslationOutput = (record: OutputRecord, baseDir?: string) =>
      realOutputWriter.writeTranslationOutput(record, baseDir)
    const mod = (await import(`./handler?${crypto.randomUUID()}`)) as {
      createHandleTranslateRequest: typeof createHandleTranslateRequest
    }
    createHandleTranslateRequest = mod.createHandleTranslateRequest
    const orchestratorMod = (await import(
      `~/services/room-translation-orchestrator?test=${crypto.randomUUID()}`
    )) as {
      createRoomTranslationOrchestrator: typeof CreateRoomTranslationOrchestrator
    }
    createRoomTranslationOrchestrator = orchestratorMod.createRoomTranslationOrchestrator
    const standardBackendModule = (await import(
      `~/services/standard-translation-backend?test=${crypto.randomUUID()}`
    )) as {
      StandardTranslationBackend: typeof StandardTranslationBackend
    }
    StandardTranslationBackendCtor = standardBackendModule.StandardTranslationBackend
  })

  afterAll(() => {
    delete process.env['OUTPUT_BASE_DIR']
    delete process.env['DATASET_INPUT_DIR']
    rmSync(testOutputDir, { recursive: true, force: true })
    console.log = originalConsoleLog
    console.error = originalConsoleError
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
    mockWriteTranslationOutput.mockReset()
    mockWriteTranslationOutput.mockImplementation((record: OutputRecord, baseDir?: string) =>
      realWriteTranslationOutput(record, baseDir),
    )
    console.log = mock((...args: unknown[]) => {
      consoleLogLines.push(args.map((arg) => String(arg)).join(' '))
    }) as typeof console.log
    console.error = mock((...args: unknown[]) => {
      consoleLogLines.push(args.map((arg) => String(arg)).join(' '))
    }) as typeof console.error
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
    if (createRoomTranslationOrchestrator === null || StandardTranslationBackendCtor === null) {
      throw new Error('Handler test dependencies not initialized')
    }

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
    })
    enabledRoomId = room.id
    await store.setEnabled(room.id, true)

    const orchestrateRoomTranslation = createRoomTranslationOrchestrator({
      chatworkApiToken: mockEnv.CHATWORK_API_TOKEN,
      writeTranslationOutput: mockWriteTranslationOutput,
      sendTranslatedMessage: fakeSendTranslatedMessage,
      notifyDatasetRunner: mockNotifyDatasetRunner,
      buildDatasetRunnerAckPayload,
    })
    const standardBackend = new StandardTranslationBackendCtor({
      decryptApiToken: (encryptedAiApiToken) => store.decryptApiToken(encryptedAiApiToken),
      resolveProviderPlugin: mockGetProviderPlugin,
    })
    handleTranslateRequest = createHandleTranslateRequest({
      store,
      chatworkApiToken: mockEnv.CHATWORK_API_TOKEN,
      resolveProviderPlugin: mockGetProviderPlugin,
      standardBackend,
      orchestrateRoomTranslation,
      getPipelineTimeoutMs: () => mockEnv.TRANSLATOR_PIPELINE_TIMEOUT_MS,
      hasExplicitPipelineTimeoutOverride: () =>
        process.env['TRANSLATOR_PIPELINE_TIMEOUT_MS'] !== undefined,
    })
  })

  it('translates message via registry-resolved provider', async () => {
    const command = makeCommand()
    const traceId = 'trace-123'

    const getStart = mockGetProviderPlugin.mock.calls.length

    await handleTranslateRequest(command, { traceId })

    expect(mockGetProviderPlugin.mock.calls.length).toBe(getStart + 1)
    expect(mockGetProviderPlugin.mock.calls.at(-1)?.[0]).toBe('openai')
    expect(_mockPluginCreate.mock.calls.at(-1)?.[0]).toMatchObject({
      modelId: 'gpt-4o',
      apiKey: 'room-openai-token',
    })
    expect(executeCallCount).toBe(1)

    const providerSelectedLog = readJsonLogs().find(
      (entry) => entry['event'] === 'translation_provider_selected',
    )
    expect(providerSelectedLog).toMatchObject({
      event: 'translation_provider_selected',
      traceId,
      aiProvider: 'openai',
      resolvedModel: 'gpt-4o',
    })
  })

  it('skips when source room has no config', async () => {
    const getStart = mockGetProviderPlugin.mock.calls.length

    await handleTranslateRequest(makeCommand({ sourceRoomId: 9999 }))

    expect(mockGetProviderPlugin.mock.calls.length).toBe(getStart)
    expect(executeCallCount).toBe(0)
    const skippedLog = readJsonLogs().find(
      (entry) => entry['event'] === 'translation_skipped_no_room_config',
    )
    expect(skippedLog?.['level']).toBe('warn')
  })

  it('skips when room is disabled', async () => {
    await store.setEnabled(enabledRoomId, false)
    const traceId = 'trace-123'

    const getStart = mockGetProviderPlugin.mock.calls.length

    await handleTranslateRequest(makeCommand(), { traceId })

    expect(mockGetProviderPlugin.mock.calls.length).toBe(getStart)
    expect(executeCallCount).toBe(0)
    const skippedLog = readJsonLogs().find(
      (entry) => entry['event'] === 'translation_skipped_room_disabled',
    )
    expect(skippedLog).toMatchObject({
      event: 'translation_skipped_room_disabled',
      traceId,
      nextExpectedAction: 'enable_room',
    })
  })

  it('uses the room provider, model, token, and destination instead of global env config', async () => {
    await store.update(enabledRoomId, {
      aiProvider: 'gemini',
      aiModel: 'gemini-2.5-pro',
      aiApiToken: 'room-gemini-token',
      translationStyle: 'NATURAL_CASUAL',
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
      llm?: {
        promptMode?: string
        promptBuildId?: string
        translationStyle?: string
        generation?: { temperature?: number }
      }
    }
    expect(content.origin?.type).toBe('manual')
    expect(content.delivery?.status).toBe('sent')
    expect(content.llm?.promptMode).toBe('structured_segments')
    expect(content.llm?.translationStyle).toBe('TECHNICAL')
    expect(content.llm?.generation?.temperature).toBe(0)
    expect(content.llm?.promptBuildId).toBe('2026-03-30-human-sounding-workplace-v1')
  })

  it('writes a single_text natural-casual prompt mode and v3 runtime metadata for long single-message input', async () => {
    await store.update(enabledRoomId, {
      aiProvider: 'openai',
      aiModel: 'gpt-5.4',
      aiApiToken: 'room-openai-token',
      translationStyle: 'NATURAL_CASUAL',
    })

    let capturedPrompts: PromptPair | undefined
    mockGetProviderPlugin.mockImplementation(() =>
      createMockProvider('openai', {
        execute<T>(prompts: PromptPair, schema: ISchema<T>): Promise<T> {
          capturedPrompts = prompts
          return Promise.resolve(
            schema.parse({
              sourceLang: 'Japanese',
              translated: 'Bản dịch liền mạch',
            }),
          )
        },
        describeExecution() {
          return {
            generation: {
              temperature: 0.75,
              maxOutputTokens: 4000,
              providerOptions: { openai: { reasoningEffort: 'medium' } },
              providerManaged: false,
            },
          }
        },
      }),
    )

    const source =
      '動画を一定時間のチャンクに分割する\n\n2. 圧縮技術による最適化\nエンコード処理\n\nフレームサンプリング:\nすべてを送る必要はない。'
    const command = makeCommand({
      rawBody: source,
      translatableText: source,
      translationInputs: [source],
    })

    await handleTranslateRequest(command)

    expect(capturedPrompts?.user).toContain('<TRANSLATE_TEXT>')

    const dateStr = new Date().toISOString().slice(0, 10)
    const filepath = join(
      testOutputDir,
      dateStr,
      '2081046619322847232:message_created:1772633778.json',
    )
    const content = (await Bun.file(filepath).json()) as {
      llm?: {
        promptMode?: string
        promptBuildId?: string
        translationStyle?: string
        generation?: { temperature?: number }
      }
    }

    expect(content.llm?.promptMode).toBe('single_text')
    expect(content.llm?.translationStyle).toBe('NATURAL_CASUAL')
    expect(content.llm?.generation?.temperature).toBe(0.75)
    expect(content.llm?.promptBuildId).toBe('2026-03-30-human-sounding-workplace-v1')
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
        execute: () => Promise.reject(new TranslationError('translate failed', 'API_ERROR')),
        describeExecution: () => ({
          generation: {
            temperature: 0,
            maxOutputTokens: 4000,
            providerOptions: null,
            providerManaged: false,
          },
        }),
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

  it('logs output-rewrite-failed with trace correlation when post-delivery persistence fails', async () => {
    const traceId = 'trace-output-rewrite-failed'
    let writeCallCount = 0

    mockWriteTranslationOutput.mockImplementation(
      async (record: OutputRecord, baseDir?: string) => {
        writeCallCount += 1
        if (writeCallCount === 2) {
          throw new Error('rewrite failed')
        }

        await realWriteTranslationOutput(record, baseDir)
      },
    )

    const runResult = handleTranslateRequest(makeCommand(), { traceId }).then(
      () => {
        throw new Error('Expected rewrite failure')
      },
      (error: unknown) => {
        if (!(error instanceof Error)) {
          throw error
        }
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe('rewrite failed')
      },
    )
    await runResult

    const outputRewriteFailedLog = readJsonLogs().find(
      (entry) => entry['event'] === 'output-rewrite-failed',
    )
    expect(outputRewriteFailedLog).toMatchObject({
      event: 'output-rewrite-failed',
      service: 'translator',
      traceId,
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
          describeExecution() {
            return {
              generation: {
                temperature: 0,
                maxOutputTokens: 4000,
                providerOptions: null,
                providerManaged: false,
              },
            }
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

  it('full flow: message with sensitive keyword → AI call never contains original → Chatwork reply has original restored', async () => {
    if (StandardTranslationBackendCtor === null || createRoomTranslationOrchestrator === null) {
      throw new Error('Handler test dependencies not initialized')
    }
    const standardTranslationBackendCtor = StandardTranslationBackendCtor
    const makeRoomTranslationOrchestrator = createRoomTranslationOrchestrator

    // Arrange: create a custom executor that captures prompts
    let capturedPromptUser = ''

    const mockExecutor = {
      execute<T>(_prompts: PromptPair, schema: ISchema<T>): Promise<T> {
        capturedPromptUser = _prompts.user

        // For single segment, schema expects { sourceLang, translated }
        const response = {
          sourceLang: 'English',
          translated: 'Báo cáo từ [COMPANY_1] đã sẵn sàng',
        }
        return Promise.resolve(schema.parse(response))
      },
      describeExecution() {
        return {
          generation: {
            temperature: 0,
            maxOutputTokens: 4000,
            providerOptions: null,
            providerManaged: false,
          },
        }
      },
    } as ILLMExecutor

    // Create a custom store with protected keywords
    const customRoomConfig = {
      id: 'room-keyword-test',
      originalRoomId: 123456,
      destinationRoomId: DEFAULT_DESTINATION_ROOM_ID,
      destinationRoomName: 'Keyword Test Room',
      aiProvider: 'openai' as const,
      aiModel: 'gpt-4o',
      translationStyle: 'PROFESSIONAL_BUSINESS' as const,
      context: null,
      protectedKeywords: [{ keyword: 'Asia Vion', category: 'company' as const }],
      encryptedAiApiToken: 'encrypted-token',
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const customStore = {
      getByOriginalRoomId: (id: number) => (id === 123456 ? customRoomConfig : null),
      decryptApiToken: (token: string) => {
        // In tests, assume tokens are not encrypted
        return Promise.resolve(token)
      },
    } as unknown as RoomConfigStore

    // Create handler with custom store
    const { default: handleTranslateRequestFromCustomStore } =
      await import('~/webhook/handler').then((m) =>
        Promise.resolve({
          default: m.createHandleTranslateRequest({
            store: customStore,
            chatworkApiToken: 'token',
            resolveProviderPlugin: mockGetProviderPlugin,
            standardBackend: new standardTranslationBackendCtor({
              decryptApiToken: (token) => Promise.resolve(token),
              resolveProviderPlugin: mockGetProviderPlugin,
            }),
            orchestrateRoomTranslation: makeRoomTranslationOrchestrator({
              chatworkApiToken: 'token',
              writeTranslationOutput: mockWriteTranslationOutput,
              sendTranslatedMessage: fakeSendTranslatedMessage,
              notifyDatasetRunner: mockNotifyDatasetRunner,
              buildDatasetRunnerAckPayload,
            }),
            getPipelineTimeoutMs: () => mockEnv.TRANSLATOR_PIPELINE_TIMEOUT_MS,
            hasExplicitPipelineTimeoutOverride: () =>
              process.env['TRANSLATOR_PIPELINE_TIMEOUT_MS'] !== undefined,
          }),
        }),
      )

    mockGetProviderPlugin.mockImplementationOnce(() => createMockProvider('openai', mockExecutor))

    // Act
    await handleTranslateRequestFromCustomStore(
      makeCommand({
        sourceRoomId: 123456,
        translatableText: 'Report from Asia Vion is ready',
        translationInputs: ['Report from Asia Vion is ready'],
      }),
    )

    // Assert: AI never sees the original keyword in the text to translate
    expect(capturedPromptUser).not.toContain('Asia Vion')
    expect(capturedPromptUser).toContain('[COMPANY_1]')

    // Assert: Chatwork message has original keyword restored
    const sentMessages = mockComposeTranslatedMessagePair.mock.calls
    const lastCall = sentMessages.at(-1)
    const params = lastCall?.[1] as { translatedSegments: string[] } | undefined

    expect(params?.translatedSegments[0]).toContain('Asia Vion')
    expect(params?.translatedSegments[0]).not.toContain('[COMPANY_1]')
  })

  it('logs translation_context_applied when room has non-empty context', async () => {
    const traceId = 'trace-context-1'
    await store.update(enabledRoomId, {
      context: 'Room type: Client briefing',
    })

    await handleTranslateRequest(makeCommand(), { traceId })

    const entry = readJsonLogs().find((e) => e['event'] === 'translation_context_applied')
    expect(entry).toBeDefined()
    expect(entry).toMatchObject({
      level: 'info',
      service: 'translator',
      traceId,
      sourceMessageId: '2081046619322847232',
      roomId: 424846369,
      roomContextApplied: true,
      roomContextLength: Array.from('Room type: Client briefing'.trim()).length,
    })
  })

  it('does not log translation_context_applied when context is null', async () => {
    await store.update(enabledRoomId, { context: null })

    await handleTranslateRequest(makeCommand())

    const entry = readJsonLogs().find((e) => e['event'] === 'translation_context_applied')
    expect(entry).toBeUndefined()
  })

  it('does not log translation_context_applied when context is whitespace only', async () => {
    await store.update(enabledRoomId, { context: '   \n\t  ' })

    await handleTranslateRequest(makeCommand())

    const entry = readJsonLogs().find((e) => e['event'] === 'translation_context_applied')
    expect(entry).toBeUndefined()
  })

  it('logs translation_keywords_masked and translation_keywords_restored when keywords match text', async () => {
    const traceId = 'trace-kw-1'
    await store.update(enabledRoomId, {
      protectedKeywords: [{ keyword: 'AcmeCorp', category: 'company' }],
    })

    mockGetProviderPlugin.mockImplementationOnce(() =>
      createMockProvider('openai', {
        execute<T>(_prompts: PromptPair, schema: ISchema<T>): Promise<T> {
          return Promise.resolve(
            schema.parse({
              sourceLang: 'English',
              translated: 'Xin chào từ [COMPANY_1]',
            }),
          )
        },
        describeExecution() {
          return {
            generation: {
              temperature: 0,
              maxOutputTokens: 4000,
              providerOptions: null,
              providerManaged: false,
            },
          }
        },
      }),
    )

    await handleTranslateRequest(
      makeCommand({
        translatableText: 'Hello from AcmeCorp',
        translationInputs: ['Hello from AcmeCorp'],
      }),
      { traceId },
    )

    const logs = readJsonLogs()
    const masked = logs.find((e) => e['event'] === 'translation_keywords_masked')
    const restored = logs.find((e) => e['event'] === 'translation_keywords_restored')

    expect(masked).toMatchObject({
      level: 'info',
      traceId,
      configuredKeywordCount: 1,
      primaryTextChangedByMask: true,
      translationInputSegmentCount: 1,
      segmentsChangedByMaskCount: 1,
      hasSystemHint: true,
    })
    expect(restored).toMatchObject({
      level: 'info',
      traceId,
      configuredKeywordCount: 1,
      primaryTranslationChangedByRestore: true,
      segmentsChangedByRestoreCount: 1,
    })
  })

  it('always logs translation_keywords_masked when keywords configured but text does not match', async () => {
    await store.update(enabledRoomId, {
      protectedKeywords: [{ keyword: 'UnusedBrand', category: 'company' }],
    })

    await handleTranslateRequest(makeCommand())

    const masked = readJsonLogs().find((e) => e['event'] === 'translation_keywords_masked')
    expect(masked).toBeDefined()
    expect(masked).toMatchObject({
      configuredKeywordCount: 1,
      primaryTextChangedByMask: false,
      translationInputSegmentCount: 3,
      segmentsChangedByMaskCount: 0,
      hasSystemHint: false,
    })
  })

  it('logs translation_keywords_masked with configuredKeywordCount 0 when no keywords configured', async () => {
    await store.update(enabledRoomId, { protectedKeywords: [] })

    await handleTranslateRequest(makeCommand())

    const masked = readJsonLogs().find((e) => e['event'] === 'translation_keywords_masked')
    expect(masked).toMatchObject({
      configuredKeywordCount: 0,
      primaryTextChangedByMask: false,
      hasSystemHint: false,
    })
  })

  it('orders translation_context_applied before translation_keywords_masked before translation_keywords_restored', async () => {
    await store.update(enabledRoomId, {
      context: 'Sales room',
      protectedKeywords: [{ keyword: 'X', category: 'company' }],
    })

    mockGetProviderPlugin.mockImplementationOnce(() =>
      createMockProvider('openai', {
        execute<T>(_prompts: PromptPair, schema: ISchema<T>): Promise<T> {
          return Promise.resolve(
            schema.parse({
              sourceLang: 'English',
              translated: 'Thư từ [COMPANY_1]',
            }),
          )
        },
        describeExecution() {
          return {
            generation: {
              temperature: 0,
              maxOutputTokens: 4000,
              providerOptions: null,
              providerManaged: false,
            },
          }
        },
      }),
    )

    await handleTranslateRequest(
      makeCommand({
        translatableText: 'Mail from X',
        translationInputs: ['Mail from X'],
      }),
    )

    const logs = readJsonLogs()
    const idx = (name: string) => logs.findIndex((e) => e['event'] === name)
    const iCtx = idx('translation_context_applied')
    const iMask = idx('translation_keywords_masked')
    const iRestore = idx('translation_keywords_restored')

    expect(iCtx).toBeGreaterThanOrEqual(0)
    expect(iMask).toBeGreaterThanOrEqual(0)
    expect(iRestore).toBeGreaterThanOrEqual(0)
    expect(iCtx).toBeLessThan(iMask)
    expect(iMask).toBeLessThan(iRestore)
  })

  it('does not log translation_keywords_restored when pipeline fails before restore', async () => {
    await store.update(enabledRoomId, {
      protectedKeywords: [{ keyword: 'Y', category: 'company' }],
    })

    mockGetProviderPlugin.mockImplementationOnce(() =>
      createMockProvider(
        'openai',
        {
          execute<T>(_prompts: PromptPair, _schema: ISchema<T>): Promise<T> {
            return Promise.reject(new TranslationError('bad', 'INVALID_RESPONSE'))
          },
          describeExecution() {
            return {
              generation: {
                temperature: 0,
                maxOutputTokens: 4000,
                providerOptions: null,
                providerManaged: false,
              },
            }
          },
        },
        50,
      ),
    )

    await handleTranslateRequest(
      makeCommand({
        translatableText: 'Hello Y',
        translationInputs: ['Hello Y'],
      }),
    )

    const logs = readJsonLogs()
    expect(logs.some((e) => e['event'] === 'translation_keywords_masked')).toBe(true)
    expect(logs.some((e) => e['event'] === 'translation_keywords_restored')).toBe(false)
  })
})
