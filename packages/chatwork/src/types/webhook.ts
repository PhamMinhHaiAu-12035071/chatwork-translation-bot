import { Type as t, type Static } from '@sinclair/typebox'

// ─── Webhook Message Event Inner Schema ───────────────────────────────────────

export const ChatworkWebhookPayloadEventSchema = t.Object({
  message_id: t.String(),
  room_id: t.Number(),
  account_id: t.Number(),
  body: t.String(),
  send_time: t.Number(),
  update_time: t.Number(),
})

// ─── Webhook Payload Schema ───────────────────────────────────────────────────

export const ChatworkWebhookPayloadSchema = t.Object({
  webhook_setting_id: t.String(),
  webhook_event_type: t.Union([t.Literal('message_created'), t.Literal('message_updated')]),
  webhook_event_time: t.Number(),
  webhook_event: ChatworkWebhookPayloadEventSchema,
})

export type ChatworkWebhookPayload = Static<typeof ChatworkWebhookPayloadSchema>
