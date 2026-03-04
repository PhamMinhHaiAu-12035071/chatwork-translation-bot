import { describe, expect, it } from 'bun:test'
import { Value } from '@sinclair/typebox/value'
import { ChatworkWebhookEventSchema, type ChatworkWebhookEvent } from './chatwork'

describe('ChatworkWebhookEventSchema', () => {
  const validEvent: ChatworkWebhookEvent = {
    webhook_setting_id: '12345',
    webhook_event_type: 'message_created',
    webhook_event_time: 1498028130,
    webhook_event: {
      message_id: '789012345',
      room_id: 567890123,
      account_id: 123456,
      body: 'Hello World',
      send_time: 1498028125,
      update_time: 0,
    },
  }

  it('validates a correct webhook event', () => {
    expect(Value.Check(ChatworkWebhookEventSchema, validEvent)).toBe(true)
  })

  it('rejects event missing webhook_setting_id', () => {
    const invalid = { ...validEvent, webhook_setting_id: undefined }
    expect(Value.Check(ChatworkWebhookEventSchema, invalid)).toBe(false)
  })

  it('rejects event with wrong type for webhook_event_time', () => {
    const invalid = { ...validEvent, webhook_event_time: 'not-a-number' }
    expect(Value.Check(ChatworkWebhookEventSchema, invalid)).toBe(false)
  })

  it('exports ChatworkWebhookEvent as TypeScript type (compile-time check)', () => {
    // This test exists to verify type exports compile correctly
    const event: ChatworkWebhookEvent = validEvent
    expect(typeof event.webhook_setting_id).toBe('string')
  })
})
