import { Elysia } from 'elysia'
import { Value } from '@sinclair/typebox/value'
import type { ChatworkWebhookEvent } from '@chatwork-bot/core'
import { ChatworkWebhookEventSchema } from '@chatwork-bot/core'
import { env } from '~/env'

type NormalizationResult =
  | { ok: true; event: ChatworkWebhookEvent }
  | { ok: false; event: string[] }

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
    if (normalized.length === 0) {
      return undefined
    }

    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

function normalizeWebhookPayload(payload: unknown): NormalizationResult {
  const issues: string[] = []
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    issues.push('payload is not an object')
    return { ok: false, event: issues }
  }

  const raw = payload as Record<string, unknown>
  const webhookEvent = raw['webhook_event']
  if (!webhookEvent || typeof webhookEvent !== 'object' || Array.isArray(webhookEvent)) {
    issues.push('webhook_event is missing or invalid')
  }
  const rawEvent = (webhookEvent ?? {}) as Record<string, unknown>

  const webhookSettingId = toSafeString(raw['webhook_setting_id'])
  const webhookEventType = toSafeString(raw['webhook_event_type'])
  const webhookEventTime = toSafeNumber(raw['webhook_event_time'])

  if (webhookSettingId === undefined) {
    issues.push('webhook_setting_id is required')
  }
  if (webhookEventType === undefined) {
    issues.push('webhook_event_type is required')
  }
  if (webhookEventTime === undefined) {
    issues.push('webhook_event_time is required')
  }

  const messageId = toSafeString(rawEvent['message_id'])
  const roomIdVal = toSafeNumber(rawEvent['room_id'])
  const accountId = toSafeNumber(rawEvent['account_id'])
  const sendTime = toSafeNumber(rawEvent['send_time'])
  const updateTime = toSafeNumber(rawEvent['update_time'])
  const fromAccountId = toSafeNumber(rawEvent['from_account_id'])
  const toAccountId = toSafeNumber(rawEvent['to_account_id'])

  const eventFields: ChatworkWebhookEvent['webhook_event'] = {
    ...(messageId !== undefined ? { message_id: messageId } : {}),
    ...(roomIdVal !== undefined ? { room_id: roomIdVal } : {}),
    ...(accountId !== undefined ? { account_id: accountId } : {}),
    ...(typeof rawEvent['body'] === 'string' ? { body: rawEvent['body'] } : {}),
    ...(sendTime !== undefined ? { send_time: sendTime } : {}),
    ...(updateTime !== undefined ? { update_time: updateTime } : {}),
    ...(fromAccountId !== undefined ? { from_account_id: fromAccountId } : {}),
    ...(toAccountId !== undefined ? { to_account_id: toAccountId } : {}),
  }

  const candidate: ChatworkWebhookEvent = {
    webhook_setting_id: webhookSettingId ?? '',
    webhook_event_type: webhookEventType ?? '',
    webhook_event_time: webhookEventTime ?? 0,
    webhook_event: eventFields,
  }

  const valid = issues.length === 0 && Value.Check(ChatworkWebhookEventSchema, candidate)
  if (!valid) {
    for (const issue of Value.Errors(ChatworkWebhookEventSchema, candidate)) {
      issues.push(`${issue.path.split('/').join('.')} ${issue.message}`)
    }
    return { ok: false, event: issues }
  }

  return { ok: true, event: candidate }
}

async function handleWebhook(body: unknown): Promise<Response> {
  const normalized = normalizeWebhookPayload(body)
  if (!normalized.ok) {
    console.error(
      JSON.stringify({
        level: 'error',
        service: 'webhook-logger',
        event: 'webhook_payload_invalid',
        timestamp: new Date().toISOString(),
        errorCode: 'WEBHOOK_PAYLOAD_INVALID',
        errorMessage: normalized.event.join('; '),
      }),
    )
    return new Response('Invalid webhook payload', { status: 422 })
  }

  const event = normalized.event
  const sourceMessageId = event.webhook_event.message_id
  const roomId = event.webhook_event.room_id

  console.log(
    JSON.stringify({
      level: 'info',
      service: 'webhook-logger',
      event: 'webhook_received',
      timestamp: new Date().toISOString(),
      ...(sourceMessageId !== undefined ? { sourceMessageId } : {}),
      ...(roomId !== undefined ? { roomId } : {}),
    }),
  )

  console.log(
    JSON.stringify({
      level: 'info',
      service: 'webhook-logger',
      event: 'translation_forward_started',
      timestamp: new Date().toISOString(),
      ...(sourceMessageId !== undefined ? { sourceMessageId } : {}),
      ...(roomId !== undefined ? { roomId } : {}),
    }),
  )

  let response: Response
  try {
    response = await fetch(`${env.TRANSLATOR_URL}/internal/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event }),
    })
  } catch (err: unknown) {
    console.error(
      JSON.stringify({
        level: 'error',
        service: 'webhook-logger',
        event: 'translation_forward_failed',
        timestamp: new Date().toISOString(),
        ...(sourceMessageId !== undefined ? { sourceMessageId } : {}),
        ...(roomId !== undefined ? { roomId } : {}),
        errorCode: err instanceof Error ? err.name : 'UnknownError',
        errorMessage: err instanceof Error ? err.message : String(err),
      }),
    )
    return new Response('Translator unavailable', { status: 503 })
  }

  if (!response.ok) {
    console.error(
      JSON.stringify({
        level: 'error',
        service: 'webhook-logger',
        event: 'translation_forward_failed',
        timestamp: new Date().toISOString(),
        ...(sourceMessageId !== undefined ? { sourceMessageId } : {}),
        ...(roomId !== undefined ? { roomId } : {}),
        errorCode: 'TRANSLATOR_HTTP',
        errorMessage: `Translator responded with ${String(response.status)}`,
        translatorStatus: response.status,
      }),
    )
    return new Response(`Translator error: ${String(response.status)}`, { status: 502 })
  }

  console.log(
    JSON.stringify({
      level: 'info',
      service: 'webhook-logger',
      event: 'translation_forward_completed',
      timestamp: new Date().toISOString(),
      ...(sourceMessageId !== undefined ? { sourceMessageId } : {}),
      ...(roomId !== undefined ? { roomId } : {}),
      translatorStatus: response.status,
    }),
  )

  return new Response('OK', { status: 200 })
}

export const webhookRoutes = new Elysia({ name: 'webhook-logger:webhook' })
  .post('/webhook', ({ body }) => handleWebhook(body))
  .post('/', ({ body }) => handleWebhook(body))
