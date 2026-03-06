import { ChatworkClient } from '@chatwork-bot/core'
import type { ChatworkMessageEvent, TranslationResult } from '@chatwork-bot/core'

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
  const { room_id, message_id, body, send_time } = event.webhook_event

  const timeStr = new Date(send_time * 1000).toISOString().slice(0, 16).replace('T', ' ')
  const title = `📨 Room#${String(room_id)} | From: ${senderName} | MsgID:${message_id} | ${timeStr}`

  const markupTags = (body.match(/\[(?:To|cc):\d+\]/g) ?? []).join('')
  const content = markupTags ? `${markupTags}\n${result.translatedText}` : result.translatedText

  return `[info][title]${title}[/title]\n${content}[/info]`
}

/**
 * Looks up the sender's name, builds the translated message, and sends it
 * to the configured destination Chatwork room.
 * Swallows all errors — output file is always preserved regardless of send status.
 */
export async function sendTranslatedMessage(
  event: ChatworkMessageEvent,
  result: TranslationResult,
  config: { apiToken: string; destinationRoomId: number },
): Promise<void> {
  try {
    const client = new ChatworkClient({ apiToken: config.apiToken })
    const members = await client.getMembers(event.webhook_event.room_id)
    const sender = members.find((m) => m.account_id === event.webhook_event.account_id)
    const senderName = sender?.name ?? `#${String(event.webhook_event.account_id)}`

    const message = buildTranslatedMessage(event, result, senderName)
    await client.sendMessage({ roomId: config.destinationRoomId, message })
    console.log(`[chatwork-sender] Sent translation to room#${String(config.destinationRoomId)}`)
  } catch (error) {
    console.error('[chatwork-sender] Failed to send translated message:', error)
  }
}
