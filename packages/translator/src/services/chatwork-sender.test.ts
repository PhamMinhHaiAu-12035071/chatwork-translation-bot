import { beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import type { ChatworkMessageEvent, TranslationResult } from '@chatwork-bot/core'

import { buildTranslatedMessage } from './chatwork-sender'

const makeEvent = (
  overrides: Partial<ChatworkMessageEvent['webhook_event']> = {},
): ChatworkMessageEvent => ({
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
    ...overrides,
  },
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
    const msg = buildTranslatedMessage(makeEvent(), makeResult(), 'Nguyen Van A')

    expect(msg).toContain('[info][title]')
    expect(msg).toContain('[/title]')
    expect(msg).toContain('[/info]')
    expect(msg).toContain('Nguyen Van A')
    expect(msg).toContain('2026-03-0') // timestamp from send_time present (date portion, UTC-safe)
    expect(msg).not.toContain('Room#')
    expect(msg).not.toContain('MsgID:')
  })

  it('includes translated text in the body', () => {
    const msg = buildTranslatedMessage(makeEvent(), makeResult(), 'Nguyen Van A')

    expect(msg).toContain('Chào buổi sáng!')
  })

  it('extracts and includes [To:xxx] tags from original body', () => {
    const event = makeEvent({ body: '[To:1484814]おはようございます' })
    const msg = buildTranslatedMessage(event, makeResult(), 'Nguyen Van A')

    expect(msg).toContain('[To:1484814]')
    expect(msg).toContain('Chào buổi sáng!')
  })

  it('extracts and includes [cc:xxx] tags from original body', () => {
    const event = makeEvent({ body: '[cc:9999]本日の会議' })
    const msg = buildTranslatedMessage(event, makeResult(), 'Nguyen Van A')

    expect(msg).toContain('[cc:9999]')
  })

  it('extracts multiple markup tags', () => {
    const event = makeEvent({ body: '[To:111][To:222][cc:333]テキスト' })
    const msg = buildTranslatedMessage(event, makeResult(), 'Nguyen Van A')

    expect(msg).toContain('[To:111]')
    expect(msg).toContain('[To:222]')
    expect(msg).toContain('[cc:333]')
  })

  it('works without any [To:]/[cc:] tags', () => {
    const event = makeEvent({ body: 'プレーンテキスト' })
    const msg = buildTranslatedMessage(event, makeResult(), 'Nguyen Van A')

    expect(msg).toContain('Chào buổi sáng!')
    expect(msg).not.toContain('[To:')
  })

  it('uses fallback #account_id when sender name is already formatted that way', () => {
    const msg = buildTranslatedMessage(makeEvent(), makeResult(), '#34567')

    expect(msg).toContain('#34567')
  })
})

describe('sendTranslatedMessage', () => {
  const mockGetMembers = mock((_roomId: number) =>
    Promise.resolve([
      {
        account_id: 34567,
        name: 'Nguyen Van A',
        role: 'member',
        chatwork_id: '',
        organization_id: 0,
        organization_name: '',
        department: '',
        avatar_image_url: '',
      },
    ]),
  )
  const mockSendMessage = mock((_params: { roomId: number; message: string }) =>
    Promise.resolve({ message_id: 'sent-456' }),
  )

  let sendTranslatedMessage: (
    event: ChatworkMessageEvent,
    result: TranslationResult,
    config: { apiToken: string; destinationRoomId: number },
  ) => Promise<void>

  beforeAll(async () => {
    const realCore = await import('@chatwork-bot/core')

    void mock.module('@chatwork-bot/core', () => ({
      ...realCore,
      ChatworkClient: class {
        getMembers = mockGetMembers
        sendMessage = mockSendMessage
      },
    }))

    const mod = await import('./chatwork-sender')
    sendTranslatedMessage = mod.sendTranslatedMessage
  })

  beforeEach(() => {
    mockGetMembers.mockClear()
    mockSendMessage.mockClear()
  })

  it('calls getMembers with source room_id and sendMessage with destination roomId', async () => {
    await sendTranslatedMessage(makeEvent(), makeResult(), {
      apiToken: 'test-token',
      destinationRoomId: 55555,
    })

    expect(mockGetMembers.mock.calls.length).toBe(1)
    expect(mockGetMembers.mock.calls[0]?.[0]).toBe(98765)

    expect(mockSendMessage.mock.calls.length).toBe(1)
    expect(mockSendMessage.mock.calls[0]?.[0]).toMatchObject({ roomId: 55555 })
  })

  it('uses sender name from members lookup', async () => {
    await sendTranslatedMessage(makeEvent(), makeResult(), {
      apiToken: 'test-token',
      destinationRoomId: 55555,
    })

    const sentMessage = mockSendMessage.mock.calls[0]?.[0]?.message ?? ''
    expect(sentMessage).toContain('Nguyen Van A')
  })

  it('falls back to #account_id when member not found in room', async () => {
    mockGetMembers.mockImplementationOnce(() => Promise.resolve([]))

    await sendTranslatedMessage(makeEvent(), makeResult(), {
      apiToken: 'test-token',
      destinationRoomId: 55555,
    })

    const sentMessage = mockSendMessage.mock.calls[0]?.[0]?.message ?? ''
    expect(sentMessage).toContain('#34567')
  })

  it('does not throw when getMembers fails — swallows error', async () => {
    mockGetMembers.mockImplementationOnce(() => Promise.reject(new Error('network error')))

    await sendTranslatedMessage(makeEvent(), makeResult(), {
      apiToken: 'test-token',
      destinationRoomId: 55555,
    })
    // resolves without throwing
    expect(true).toBe(true)
  })

  it('does not throw when sendMessage fails — swallows error', async () => {
    mockSendMessage.mockImplementationOnce(() => Promise.reject(new Error('API error')))

    await sendTranslatedMessage(makeEvent(), makeResult(), {
      apiToken: 'test-token',
      destinationRoomId: 55555,
    })
    // resolves without throwing
    expect(true).toBe(true)
  })
})
