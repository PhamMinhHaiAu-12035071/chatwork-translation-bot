import { describe, expect, it } from 'bun:test'
import { ChatworkWebhookPayloadError } from '~/errors/chatwork-webhook-payload-error'
import { normalizeWebhookPayload } from './normalize-webhook-payload'

// ─── Fixture ──────────────────────────────────────────────────────────────────

const VALID_RAW_BODY = JSON.stringify({
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
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('normalizeWebhookPayload', () => {
  it('normalizes a valid message_created payload successfully', () => {
    const result = normalizeWebhookPayload(VALID_RAW_BODY)
    expect(result.webhook_setting_id).toBe('123')
    expect(result.webhook_event_type).toBe('message_created')
    expect(result.webhook_event_time).toBe(1710000000)
    expect(result.webhook_event.message_id).toBe('789012345')
    expect(result.webhook_event.room_id).toBe(567890123)
    expect(result.webhook_event.account_id).toBe(12345)
    expect(result.webhook_event.body).toBe('[To:99] Hello')
    expect(result.webhook_event.send_time).toBe(1710000000)
    expect(result.webhook_event.update_time).toBe(0)
  })

  it('throws ChatworkWebhookPayloadError for malformed JSON', () => {
    expect(() => normalizeWebhookPayload('{not valid json')).toThrow(ChatworkWebhookPayloadError)
    expect(() => normalizeWebhookPayload('{not valid json')).toThrow(/Malformed JSON/)
  })

  it('throws ChatworkWebhookPayloadError for non-object JSON', () => {
    expect(() => normalizeWebhookPayload('"just a string"')).toThrow(ChatworkWebhookPayloadError)
    expect(() => normalizeWebhookPayload('[1, 2, 3]')).toThrow(ChatworkWebhookPayloadError)
    expect(() => normalizeWebhookPayload('null')).toThrow(ChatworkWebhookPayloadError)
  })

  it('throws ChatworkWebhookPayloadError when webhook_setting_id is missing', () => {
    const body = JSON.stringify({
      webhook_event_type: 'message_created',
      webhook_event_time: 1710000000,
      webhook_event: {
        message_id: '789012345',
        room_id: 567890123,
        account_id: 12345,
        body: 'Hello',
        send_time: 1710000000,
        update_time: 0,
      },
    })
    expect(() => normalizeWebhookPayload(body)).toThrow(ChatworkWebhookPayloadError)
    expect(() => normalizeWebhookPayload(body)).toThrow(/webhook_setting_id/)
  })

  it('throws ChatworkWebhookPayloadError when webhook_event_type is not message_created', () => {
    const body = JSON.stringify({
      webhook_setting_id: '123',
      webhook_event_type: 'member_joined',
      webhook_event_time: 1710000000,
      webhook_event: {
        message_id: '789012345',
        room_id: 567890123,
        account_id: 12345,
        body: 'Hello',
        send_time: 1710000000,
        update_time: 0,
      },
    })
    expect(() => normalizeWebhookPayload(body)).toThrow(ChatworkWebhookPayloadError)
    expect(() => normalizeWebhookPayload(body)).toThrow(/Unsupported webhook_event_type/)
  })

  it('throws ChatworkWebhookPayloadError when webhook_event is missing', () => {
    const body = JSON.stringify({
      webhook_setting_id: '123',
      webhook_event_type: 'message_created',
      webhook_event_time: 1710000000,
    })
    expect(() => normalizeWebhookPayload(body)).toThrow(ChatworkWebhookPayloadError)
  })

  it('throws ChatworkWebhookPayloadError when webhook_event.body is missing', () => {
    const body = JSON.stringify({
      webhook_setting_id: '123',
      webhook_event_type: 'message_created',
      webhook_event_time: 1710000000,
      webhook_event: {
        message_id: '789012345',
        room_id: 567890123,
        account_id: 12345,
        // body missing
        send_time: 1710000000,
        update_time: 0,
      },
    })
    expect(() => normalizeWebhookPayload(body)).toThrow(ChatworkWebhookPayloadError)
    expect(() => normalizeWebhookPayload(body)).toThrow(/body/)
  })

  it('throws ChatworkWebhookPayloadError when required event fields are missing', () => {
    const body = JSON.stringify({
      webhook_setting_id: '123',
      webhook_event_type: 'message_created',
      webhook_event_time: 1710000000,
      webhook_event: {
        // missing message_id, room_id, account_id, body, send_time, update_time
      },
    })
    expect(() => normalizeWebhookPayload(body)).toThrow(ChatworkWebhookPayloadError)
  })

  it('coerces numeric webhook_event_time from string', () => {
    const body = JSON.stringify({
      webhook_setting_id: '123',
      webhook_event_type: 'message_created',
      webhook_event_time: '1710000000', // string number
      webhook_event: {
        message_id: '789012345',
        room_id: 567890123,
        account_id: 12345,
        body: 'Hello',
        send_time: 1710000000,
        update_time: 0,
      },
    })
    const result = normalizeWebhookPayload(body)
    expect(result.webhook_event_time).toBe(1710000000)
  })

  it('coerces numeric room_id from string', () => {
    const body = JSON.stringify({
      webhook_setting_id: '123',
      webhook_event_type: 'message_created',
      webhook_event_time: 1710000000,
      webhook_event: {
        message_id: '789012345',
        room_id: '567890123', // string number
        account_id: 12345,
        body: 'Hello',
        send_time: 1710000000,
        update_time: 0,
      },
    })
    const result = normalizeWebhookPayload(body)
    expect(result.webhook_event.room_id).toBe(567890123)
  })

  it('coerces numeric message_id from number to string', () => {
    const body = JSON.stringify({
      webhook_setting_id: '123',
      webhook_event_type: 'message_created',
      webhook_event_time: 1710000000,
      webhook_event: {
        message_id: 789012345, // number instead of string
        room_id: 567890123,
        account_id: 12345,
        body: 'Hello',
        send_time: 1710000000,
        update_time: 0,
      },
    })
    const result = normalizeWebhookPayload(body)
    expect(result.webhook_event.message_id).toBe('789012345')
  })

  it('normalizes a valid message_updated payload successfully', () => {
    const body = JSON.stringify({
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
    })
    const result = normalizeWebhookPayload(body)
    expect(result.webhook_event_type).toBe('message_updated')
    expect(result.webhook_event.update_time).toBe(1710000060)
  })

  it('throws error for message_created in error message says it must be created or updated', () => {
    const body = JSON.stringify({
      webhook_setting_id: '123',
      webhook_event_type: 'member_joined',
      webhook_event_time: 1710000000,
      webhook_event: {
        message_id: '789012345',
        room_id: 567890123,
        account_id: 12345,
        body: 'Hello',
        send_time: 1710000000,
        update_time: 0,
      },
    })
    expect(() => normalizeWebhookPayload(body)).toThrow(/message_created|message_updated/)
  })
})
