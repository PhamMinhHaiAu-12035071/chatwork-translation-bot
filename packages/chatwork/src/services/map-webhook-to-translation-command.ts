import type { TranslationIngressCommand } from '@chatwork-bot/core'
import type { ChatworkWebhookPayload } from '~/types/webhook'
import { buildMessageTranslationSource } from './build-message-translation-source'

/**
 * Maps a normalized Chatwork webhook payload to the neutral `TranslationIngressCommand` DTO.
 *
 * - Parses Chatwork markup to extract translation inputs and preserve structure
 * - Preserves the original `body` as `rawBody`
 * - Sets `audit.rawSourceSnapshot` to an envelope with both raw payload and decoration snapshot
 */
export function mapWebhookToTranslationCommand(
  payload: ChatworkWebhookPayload,
  receivedAt: string,
): TranslationIngressCommand {
  const event = payload.webhook_event
  const eventType = payload.webhook_event_type as string
  const eventTime = String(payload.webhook_event_time)

  const sourceEventId = `${event.message_id}:${eventType}:${eventTime}`

  // Parse message structure into translation inputs and render template
  const source = buildMessageTranslationSource(payload)

  return {
    sourceSystem: 'chatwork',
    sourceEventId,
    sourceEventType: eventType,
    sourceMessageId: event.message_id,
    sourceRoomId: event.room_id,
    senderAccountId: event.account_id,
    rawBody: event.body,
    translatableText: source.translatableText,
    translationInputs: source.translationInputs,
    sendTime: event.send_time,
    updateTime: event.update_time,
    audit: {
      receivedAt,
      rawSourceSnapshot: source.decorationSnapshot as unknown as Record<string, unknown>,
    },
  }
}
