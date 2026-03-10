import { ChatworkClient } from '@chatwork-bot/core'
import type { ChatworkMessageEvent, TranslationResult } from '@chatwork-bot/core'
import type { OutputDelivery } from '~/types/output'

/**
 * Builds the translated message string to send to the destination Chatwork room.
 * Preserves [To:xxx] and [cc:xxx] markup tags from the original body.
 * Wraps content in Chatwork [info][title] block with metadata.
 */
export function buildTranslatedMessage(
  event: ChatworkMessageEvent,
  result: TranslationResult,
  senderName: string,
): string {
  const { body, send_time } = event.webhook_event

  const timeStr = new Date(send_time * 1000).toISOString().slice(0, 16).replace('T', ' ')
  const title = `📨 From: ${senderName} | ${timeStr}`

  const markupTags = (body.match(/\[(?:To|cc):\d+\]/g) ?? []).join('')
  const content = markupTags ? `${markupTags}\n${result.translatedText}` : result.translatedText

  return `[info][title]${title}[/title]\n${content}[/info]`
}

/**
 * Looks up the sender's name, builds the translated message, and sends it
 * to the configured destination Chatwork room.
 * Returns delivery metadata — never throws; errors are captured in the returned status.
 */
export async function sendTranslatedMessage(
  event: ChatworkMessageEvent,
  result: TranslationResult,
  config: { apiToken: string; destinationRoomId: number },
): Promise<OutputDelivery> {
  try {
    const client = new ChatworkClient({ apiToken: config.apiToken })
    const members = await client.getMembers(event.webhook_event.room_id)
    const sender = members.find((m) => m.account_id === event.webhook_event.account_id)
    const senderName = sender?.name ?? `#${String(event.webhook_event.account_id)}`

    const message = buildTranslatedMessage(event, result, senderName)
    const response = await client.sendMessage({ roomId: config.destinationRoomId, message })

    return {
      status: 'sent',
      destinationRoomId: config.destinationRoomId,
      destinationMessageId: response.message_id,
      sentAt: new Date().toISOString(),
    }
  } catch (error) {
    return {
      status: 'failed',
      destinationRoomId: config.destinationRoomId,
      errorCode: 'CHATWORK_API',
      errorMessage: error instanceof Error ? error.message : String(error),
      sentAt: new Date().toISOString(),
    }
  }
}
