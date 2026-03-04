import { Type as t, type Static } from '@sinclair/typebox'

// ─── Webhook Event Schemas ────────────────────────────────────────────────────

/**
 * The inner webhook_event object from Chatwork.
 * Uses additionalProperties: true because different event types include different fields.
 */
export const ChatworkWebhookEventInnerSchema = t.Object(
  {
    message_id: t.Optional(t.String()),
    room_id: t.Optional(t.Number()),
    account_id: t.Optional(t.Number()),
    body: t.Optional(t.String()),
    send_time: t.Optional(t.Number()),
    update_time: t.Optional(t.Number()),
    from_account_id: t.Optional(t.Number()),
    to_account_id: t.Optional(t.Number()),
  },
  { additionalProperties: true },
)

export const ChatworkWebhookEventSchema = t.Object({
  webhook_setting_id: t.String(),
  webhook_event_type: t.String(),
  webhook_event_time: t.Number(),
  webhook_event: ChatworkWebhookEventInnerSchema,
})

export type ChatworkWebhookEvent = Static<typeof ChatworkWebhookEventSchema>

// ─── Specific Event: message_created ─────────────────────────────────────────

export const ChatworkMessageEventInnerSchema = t.Object({
  message_id: t.String(),
  room_id: t.Number(),
  account_id: t.Number(),
  body: t.String(),
  send_time: t.Number(),
  update_time: t.Number(),
})

export const ChatworkMessageEventSchema = t.Object({
  webhook_setting_id: t.String(),
  webhook_event_type: t.Literal('message_created'),
  webhook_event_time: t.Number(),
  webhook_event: ChatworkMessageEventInnerSchema,
})

export type ChatworkMessageEvent = Static<typeof ChatworkMessageEventSchema>

// ─── Type Guard ───────────────────────────────────────────────────────────────

export function isChatworkMessageEvent(event: ChatworkWebhookEvent): event is ChatworkMessageEvent {
  return (
    event.webhook_event_type === 'message_created' &&
    typeof event.webhook_event.room_id === 'number' &&
    typeof event.webhook_event.account_id === 'number' &&
    typeof event.webhook_event.body === 'string'
  )
}

// ─── Other API Types (kept as TypeScript interfaces — no runtime validation needed) ──

export interface ChatworkAccount {
  account_id: number
  name: string
  avatar_image_url: string
}

export interface ChatworkRoom {
  room_id: number
}

export interface ChatworkRoomDetail {
  room_id: number
  name: string
  type: string
  icon_path: string
  member_count?: number
}

export interface ChatworkSendMessageResponse {
  message_id: string
}
