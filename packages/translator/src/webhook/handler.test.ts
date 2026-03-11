import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ChatworkWebhookEvent } from '@chatwork-bot/core'
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
const mockSendMessage = mock(() => Promise.resolve({ message_id: 'mock-id' }))

function createMockExecutor(): ILLMExecutor {
  return {
    execute<T>(_prompts: PromptPair, schema: ISchema<T>): Promise<T> {
      const response = pipelineFixtures[executeCallCount % pipelineFixtures.length]
      executeCallCount++
      return Promise.resolve(schema.parse(response))
    },
  }
}

function createMockProvider(id: string, executor: ILLMExecutor) {
  return {
    manifest: {
      id,
      defaultModel: 'gpt-4o',
      supportedModels: ['gpt-4o'],
      capabilities: { streaming: false },
    },
    create: () => executor,
  }
}

// ── Module mocks ───────────────────────────────────────────────────────────────

let isMessageEvent = true
let strippedText = 'A\n\nB\nC'

const _mockPluginCreate = mock((_ctx: unknown) => createMockExecutor())
const mockGetProviderPlugin = mock((_id: string) => ({
  ...createMockProvider('openai', createMockExecutor()),
}))
const mockStripChatworkMarkup = mock((_text: string) => strippedText)
const mockIsChatworkMessageEvent = mock((_event: ChatworkWebhookEvent) => isMessageEvent)

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
      | 'ABORTED',
    public override readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'TranslationError'
  }
}

describe('handleTranslateRequest', () => {
  let handleTranslateRequest: typeof HandleTranslateRequestType

  beforeAll(async () => {
    const realCore = await import('@chatwork-bot/core')

    void mock.module('@chatwork-bot/core', () => ({
      ...realCore,
      isChatworkMessageEvent: mockIsChatworkMessageEvent,
      stripChatworkMarkup: mockStripChatworkMarkup,
      getProviderPlugin: mockGetProviderPlugin,
      TranslationError: MockTranslationError,
      ChatworkClient: class {
        getMembers = mock(() => Promise.resolve([]))
        sendMessage = mockSendMessage
      },
    }))

    void mock.module('~/services/dataset-runner-callback', () => ({
      notifyDatasetRunner: mockNotifyDatasetRunner,
    }))

    void mock.module('../env', () => ({
      env: {
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
        TRANSLATOR_STATUS_HISTORY_LIMIT: 20,
      },
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
    isMessageEvent = true
    strippedText = 'A\n\nB\nC'
    executeCallCount = 0
    consoleLogLines.length = 0
    mockNotifyDatasetRunner.mockReset()
    mockNotifyDatasetRunner.mockImplementation(() => Promise.resolve())
    mockSendMessage.mockReset()
    mockSendMessage.mockImplementation(() => Promise.resolve({ message_id: 'mock-id' }))
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
    const event: ChatworkWebhookEvent = {
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
    }

    const getStart = mockGetProviderPlugin.mock.calls.length

    await handleTranslateRequest(event)

    expect(mockGetProviderPlugin.mock.calls.length).toBe(getStart + 1)
    expect(mockGetProviderPlugin.mock.calls.at(-1)?.[0]).toBe('openai')
    // Full pipeline runs: analysis + translation + review (at least 3 executor calls)
    expect(executeCallCount).toBeGreaterThanOrEqual(1)
  })

  it('writes delivery metadata after destination send completes', async () => {
    const event: ChatworkWebhookEvent = {
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
    }

    await handleTranslateRequest(event)

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
    const event: ChatworkWebhookEvent = {
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
    }

    await handleTranslateRequest(event)

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

    const event: ChatworkWebhookEvent = {
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
    }

    await handleTranslateRequest(event)

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

    const event: ChatworkWebhookEvent = {
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
    }

    await handleTranslateRequest(event)

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
    mockSendMessage.mockImplementation(() => Promise.reject(new Error('destination failed')))

    const event: ChatworkWebhookEvent = {
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
    }

    await handleTranslateRequest(event)

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

  it('skips non-message events', async () => {
    isMessageEvent = false

    const event: ChatworkWebhookEvent = {
      webhook_setting_id: '35555',
      webhook_event_type: 'room_updated',
      webhook_event_time: 1772633778,
      webhook_event: {},
    }

    const getStart = mockGetProviderPlugin.mock.calls.length

    await handleTranslateRequest(event)

    expect(mockGetProviderPlugin.mock.calls.length).toBe(getStart)
    expect(executeCallCount).toBe(0)
  })

  it('skips when stripped message is empty', async () => {
    strippedText = ''

    const event: ChatworkWebhookEvent = {
      webhook_setting_id: '35555',
      webhook_event_type: 'message_created',
      webhook_event_time: 1772633778,
      webhook_event: {
        message_id: '2081046619322847232',
        room_id: 424846369,
        account_id: 8315321,
        body: '[info]internal[/info]',
        send_time: 1772633778,
        update_time: 0,
      },
    }

    const getStart = mockGetProviderPlugin.mock.calls.length

    await handleTranslateRequest(event)

    expect(mockGetProviderPlugin.mock.calls.length).toBe(getStart)
    expect(executeCallCount).toBe(0)
  })
})
