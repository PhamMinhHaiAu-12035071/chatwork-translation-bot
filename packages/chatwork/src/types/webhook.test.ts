import { describe, expect, it } from 'bun:test'
import { Value } from '@sinclair/typebox/value'
import { ChatworkWebhookPayloadSchema } from './webhook'
import type { ChatworkWebhookPayload } from './webhook'

describe('ChatworkWebhookPayload', () => {
  const validPayload: ChatworkWebhookPayload = {
    webhook_setting_id: '123',
    webhook_event_type: 'message_created',
    webhook_event_time: 1710000000,
    webhook_event: {
      message_id: '789012345',
      room_id: 567890123,
      account_id: 12345,
      body: '[To:99] Hello',
      send_time: 1710000000,
      update_time: 0,
    },
  }

  it('validates a valid message_created payload', () => {
    expect(Value.Check(ChatworkWebhookPayloadSchema, validPayload)).toBe(true)
  })

  it('rejects a payload with missing webhook_setting_id', () => {
    const invalid = { ...validPayload, webhook_setting_id: undefined }
    expect(Value.Check(ChatworkWebhookPayloadSchema, invalid)).toBe(false)
  })

  it('rejects a payload with wrong event type', () => {
    const invalid = { ...validPayload, webhook_event_type: 'member_joined' }
    expect(Value.Check(ChatworkWebhookPayloadSchema, invalid)).toBe(false)
  })

  it('rejects a payload with missing webhook_event fields', () => {
    const invalid = {
      ...validPayload,
      webhook_event: {
        // missing message_id, room_id, account_id, body, send_time, update_time
      },
    }
    expect(Value.Check(ChatworkWebhookPayloadSchema, invalid)).toBe(false)
  })

  it('enforces string type for message_id', () => {
    const invalid = {
      ...validPayload,
      webhook_event: {
        ...validPayload.webhook_event,
        message_id: 789012345, // number instead of string
      },
    }
    expect(Value.Check(ChatworkWebhookPayloadSchema, invalid)).toBe(false)
  })

  it('validates a valid message_updated payload', () => {
    const updatedPayload: ChatworkWebhookPayload = {
      webhook_setting_id: '123',
      webhook_event_type: 'message_updated',
      webhook_event_time: 1710000060,
      webhook_event: {
        message_id: '789012345',
        room_id: 567890123,
        account_id: 12345,
        body: '[To:99] Hello Updated',
        send_time: 1710000000,
        update_time: 1710000060,
      },
    }
    expect(Value.Check(ChatworkWebhookPayloadSchema, updatedPayload)).toBe(true)
  })

  it('rejects unsupported event types like mention_to_me', () => {
    const invalid = { ...validPayload, webhook_event_type: 'mention_to_me' }
    expect(Value.Check(ChatworkWebhookPayloadSchema, invalid)).toBe(false)
  })
})
