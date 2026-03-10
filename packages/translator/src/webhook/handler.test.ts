import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
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

function createMockExecutor(): ILLMExecutor {
  return {
    execute<T>(_prompts: PromptPair, schema: ISchema<T>): Promise<T> {
      const response = pipelineFixtures[executeCallCount % pipelineFixtures.length]
      executeCallCount++
      return Promise.resolve(schema.parse(response))
    },
  }
}

// ── Module mocks ───────────────────────────────────────────────────────────────

let isMessageEvent = true
let strippedText = 'A\n\nB\nC'

const mockPluginCreate = mock((_ctx: unknown) => createMockExecutor())
const mockGetProviderPlugin = mock((_id: string) => ({
  manifest: {
    id: 'openai',
    defaultModel: 'gpt-4o',
    supportedModels: ['gpt-4o'],
    capabilities: { streaming: false },
  },
  create: mockPluginCreate,
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
        sendMessage = mock(() => Promise.resolve({ message_id: 'mock-id' }))
      },
    }))

    void mock.module('../env', () => ({
      env: {
        AI_PROVIDER: 'openai',
        AI_MODEL: 'gpt-4o',
        CHATWORK_API_TOKEN: 'test-token',
        CHATWORK_DESTINATION_ROOM_ID: 99999,
      },
    }))

    const mod = await import('./handler')
    handleTranslateRequest = mod.handleTranslateRequest
  })

  afterAll(() => {
    delete process.env['OUTPUT_BASE_DIR']
    rmSync(testOutputDir, { recursive: true, force: true })
  })

  beforeEach(() => {
    isMessageEvent = true
    strippedText = 'A\n\nB\nC'
    executeCallCount = 0
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
