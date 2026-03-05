import { describe, expect, it } from 'bun:test'
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
  it('includes [info][title] wrapper with room_id, sender name, message_id, and time', () => {
    const msg = buildTranslatedMessage(makeEvent(), makeResult(), 'Nguyen Van A')

    expect(msg).toContain('[info][title]')
    expect(msg).toContain('[/title]')
    expect(msg).toContain('[/info]')
    expect(msg).toContain('Room#98765')
    expect(msg).toContain('Nguyen Van A')
    expect(msg).toContain('MsgID:msg-123')
    expect(msg).toContain('2026-03-0') // timestamp from send_time present (date portion, UTC-safe)
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
