import { beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import type { TranslationResult } from '@chatwork-bot/core'
import type { TranslationIngressCommand } from '@chatwork-bot/core'
import type { OutputDelivery } from '~/types/output'

import { buildTranslatedMessage } from './chatwork-sender'
import { ChatworkApiError, ChatworkRateLimitError } from '@chatwork-bot/chatwork'

const makeCommand = (
  overrides: Partial<TranslationIngressCommand> = {},
): TranslationIngressCommand => ({
  sourceSystem: 'chatwork',
  sourceMessageId: 'msg-123',
  sourceRoomId: 98765,
  senderAccountId: 34567,
  rawBody: 'おはようございます',
  translatableText: 'おはようございます',
  sendTime: 1772633778,
  updateTime: 0,
  audit: {
    receivedAt: new Date().toISOString(),
    rawSourceSnapshot: {
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
  },
  ...overrides,
})

const makeResult = (): TranslationResult => ({
  cleanText: 'おはようございます',
  translatedText: 'Chào buổi sáng!',
  sourceLang: 'Japanese',
  targetLang: 'Vietnamese',
  timestamp: '2026-03-06T10:30:00.000Z',
})

describe('buildTranslatedMessage', () => {
  it('includes [info][title] wrapper with sender name and datetime only', () => {
    const msg = buildTranslatedMessage(makeCommand(), makeResult(), 'Nguyen Van A')

    expect(msg).toContain('[info][title]')
    expect(msg).toContain('[/title]')
    expect(msg).toContain('[/info]')
    expect(msg).toContain('Nguyen Van A')
    expect(msg).toContain('2026-03-0') // timestamp from send_time present (date portion, UTC-safe)
    expect(msg).not.toContain('Room#')
    expect(msg).not.toContain('MsgID:')
  })

  it('includes translated text in the body', () => {
    const msg = buildTranslatedMessage(makeCommand(), makeResult(), 'Nguyen Van A')

    expect(msg).toContain('Chào buổi sáng!')
  })

  it('extracts and includes [To:xxx] tags from original body', () => {
    const command = makeCommand({ rawBody: '[To:1484814]おはようございます' })
    const msg = buildTranslatedMessage(command, makeResult(), 'Nguyen Van A')

    expect(msg).toContain('[To:1484814]')
    expect(msg).toContain('Chào buổi sáng!')
  })

  it('extracts and includes [cc:xxx] tags from original body', () => {
    const command = makeCommand({ rawBody: '[cc:9999]本日の会議' })
    const msg = buildTranslatedMessage(command, makeResult(), 'Nguyen Van A')

    expect(msg).toContain('[cc:9999]')
  })

  it('extracts multiple markup tags', () => {
    const command = makeCommand({ rawBody: '[To:111][To:222][cc:333]テキスト' })
    const msg = buildTranslatedMessage(command, makeResult(), 'Nguyen Van A')

    expect(msg).toContain('[To:111]')
    expect(msg).toContain('[To:222]')
    expect(msg).toContain('[cc:333]')
  })

  it('works without any [To:]/[cc:] tags', () => {
    const command = makeCommand({ rawBody: 'プレーンテキスト' })
    const msg = buildTranslatedMessage(command, makeResult(), 'Nguyen Van A')

    expect(msg).toContain('Chào buổi sáng!')
    expect(msg).not.toContain('[To:')
  })

  it('uses fallback #account_id when sender name is already formatted that way', () => {
    const msg = buildTranslatedMessage(makeCommand(), makeResult(), '#34567')

    expect(msg).toContain('#34567')
  })
})

describe('sendTranslatedMessage', () => {
  const mockResolveRoomMemberDisplayName = mock(
    (_roomId: number, _accountId: number, _token: string, _cache?: Map<number, string>) =>
      Promise.resolve('Nguyen Van A'),
  )
  const mockSendRoomMessage = mock((_roomId: number, _message: string, _token: string) =>
    Promise.resolve({ message_id: 'sent-456' }),
  )

  let sendTranslatedMessage: (
    command: TranslationIngressCommand,
    result: TranslationResult,
    config: { apiToken: string; destinationRoomId: number },
    sleepFn?: (ms: number) => Promise<void>,
  ) => Promise<OutputDelivery>

  beforeAll(async () => {
    void mock.module('@chatwork-bot/chatwork', () => ({
      sendRoomMessage: mockSendRoomMessage,
      resolveRoomMemberDisplayName: mockResolveRoomMemberDisplayName,
      ChatworkApiError,
      ChatworkRateLimitError,
    }))

    const mod = await import('./chatwork-sender')
    sendTranslatedMessage = mod.sendTranslatedMessage
  })

  beforeEach(() => {
    mockResolveRoomMemberDisplayName.mockClear()
    mockSendRoomMessage.mockClear()
    mockResolveRoomMemberDisplayName.mockImplementation((_roomId, _accountId, _token, _cache) =>
      Promise.resolve('Nguyen Van A'),
    )
    mockSendRoomMessage.mockImplementation((_roomId, _message, _token) =>
      Promise.resolve({ message_id: 'sent-456' }),
    )
  })

  it('resolves sender display name through resolveRoomMemberDisplayName with source room_id and account_id', async () => {
    await sendTranslatedMessage(makeCommand(), makeResult(), {
      apiToken: 'test-token',
      destinationRoomId: 55555,
    })

    expect(mockResolveRoomMemberDisplayName.mock.calls.length).toBe(1)
    const [roomId, accountId] = mockResolveRoomMemberDisplayName.mock.calls[0] ?? []
    expect(roomId).toBe(98765)
    expect(accountId).toBe(34567)
  })

  it('sends message through sendRoomMessage with destination roomId', async () => {
    await sendTranslatedMessage(makeCommand(), makeResult(), {
      apiToken: 'test-token',
      destinationRoomId: 55555,
    })

    expect(mockSendRoomMessage.mock.calls.length).toBe(1)
    expect(mockSendRoomMessage.mock.calls[0]?.[0]).toBe(55555)
  })

  it('uses sender name from display name resolution', async () => {
    await sendTranslatedMessage(makeCommand(), makeResult(), {
      apiToken: 'test-token',
      destinationRoomId: 55555,
    })

    const sentMessage = mockSendRoomMessage.mock.calls[0]?.[1] ?? ''
    expect(sentMessage).toContain('Nguyen Van A')
  })

  it('falls back to #account_id when resolveRoomMemberDisplayName returns fallback', async () => {
    mockResolveRoomMemberDisplayName.mockImplementationOnce(() => Promise.resolve('#34567'))

    await sendTranslatedMessage(makeCommand(), makeResult(), {
      apiToken: 'test-token',
      destinationRoomId: 55555,
    })

    const sentMessage = mockSendRoomMessage.mock.calls[0]?.[1] ?? ''
    expect(sentMessage).toContain('#34567')
  })

  it('returns sent delivery metadata when destination send succeeds', async () => {
    const result = await sendTranslatedMessage(makeCommand(), makeResult(), {
      apiToken: 'test-token',
      destinationRoomId: 55555,
    })

    expect(result.status).toBe('sent')
    expect(result.destinationRoomId).toBe(55555)
    expect(result.destinationMessageId).toBe('sent-456')
  })

  it('returns failed delivery metadata when destination send fails', async () => {
    mockSendRoomMessage.mockImplementationOnce(() => Promise.reject(new Error('API error')))

    const result = await sendTranslatedMessage(makeCommand(), makeResult(), {
      apiToken: 'test-token',
      destinationRoomId: 55555,
    })

    expect(result.status).toBe('failed')
    expect(result.errorMessage).toContain('API error')
  })

  it('does not throw when resolveRoomMemberDisplayName fails — returns failed delivery', async () => {
    mockResolveRoomMemberDisplayName.mockImplementationOnce(() =>
      Promise.reject(new Error('network error')),
    )

    const result = await sendTranslatedMessage(makeCommand(), makeResult(), {
      apiToken: 'test-token',
      destinationRoomId: 55555,
    })
    expect(result.status).toBe('failed')
  })

  it('does not throw when sendRoomMessage fails — returns failed delivery', async () => {
    mockSendRoomMessage.mockImplementationOnce(() => Promise.reject(new Error('API error')))

    const result = await sendTranslatedMessage(makeCommand(), makeResult(), {
      apiToken: 'test-token',
      destinationRoomId: 55555,
    })
    expect(result.status).toBe('failed')
  })

  describe('retry behavior', () => {
    const config = { apiToken: 'test-token', destinationRoomId: 55555 }
    const makeNoopSleepFn = () => mock((_ms: number) => Promise.resolve())

    it('retries on network TypeError and succeeds on second attempt', async () => {
      mockResolveRoomMemberDisplayName.mockImplementationOnce(() => {
        throw new TypeError('Unable to connect. Is the computer able to access the url?')
      })
      const sleepFn = makeNoopSleepFn()

      const result = await sendTranslatedMessage(makeCommand(), makeResult(), config, sleepFn)

      expect(result.status).toBe('sent')
      expect(mockResolveRoomMemberDisplayName.mock.calls.length).toBe(2)
      expect(sleepFn.mock.calls.length).toBe(1)
      expect(sleepFn.mock.calls[0]?.[0]).toBe(1000)
    })

    it('retries on plain Error with network message and succeeds on second attempt', async () => {
      // Bun throws plain Error (not TypeError) for TCP connection failures in production
      mockResolveRoomMemberDisplayName.mockImplementationOnce(() => {
        throw new Error('Unable to connect. Is the computer able to access the url?')
      })
      const sleepFn = makeNoopSleepFn()

      const result = await sendTranslatedMessage(makeCommand(), makeResult(), config, sleepFn)

      expect(result.status).toBe('sent')
      expect(mockResolveRoomMemberDisplayName.mock.calls.length).toBe(2)
      expect(sleepFn.mock.calls.length).toBe(1)
      expect(sleepFn.mock.calls[0]?.[0]).toBe(1000)
    })

    it('retries on Bun "typo in url or port" error variant and succeeds on second attempt', async () => {
      // Bun's second observed error variant for TCP connection failures
      mockResolveRoomMemberDisplayName.mockImplementationOnce(() => {
        throw new Error('Was there a typo in the url or port?')
      })
      const sleepFn = makeNoopSleepFn()

      const result = await sendTranslatedMessage(makeCommand(), makeResult(), config, sleepFn)

      expect(result.status).toBe('sent')
      expect(mockResolveRoomMemberDisplayName.mock.calls.length).toBe(2)
      expect(sleepFn.mock.calls.length).toBe(1)
      expect(sleepFn.mock.calls[0]?.[0]).toBe(1000)
    })

    it('retries on ChatworkRateLimitError and succeeds on third attempt', async () => {
      mockSendRoomMessage
        .mockImplementationOnce(() => Promise.reject(new ChatworkRateLimitError(3)))
        .mockImplementationOnce(() => Promise.reject(new ChatworkRateLimitError(3)))
      const sleepFn = makeNoopSleepFn()

      const result = await sendTranslatedMessage(makeCommand(), makeResult(), config, sleepFn)

      expect(result.status).toBe('sent')
      expect(mockResolveRoomMemberDisplayName.mock.calls.length).toBe(3)
      expect(sleepFn.mock.calls.length).toBe(2)
      expect(sleepFn.mock.calls[0]?.[0]).toBe(3000)
      expect(sleepFn.mock.calls[1]?.[0]).toBe(3000)
    })

    it('exhausts all retries on repeated network TypeError and returns failed', async () => {
      mockResolveRoomMemberDisplayName.mockImplementation(() => {
        throw new TypeError('Unable to connect. Is the computer able to access the url?')
      })
      const sleepFn = makeNoopSleepFn()

      const result = await sendTranslatedMessage(makeCommand(), makeResult(), config, sleepFn)

      expect(result.status).toBe('failed')
      expect(result.errorCode).toBe('TypeError')
      expect(mockResolveRoomMemberDisplayName.mock.calls.length).toBe(3)
      expect(sleepFn.mock.calls.length).toBe(2)

      // Reset to default for subsequent tests
      mockResolveRoomMemberDisplayName.mockImplementation((_roomId, _accountId, _token, _cache) =>
        Promise.resolve('Nguyen Van A'),
      )
    })

    it('does NOT retry on TypeError with non-network message', async () => {
      mockResolveRoomMemberDisplayName.mockImplementationOnce(() => {
        throw new TypeError('Cannot read properties of null (reading "length")')
      })
      const sleepFn = makeNoopSleepFn()

      const result = await sendTranslatedMessage(makeCommand(), makeResult(), config, sleepFn)

      expect(result.status).toBe('failed')
      expect(result.errorCode).toBe('TypeError')
      expect(mockResolveRoomMemberDisplayName.mock.calls.length).toBe(1)
      expect(sleepFn.mock.calls.length).toBe(0)
    })

    it('does NOT retry on ChatworkApiError with non-429 status', async () => {
      mockSendRoomMessage.mockImplementationOnce(() =>
        Promise.reject(new ChatworkApiError('Unauthorized', 401, 'Unauthorized')),
      )
      const sleepFn = makeNoopSleepFn()

      const result = await sendTranslatedMessage(makeCommand(), makeResult(), config, sleepFn)

      expect(result.status).toBe('failed')
      expect(result.errorCode).toBe('ChatworkApiError')
      expect(mockSendRoomMessage.mock.calls.length).toBe(1)
      expect(sleepFn.mock.calls.length).toBe(0)
    })

    it('uses raw Retry-After delay when under 10 000 ms cap (retryAfter=3 → 3000 ms)', async () => {
      mockSendRoomMessage.mockImplementationOnce(() =>
        Promise.reject(new ChatworkRateLimitError(3)),
      )
      const sleepFn = makeNoopSleepFn()

      await sendTranslatedMessage(makeCommand(), makeResult(), config, sleepFn)

      expect(sleepFn.mock.calls[0]?.[0]).toBe(3000)
    })

    it('caps Retry-After delay at 10 000 ms when retryAfter exceeds cap (retryAfter=15 → 10 000 ms)', async () => {
      mockSendRoomMessage.mockImplementationOnce(() =>
        Promise.reject(new ChatworkRateLimitError(15)),
      )
      const sleepFn = makeNoopSleepFn()

      await sendTranslatedMessage(makeCommand(), makeResult(), config, sleepFn)

      expect(sleepFn.mock.calls[0]?.[0]).toBe(10_000)
    })
  })
})
