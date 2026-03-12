import { sendRoomMessage, resolveRoomMemberDisplayName } from '@chatwork-bot/chatwork'
import type { TranslationIngressCommand, TranslationResult } from '@chatwork-bot/core'
import type { OutputDelivery } from '~/types/output'

/**
 * Builds the translated message string to send to the destination Chatwork room.
 * Preserves [To:xxx] and [cc:xxx] markup tags from the original body.
 * Wraps content in Chatwork [info][title] block with metadata.
 */
export function buildTranslatedMessage(
  command: TranslationIngressCommand,
  result: TranslationResult,
  senderName: string,
): string {
  const { rawBody, sendTime } = command

  const timeStr = new Date(sendTime * 1000).toISOString().slice(0, 16).replace('T', ' ')
  const title = `📨 From: ${senderName} | ${timeStr}`

  const markupTags = (rawBody.match(/\[(?:To|cc):\d+\]/g) ?? []).join('')
  const content = markupTags ? `${markupTags}\n${result.translatedText}` : result.translatedText

  return `[info][title]${title}[/title]\n${content}[/info]`
}

/**
 * Looks up the sender's name, builds the translated message, and sends it
 * to the configured destination Chatwork room.
 * Returns delivery metadata — never throws; errors are captured in the returned status.
 */
export async function sendTranslatedMessage(
  command: TranslationIngressCommand,
  result: TranslationResult,
  config: { apiToken: string; destinationRoomId: number },
): Promise<OutputDelivery> {
  try {
    const cache = new Map<number, string>()
    const senderName = await resolveRoomMemberDisplayName(
      command.sourceRoomId,
      command.senderAccountId,
      config.apiToken,
      cache,
    )

    const message = buildTranslatedMessage(command, result, senderName)
    const response = await sendRoomMessage(config.destinationRoomId, message, config.apiToken)

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
