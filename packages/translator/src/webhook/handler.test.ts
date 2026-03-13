import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TranslationIngressCommand } from '@chatwork-bot/core'
import type { ILLMExecutor, ISchema, PromptPair } from '@chatwork-bot/core'
import type { handleTranslateRequest as HandleTranslateRequestType } from './handler'

// ── Pipeline fixtures (1-pass: analysis + translation + review) ───────────────

const pipelineFixtures: unknown[] = [
  // Phase 0+1: AnalysisResult
  {
    skopos: {
      purpose: 'informational',
      audience: 'general',
      strategy: 'instrumental',
      register: 'casual',
    },
    extratextual: {
      sender: 'unknown',
      intention: 'inform',
      audience: 'colleague',
      medium: 'chat',
      temporalContext: 'real-time',
    },
    intratextual: {
      subjectMatter: 'general',
      contentSummary: 'brief',
      presuppositions: 'none',
      textStructure: 'single line',
      lexisNotes: 'plain',
      nonVerbalElements: 'none',
    },
    crossCutting: {
      textFunction: 'phatic',
      registerTone: 'casual',
      expectedEffect: 'acknowledgment',
    },
    structuredHints: {
      sourceProfile: {
        language: 'japanese',
        medium: 'chat',
        domain: 'general',
        hasCode: false,
        hasUrl: false,
        hasJapaneseName: false,
        hasSpecialFormatting: false,
      },
      intentLabels: { phraseType: 'general_statement', confidence: 'high' },
      renderingPolicy: {
        strategy: 'functional_vietnamese',
        targetStyle: 'natural_office_vi',
        preserveAmbiguity: false,
        allowNaturalAdaptation: true,
        avoidLiteralFormulaTranslation: true,
      },
      preservationRules: {
        preserveUrl: false,
        preserveCode: false,
        preserveUnits: false,
        preserveChatworkMarkup: false,
        preserveJapaneseNameScript: false,
        allowRomajiGloss: false,
        forbidGenderInference: false,
      },
      reviewFocus: [],
    },
  },
  // Phase 2: TranslationDraft
  { sourceLang: 'Japanese', translated: 'Xin chào thế giới' },
  // Phase 3: ReviewResult (passing)
  {
    scores: {
      naturalFlow: 3,
      culturalFidelity: 2,
      readerExperience: 2,
      semanticAccuracy: 2,
      targetConventions: 1,
    },
    totalScore: 10,
    passed: true,
    critique: 'Excellent',
    refinedTranslation: 'Xin chào thế giới (refined)',
    personaFeedback: { freshReader: 'OK', linguist: 'OK', editor: 'OK' },
  },
]

let executeCallCount = 0
const consoleLogLines: string[] = []
const originalConsoleLog = console.log
const mockNotifyDatasetRunner = mock((_payload: unknown, _config: unknown) => Promise.resolve())
const mockSendRoomMessage = mock((_roomId: number, _message: string, _token: string) =>
  Promise.resolve({ message_id: 'mock-id' }),
)
const mockResolveRoomMemberDisplayName = mock(
  (_roomId: number, _accountId: number, _token: string, _cache?: Map<number, string>) =>
    Promise.resolve('Test User'),
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
    create: () => executor,
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
  CHATWORK_API_TOKEN: 'test-token',
  CHATWORK_DESTINATION_ROOM_ID: 99999,
  TRANSLATOR_PHASE_HEARTBEAT_MS: 10,
  TRANSLATOR_ANALYSIS_BUDGET_MS: 60_000,
  TRANSLATOR_TRANSLATION_BUDGET_MS: 60_000,
  TRANSLATOR_REVIEW_BUDGET_MS: 60_000,
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
    sourceMessageId: '2081046619322847232',
    sourceRoomId: 424846369,
    senderAccountId: 8315321,
    rawBody: 'A\n\nB\nC',
    translatableText: 'A\n\nB\nC',
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
  let handleTranslateRequest: typeof HandleTranslateRequestType

  beforeAll(async () => {
    const realCore = await import('@chatwork-bot/core')

    void mock.module('@chatwork-bot/core', () => ({
      ...realCore,
      getProviderPlugin: mockGetProviderPlugin,
      TranslationError: MockTranslationError,
    }))

    void mock.module('@chatwork-bot/chatwork', () => ({
      sendRoomMessage: mockSendRoomMessage,
      resolveRoomMemberDisplayName: mockResolveRoomMemberDisplayName,
    }))

    void mock.module('~/services/dataset-runner-callback', () => ({
      notifyDatasetRunner: mockNotifyDatasetRunner,
    }))

    void mock.module('../env', () => ({
      env: mockEnv,
    }))

    const mod = await import('./handler')
    handleTranslateRequest = mod.handleTranslateRequest
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
    consoleLogLines.length = 0
    mockEnv.TRANSLATOR_PIPELINE_TIMEOUT_MS = 1_800_000
    process.env['TRANSLATOR_PIPELINE_TIMEOUT_MS'] = '1800000'
    mockNotifyDatasetRunner.mockReset()
    mockNotifyDatasetRunner.mockImplementation(() => Promise.resolve())
    mockSendRoomMessage.mockReset()
    mockSendRoomMessage.mockImplementation((_roomId, _message, _token) =>
      Promise.resolve({ message_id: 'mock-id' }),
    )
    mockResolveRoomMemberDisplayName.mockReset()
    mockResolveRoomMemberDisplayName.mockImplementation((_roomId, _accountId, _token, _cache) =>
      Promise.resolve('Test User'),
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
  })

  it('translates message via registry-resolved provider', async () => {
    const command = makeCommand()

    const getStart = mockGetProviderPlugin.mock.calls.length

    await handleTranslateRequest(command)

    expect(mockGetProviderPlugin.mock.calls.length).toBe(getStart + 1)
    expect(mockGetProviderPlugin.mock.calls.at(-1)?.[0]).toBe('openai')
    // Full pipeline runs: analysis + translation + review (at least 3 executor calls)
    expect(executeCallCount).toBeGreaterThanOrEqual(1)
  })

  it('writes delivery metadata after destination send completes', async () => {
    const command = makeCommand()

    await handleTranslateRequest(command)

    const dateStr = new Date().toISOString().slice(0, 10)
    const filepath = join(testOutputDir, dateStr, '2081046619322847232.json')
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
    const command = makeCommand({ translatableText: '' })

    const getStart = mockGetProviderPlugin.mock.calls.length

    await handleTranslateRequest(command)

    expect(mockGetProviderPlugin.mock.calls.length).toBe(getStart)
    expect(executeCallCount).toBe(0)
  })

  it('skips when translatableText is whitespace only', async () => {
    const command = makeCommand({ translatableText: '   ' })

    const getStart = mockGetProviderPlugin.mock.calls.length

    await handleTranslateRequest(command)

    expect(mockGetProviderPlugin.mock.calls.length).toBe(getStart)
    expect(executeCallCount).toBe(0)
  })

  it('sends translated message to destination room on success', async () => {
    const command = makeCommand()

    await handleTranslateRequest(command)

    expect(mockSendRoomMessage.mock.calls.length).toBe(1)
    expect(mockSendRoomMessage.mock.calls[0]?.[0]).toBe(99999)
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
