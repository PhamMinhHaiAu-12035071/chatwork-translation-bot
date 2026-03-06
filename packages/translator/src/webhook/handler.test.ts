import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ChatworkWebhookEvent, TranslationResult } from '@chatwork-bot/core'
import type { handleTranslateRequest as HandleTranslateRequestType } from './handler'

let isMessageEvent = true
let strippedText = 'clean text'
let translationResult: TranslationResult = {
  cleanText: 'clean text',
  translatedText: 'bản dịch',
  sourceLang: 'Japanese',
  targetLang: 'Vietnamese',
  timestamp: '2026-03-04T14:16:21.864Z',
}

const mockTranslate = mock((_text: string) => Promise.resolve(translationResult))
const mockPluginCreate = mock((_ctx: unknown) => ({ translate: mockTranslate }))
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
    public readonly code: 'API_ERROR' | 'QUOTA_EXCEEDED' | 'INVALID_RESPONSE' | 'UNKNOWN',
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
    translationResult = {
      cleanText: strippedText,
      translatedText: 'Đoạn A\n\nĐoạn B đã được làm mượt.',
      sourceLang: 'Japanese',
      targetLang: 'Vietnamese',
      timestamp: '2026-03-04T14:16:21.864Z',
    }
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
    const translateStart = mockTranslate.mock.calls.length

    await handleTranslateRequest(event)

    expect(mockGetProviderPlugin.mock.calls.length).toBe(getStart + 1)
    expect(mockGetProviderPlugin.mock.calls.at(-1)?.[0]).toBe('openai')
    expect(mockTranslate.mock.calls.length).toBe(translateStart + 1)
    expect(mockTranslate.mock.calls.at(-1)?.[0]).toBe('A\n\nB\nC')
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
    const translateStart = mockTranslate.mock.calls.length

    await handleTranslateRequest(event)

    expect(mockGetProviderPlugin.mock.calls.length).toBe(getStart)
    expect(mockTranslate.mock.calls.length).toBe(translateStart)
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
    const translateStart = mockTranslate.mock.calls.length

    await handleTranslateRequest(event)

    expect(mockGetProviderPlugin.mock.calls.length).toBe(getStart)
    expect(mockTranslate.mock.calls.length).toBe(translateStart)
  })
})
