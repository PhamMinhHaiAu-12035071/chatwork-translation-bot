import {
  isChatworkMessageEvent,
  stripChatworkMarkup,
  TranslationServiceFactory,
  TranslationError,
} from '@chatwork-bot/core'
import type { ChatworkWebhookEvent } from '@chatwork-bot/core'
import { env } from '../env'
import { writeTranslationOutput } from '../utils/output-writer'
import { sendTranslatedMessage } from '../services/chatwork-sender'

export async function handleTranslateRequest(event: ChatworkWebhookEvent): Promise<void> {
  if (!isChatworkMessageEvent(event)) {
    return
  }

  const { body } = event.webhook_event

  const cleanText = stripChatworkMarkup(body)
  if (!cleanText) {
    return
  }

  try {
    const service = TranslationServiceFactory.create(env.AI_PROVIDER, env.AI_MODEL)
    const result = await service.translate(cleanText)

    const outputBaseDir = process.env['OUTPUT_BASE_DIR']
    await writeTranslationOutput(
      { ...event, translation: result },
      ...(outputBaseDir ? [outputBaseDir] : []),
    )

    await sendTranslatedMessage(event, result, {
      apiToken: env.CHATWORK_API_TOKEN,
      destinationRoomId: env.CHATWORK_DESTINATION_ROOM_ID,
    })
  } catch (error) {
    if (error instanceof TranslationError) {
      return
    }
    throw error
  }
}
