import { describe, expect, it } from 'bun:test'
import type { ChatworkWebhookPayload } from '~/types/webhook'
import { mapWebhookToTranslationCommand } from './map-webhook-to-translation-command'

// ─── Fixture ──────────────────────────────────────────────────────────────────

function makePayload(
  overrides?: Partial<ChatworkWebhookPayload['webhook_event']>,
): ChatworkWebhookPayload {
  return {
    webhook_setting_id: '123',
    webhook_event_type: 'message_created',
    webhook_event_time: 1710000000,
    webhook_event: {
      message_id: '789012345',
      room_id: 567890123,
      account_id: 12345,
      body: '[To:99] [rp aid=12345 to=567890123:789012340] Hello world',
      send_time: 1710000000,
      update_time: 0,
      ...overrides,
    },
  }
}

const RECEIVED_AT = '2026-03-12T00:00:00.000Z'

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('mapWebhookToTranslationCommand', () => {
  it('maps payload to TranslationIngressCommand with correct sourceSystem', () => {
    const result = mapWebhookToTranslationCommand(makePayload(), RECEIVED_AT)
    expect(result.sourceSystem).toBe('chatwork')
  })

  it('maps sourceMessageId from webhook_event.message_id', () => {
    const result = mapWebhookToTranslationCommand(makePayload(), RECEIVED_AT)
    expect(result.sourceMessageId).toBe('789012345')
  })

  it('maps sourceRoomId from webhook_event.room_id', () => {
    const result = mapWebhookToTranslationCommand(makePayload(), RECEIVED_AT)
    expect(result.sourceRoomId).toBe(567890123)
  })

  it('maps senderAccountId from webhook_event.account_id', () => {
    const result = mapWebhookToTranslationCommand(makePayload(), RECEIVED_AT)
    expect(result.senderAccountId).toBe(12345)
  })

  it('maps rawBody to the original unstripped body', () => {
    const result = mapWebhookToTranslationCommand(makePayload(), RECEIVED_AT)
    expect(result.rawBody).toBe('[To:99] [rp aid=12345 to=567890123:789012340] Hello world')
  })

  it('strips [To:xxx] markup from translatableText', () => {
    const payload = makePayload({ body: '[To:99] Hello world' })
    const result = mapWebhookToTranslationCommand(payload, RECEIVED_AT)
    expect(result.translatableText).not.toContain('[To:99]')
    expect(result.translatableText.trim()).toBe('Hello world')
  })

  it('strips [rp aid=xxx to=xxx:xxx] markup from translatableText', () => {
    const payload = makePayload({ body: '[rp aid=12345 to=567890123:789012340] Good morning' })
    const result = mapWebhookToTranslationCommand(payload, RECEIVED_AT)
    expect(result.translatableText).not.toContain('[rp')
    expect(result.translatableText.trim()).toBe('Good morning')
  })

  it('strips combined [To:] and [rp] markup from translatableText', () => {
    const payload = makePayload({
      body: '[To:99] [rp aid=12345 to=567890123:789012340] Hello world',
    })
    const result = mapWebhookToTranslationCommand(payload, RECEIVED_AT)
    expect(result.translatableText).toBe('Hello world')
  })

  it('strips [quote]...[/quote] blocks from translatableText', () => {
    const payload = makePayload({ body: '[quote]old message[/quote]\nNew reply' })
    const result = mapWebhookToTranslationCommand(payload, RECEIVED_AT)
    expect(result.translatableText).not.toContain('[quote]')
    expect(result.translatableText).toContain('New reply')
  })

  it('strips [qt]...[/qt] blocks from translatableText', () => {
    const payload = makePayload({ body: '[qt]quoted text[/qt]\nNew reply' })
    const result = mapWebhookToTranslationCommand(payload, RECEIVED_AT)
    expect(result.translatableText).not.toContain('[qt]')
    expect(result.translatableText).toContain('New reply')
  })

  it('maps sendTime from webhook_event.send_time', () => {
    const result = mapWebhookToTranslationCommand(makePayload(), RECEIVED_AT)
    expect(result.sendTime).toBe(1710000000)
  })

  it('maps updateTime from webhook_event.update_time', () => {
    const result = mapWebhookToTranslationCommand(makePayload(), RECEIVED_AT)
    expect(result.updateTime).toBe(0)
  })

  it('sets audit.receivedAt to the provided receivedAt string', () => {
    const result = mapWebhookToTranslationCommand(makePayload(), RECEIVED_AT)
    expect(result.audit.receivedAt).toBe(RECEIVED_AT)
  })

  it('sets audit.rawSourceSnapshot to the full payload cast as a record', () => {
    const payload = makePayload()
    const result = mapWebhookToTranslationCommand(payload, RECEIVED_AT)
    expect(result.audit.rawSourceSnapshot).toBe(payload)
    expect((result.audit.rawSourceSnapshot as typeof payload).webhook_setting_id).toBe('123')
  })

  it('body without any markup has identical rawBody and translatableText', () => {
    const payload = makePayload({ body: 'Plain message without markup' })
    const result = mapWebhookToTranslationCommand(payload, RECEIVED_AT)
    expect(result.rawBody).toBe('Plain message without markup')
    expect(result.translatableText).toBe('Plain message without markup')
  })
})
