import type { TranslationIngressCommand } from '@chatwork-bot/core'
import type { ChatworkWebhookPayload } from '~/types/webhook'

/**
 * Strips Chatwork-specific markup tags from a message body.
 * This is a Chatwork-specific concern and intentionally lives in this package.
 */
function stripChatworkMarkup(text: string): string {
  return text
    .replace(/\[To:\d+\]/g, '')
    .replace(/\[rp aid=\d+ to=\d+:\d+\]/g, '')
    .replace(/\[quote\][\s\S]*?\[\/quote\]/g, '')
    .replace(/\[qt\][\s\S]*?\[\/qt\]/g, '')
    .replace(/\[info\][\s\S]*?\[\/info\]/g, '')
    .replace(/\[title\][\s\S]*?\[\/title\]/g, '')
    .replace(/\[code\][\s\S]*?\[\/code\]/g, '')
    .trim()
}

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
