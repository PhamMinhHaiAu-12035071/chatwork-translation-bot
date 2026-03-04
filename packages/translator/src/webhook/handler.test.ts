import { beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
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
const mockCreate = mock((_provider: string, _model?: string) => ({ translate: mockTranslate }))
const mockStripChatworkMarkup = mock((_text: string) => strippedText)
const mockIsChatworkMessageEvent = mock((_event: ChatworkWebhookEvent) => isMessageEvent)

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
      TranslationServiceFactory: {
        create: mockCreate,
      },
      TranslationError: MockTranslationError,
    }))

    void mock.module('../env', () => ({
      env: {
        AI_PROVIDER: 'openai',
        AI_MODEL: 'gpt-4o',
      },
    }))

    const mod = await import('./handler')
    handleTranslateRequest = mod.handleTranslateRequest
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

  it('translates message and calls service with stripped text', async () => {
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

    const createStart = mockCreate.mock.calls.length
    const translateStart = mockTranslate.mock.calls.length

    await handleTranslateRequest(event)

    expect(mockCreate.mock.calls.length).toBe(createStart + 1)
    expect(mockCreate.mock.calls.at(-1)).toEqual(['openai', 'gpt-4o'])
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

    const createStart = mockCreate.mock.calls.length
    const translateStart = mockTranslate.mock.calls.length

    await handleTranslateRequest(event)

    expect(mockCreate.mock.calls.length).toBe(createStart)
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

    const createStart = mockCreate.mock.calls.length
    const translateStart = mockTranslate.mock.calls.length

    await handleTranslateRequest(event)

    expect(mockCreate.mock.calls.length).toBe(createStart)
    expect(mockTranslate.mock.calls.length).toBe(translateStart)
  })
})
