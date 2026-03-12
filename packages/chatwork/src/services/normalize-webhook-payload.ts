import { Value } from '@sinclair/typebox/value'
import { ChatworkWebhookPayloadError } from '~/errors/chatwork-webhook-payload-error'
import { ChatworkWebhookPayloadSchema } from '~/types/webhook'
import type { ChatworkWebhookPayload } from '~/types/webhook'

function toSafeString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString()
  }
  return undefined
}

function toSafeNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.trim()
    if (normalized.length === 0) return undefined
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

/**
 * Parses and normalizes the raw JSON body of a Chatwork webhook request.
 * Throws `ChatworkWebhookPayloadError` if the body is malformed or missing required fields.
 */
export function normalizeWebhookPayload(rawBody: string): ChatworkWebhookPayload {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    throw new ChatworkWebhookPayloadError('Malformed JSON in webhook payload')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ChatworkWebhookPayloadError('Webhook payload is not a JSON object')
  }

  const raw = parsed as Record<string, unknown>
  const issues: string[] = []

  const webhookSettingId = toSafeString(raw['webhook_setting_id'])
  const webhookEventType = toSafeString(raw['webhook_event_type'])
  const webhookEventTime = toSafeNumber(raw['webhook_event_time'])

  if (webhookSettingId === undefined) issues.push('webhook_setting_id is required')
  if (webhookEventType === undefined) {
    issues.push('webhook_event_type is required')
  } else if (webhookEventType !== 'message_created') {
    throw new ChatworkWebhookPayloadError(
      `Unsupported webhook_event_type: "${webhookEventType}"; expected "message_created"`,
    )
  }
  if (webhookEventTime === undefined) issues.push('webhook_event_time is required')

  const rawEvent = raw['webhook_event']
  if (!rawEvent || typeof rawEvent !== 'object' || Array.isArray(rawEvent)) {
    issues.push('webhook_event is missing or not an object')
    throw new ChatworkWebhookPayloadError(issues.join('; '))
  }

  const event = rawEvent as Record<string, unknown>

  const messageId = toSafeString(event['message_id'])
  const roomId = toSafeNumber(event['room_id'])
  const accountId = toSafeNumber(event['account_id'])
  const sendTime = toSafeNumber(event['send_time'])
  const updateTime = toSafeNumber(event['update_time'])

  if (messageId === undefined) issues.push('webhook_event.message_id is required')
  if (roomId === undefined) issues.push('webhook_event.room_id is required')
  if (accountId === undefined) issues.push('webhook_event.account_id is required')
  if (typeof event['body'] !== 'string') {
    issues.push('webhook_event.body is required and must be a string')
  }
  if (sendTime === undefined) issues.push('webhook_event.send_time is required')
  if (updateTime === undefined) issues.push('webhook_event.update_time is required')

  if (issues.length > 0) {
    throw new ChatworkWebhookPayloadError(issues.join('; '))
  }

  // All validations passed — TypeScript cannot narrow these automatically, but we
  // guard them with runtime checks above and avoid non-null assertions by using
  // the ?? operator with explicit fallback throws.
  const resolvedSettingId =
    webhookSettingId ??
    (() => {
      throw new ChatworkWebhookPayloadError('webhook_setting_id is required')
    })()
  const resolvedEventTime =
    webhookEventTime ??
    (() => {
      throw new ChatworkWebhookPayloadError('webhook_event_time is required')
    })()
  const resolvedMessageId =
    messageId ??
    (() => {
      throw new ChatworkWebhookPayloadError('webhook_event.message_id is required')
    })()
  const resolvedRoomId =
    roomId ??
    (() => {
      throw new ChatworkWebhookPayloadError('webhook_event.room_id is required')
    })()
  const resolvedAccountId =
    accountId ??
    (() => {
      throw new ChatworkWebhookPayloadError('webhook_event.account_id is required')
    })()
  const resolvedSendTime =
    sendTime ??
    (() => {
      throw new ChatworkWebhookPayloadError('webhook_event.send_time is required')
    })()
  const resolvedUpdateTime =
    updateTime ??
    (() => {
      throw new ChatworkWebhookPayloadError('webhook_event.update_time is required')
    })()

  const candidate: ChatworkWebhookPayload = {
    webhook_setting_id: resolvedSettingId,
    webhook_event_type: 'message_created',
    webhook_event_time: resolvedEventTime,
    webhook_event: {
      message_id: resolvedMessageId,
      room_id: resolvedRoomId,
      account_id: resolvedAccountId,
      body: event['body'] as string,
      send_time: resolvedSendTime,
      update_time: resolvedUpdateTime,
    },
  }

  if (!Value.Check(ChatworkWebhookPayloadSchema, candidate)) {
    const errors = [...Value.Errors(ChatworkWebhookPayloadSchema, candidate)].map(
      (e) => `${e.path} ${e.message}`,
    )
    throw new ChatworkWebhookPayloadError(errors.join('; '))
  }

  return candidate
}
