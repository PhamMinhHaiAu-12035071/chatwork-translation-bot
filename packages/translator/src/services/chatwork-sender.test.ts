import { beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { ChatworkApiError, ChatworkRateLimitError } from '@chatwork-bot/chatwork'
import type { TranslationIngressCommand, TranslationResult } from '@chatwork-bot/core'
import type { OutputDelivery } from '~/types/output'

const makeCommand = (
  overrides: Partial<TranslationIngressCommand> = {},
): TranslationIngressCommand => ({
  sourceSystem: 'chatwork',
  sourceEventId: 'msg-123:message_created:1772633778',
  sourceEventType: 'message_created',
  sourceMessageId: 'msg-123',
  sourceRoomId: 98765,
  senderAccountId: 34567,
  rawBody: 'おはようございます',
  translatableText: 'おはようございます',
  translationInputs: ['おはようございます'],
  sendTime: 1772633778,
  updateTime: 0,
  audit: {
    receivedAt: new Date().toISOString(),
    rawSourceSnapshot: {
      webhookPayload: {
        webhook_setting_id: 'ws-1',
        webhook_event_type: 'message_created',
        webhook_event_time: 1772633778,
        webhook_event: {
          message_id: 'msg-123',
          room_id: 98765,
          account_id: 34567,
          body: 'おはようございます',
          send_time: 1772633778,
          update_time: 0,
        },
      },
      snapshot: {
        translationInputs: ['おはようございます'],
        translatableText: 'おはようございます',
        metadata: {
          toAccountIds: [],
          ccAccountIds: [],
        },
        renderTemplate: [],
      },
    },
  },
  ...overrides,
})

const makeResult = (overrides: Partial<TranslationResult> = {}): TranslationResult => ({
  cleanText: 'おはようございます',
  translatedText: 'Chào buổi sáng!',
  sourceLang: 'Japanese',
  targetLang: 'Vietnamese',
  timestamp: '2026-03-06T10:30:00.000Z',
  ...overrides,
})

describe('sendTranslatedMessage', () => {
  const metadataMessage =
    '[piconname:34567]\nEvent: created\nSender: TestUser\nRoom: TestRoom\nSent: 2026-03-06 10:30'
  const bodyMessage = '[info]Chào buổi sáng![/info]'

  const mockComposeTranslatedMessage = mock(
    (
      _command: TranslationIngressCommand,
      _params: { translatedSegments: string[]; apiToken: string },
    ) =>
      Promise.resolve({
        message: `${metadataMessage}\n${bodyMessage}`,
      }),
  )
  const mockSendRoomMessage = mock((_roomId: number, message: string, _token: string) =>
    Promise.resolve({
      message_id: message === metadataMessage ? 'meta-123' : 'body-456',
    }),
  )

  let sendTranslatedMessage: (
    command: TranslationIngressCommand,
    result: TranslationResult,
    config: {
      apiToken: string
      destinationRoomId: number
      translatedSegments?: string[]
    },
    sleepFn?: (ms: number) => Promise<void>,
  ) => Promise<OutputDelivery>

  beforeAll(async () => {
    void mock.module('@chatwork-bot/chatwork', () => ({
      composeTranslatedMessage: mockComposeTranslatedMessage,
      sendRoomMessage: mockSendRoomMessage,
      ChatworkApiError,
      ChatworkRateLimitError,
    }))

    const mod = await import('./chatwork-sender')
    sendTranslatedMessage = mod.sendTranslatedMessage
  })

  beforeEach(() => {
    mockComposeTranslatedMessage.mockClear()
    mockSendRoomMessage.mockClear()
    mockComposeTranslatedMessage.mockImplementation(
      (
        _command: TranslationIngressCommand,
        _params: { translatedSegments: string[]; apiToken: string },
      ) =>
        Promise.resolve({
          message: `${metadataMessage}\n${bodyMessage}`,
        }),
    )
    mockSendRoomMessage.mockImplementation((_roomId: number, _message: string, _token: string) =>
      Promise.resolve({
        message_id: 'msg-123',
      }),
    )
  })

  it('sends a single combined message and returns a sent delivery record', async () => {
    const delivery = await sendTranslatedMessage(makeCommand(), makeResult(), {
      apiToken: 'test-token',
      destinationRoomId: 55555,
      translatedSegments: ['Chào buổi sáng!'],
    })

    expect(mockComposeTranslatedMessage.mock.calls.length).toBe(1)
    expect(mockComposeTranslatedMessage.mock.calls[0]?.[1]).toEqual({
      apiToken: 'test-token',
      translatedSegments: ['Chào buổi sáng!'],
    })
    expect(mockSendRoomMessage.mock.calls.length).toBe(1)
    expect(mockSendRoomMessage.mock.calls[0]?.[0]).toBe(55555)
    expect(delivery).toMatchObject({
      status: 'sent',
      destinationRoomId: 55555,
      destinationMessageId: 'msg-123',
      messages: [
        {
          kind: 'body',
          status: 'sent',
          destinationMessageId: 'msg-123',
        },
      ],
    })
    expect(typeof delivery.sentAt).toBe('string')
  })

  it('falls back to result.translatedText as a single segment when translatedSegments is omitted', async () => {
    await sendTranslatedMessage(makeCommand(), makeResult(), {
      apiToken: 'test-token',
      destinationRoomId: 55555,
    })

    expect(mockComposeTranslatedMessage.mock.calls[0]?.[1]).toEqual({
      apiToken: 'test-token',
      translatedSegments: ['Chào buổi sáng!'],
    })
  })

  it('returns failed when the combined message fails with a non-retriable error', async () => {
    mockSendRoomMessage.mockImplementationOnce(() =>
      Promise.reject(new ChatworkApiError('Bad Gateway', 502, 'Bad Gateway')),
    )

    const delivery = await sendTranslatedMessage(makeCommand(), makeResult(), {
      apiToken: 'test-token',
      destinationRoomId: 55555,
      translatedSegments: ['Chào buổi sáng!'],
    })

    expect(mockSendRoomMessage.mock.calls.length).toBe(1)
    expect(delivery).toMatchObject({
      status: 'failed',
      destinationRoomId: 55555,
      errorCode: 'ChatworkApiError',
      errorMessage: 'Bad Gateway',
      messages: [
        {
          kind: 'body',
          status: 'failed',
          errorCode: 'ChatworkApiError',
          errorMessage: 'Bad Gateway',
        },
      ],
    })
  })

  it('retries the combined message after rate limit errors', async () => {
    const sleepFn = mock((_ms: number) => Promise.resolve())

    mockSendRoomMessage
      .mockImplementationOnce(() => Promise.reject(new ChatworkRateLimitError(3)))
      .mockImplementationOnce(() => Promise.reject(new ChatworkRateLimitError(3)))
      .mockImplementationOnce(() => Promise.resolve({ message_id: 'msg-123' }))

    const delivery = await sendTranslatedMessage(
      makeCommand(),
      makeResult(),
      {
        apiToken: 'test-token',
        destinationRoomId: 55555,
        translatedSegments: ['Chào buổi sáng!'],
      },
      sleepFn,
    )

    expect(mockComposeTranslatedMessage.mock.calls.length).toBe(1)
    expect(mockSendRoomMessage.mock.calls.length).toBe(3)
    expect(sleepFn.mock.calls).toEqual([[3000], [3000]])
    expect(delivery.status).toBe('sent')
    expect(delivery.messages).toEqual([
      {
        kind: 'body',
        status: 'sent',
        destinationMessageId: 'msg-123',
      },
    ])
  })

  it('returns failed when the combined message fails', async () => {
    mockSendRoomMessage.mockImplementationOnce(() =>
      Promise.reject(new ChatworkApiError('Unauthorized', 401, 'Unauthorized')),
    )

    const delivery = await sendTranslatedMessage(makeCommand(), makeResult(), {
      apiToken: 'test-token',
      destinationRoomId: 55555,
      translatedSegments: ['Chào buổi sáng!'],
    })

    expect(mockSendRoomMessage.mock.calls.length).toBe(1)
    expect(delivery).toMatchObject({
      status: 'failed',
      destinationRoomId: 55555,
      errorCode: 'ChatworkApiError',
      errorMessage: 'Unauthorized',
      messages: [
        {
          kind: 'body',
          status: 'failed',
          errorCode: 'ChatworkApiError',
          errorMessage: 'Unauthorized',
        },
      ],
    })
  })

  it('returns failed and sends nothing when compose validation fails before delivery starts', async () => {
    mockComposeTranslatedMessage.mockImplementationOnce(() =>
      Promise.reject(new Error('Unused translated segments: expected 1, used 0')),
    )

    const delivery = await sendTranslatedMessage(makeCommand(), makeResult(), {
      apiToken: 'test-token',
      destinationRoomId: 55555,
      translatedSegments: ['[info]Injected[/info]'],
    })

    expect(mockSendRoomMessage.mock.calls).toHaveLength(0)
    expect(delivery).toMatchObject({
      status: 'failed',
      destinationRoomId: 55555,
      errorCode: 'Error',
      errorMessage: 'Unused translated segments: expected 1, used 0',
    })
  })

  it('delivers a combined message when translatedSegments is empty but the body has meaningful literal structure', async () => {
    const literalBodyMessage = '[code]const x = 1[/code]'

    mockComposeTranslatedMessage.mockImplementationOnce(
      (
        _command: TranslationIngressCommand,
        _params: { translatedSegments: string[]; apiToken: string },
      ) =>
        Promise.resolve({
          message: `${metadataMessage}\n${literalBodyMessage}`,
        }),
    )

    const delivery = await sendTranslatedMessage(
      makeCommand({
        rawBody: '[code]const x = 1[/code]',
        translatableText: '',
        translationInputs: [],
      }),
      makeResult({
        cleanText: '',
        translatedText: '',
      }),
      {
        apiToken: 'test-token',
        destinationRoomId: 55555,
        translatedSegments: [],
      },
    )

    expect(mockComposeTranslatedMessage.mock.calls[0]?.[1]).toEqual({
      apiToken: 'test-token',
      translatedSegments: [],
    })
    expect(mockSendRoomMessage.mock.calls.length).toBe(1)
    expect(delivery.status).toBe('sent')
  })
})
