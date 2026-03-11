import type { TranslationIngressCommand } from '@chatwork-bot/core'
import { stripChatworkMarkup } from '@chatwork-bot/core'
import type { ChatworkWebhookPayload } from '~/types/webhook'

/**
 * Maps a normalized Chatwork webhook payload to the neutral `TranslationIngressCommand` DTO.
 *
 * - Strips Chatwork markup from the message body to produce `translatableText`
 * - Preserves the original `body` as `rawBody`
 * - Sets `audit.rawSourceSnapshot` to the full payload as a record
 */
export function mapWebhookToTranslationCommand(
  payload: ChatworkWebhookPayload,
  receivedAt: string,
): TranslationIngressCommand {
  const event = payload.webhook_event

  return {
    sourceSystem: 'chatwork',
    sourceMessageId: event.message_id,
    sourceRoomId: event.room_id,
    senderAccountId: event.account_id,
    rawBody: event.body,
    translatableText: stripChatworkMarkup(event.body),
    sendTime: event.send_time,
    updateTime: event.update_time,
    audit: {
      receivedAt,
      rawSourceSnapshot: payload as unknown as Record<string, unknown>,
    },
  }
}
