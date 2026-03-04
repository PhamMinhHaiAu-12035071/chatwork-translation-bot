import {
  isChatworkMessageEvent,
  stripChatworkMarkup,
  TranslationServiceFactory,
  TranslationError,
} from '@chatwork-bot/core'
import type { ChatworkWebhookEvent } from '@chatwork-bot/core'
import { env } from '../env'
import { writeTranslationOutput } from '../utils/output-writer'

export async function handleTranslateRequest(event: ChatworkWebhookEvent): Promise<void> {
  if (!isChatworkMessageEvent(event)) {
    console.log('[handler] Skipping non-message event:', event.webhook_event_type)
    return
  }

  const {
    room_id: roomId,
    account_id: accountId,
    body,
    message_id: messageId,
  } = event.webhook_event

  const cleanText = stripChatworkMarkup(body)
  if (!cleanText) {
    console.log('[handler] Skipping empty message after markup strip')
    return
  }

  try {
    const service = TranslationServiceFactory.create(env.AI_PROVIDER, env.AI_MODEL)
    const result = await service.translate(cleanText)

    await writeTranslationOutput({
      originalText: result.originalText,
      translatedText: result.translatedText,
      sourceLang: result.sourceLang,
      targetLang: result.targetLang,
      timestamp: result.timestamp,
      roomId,
      accountId,
      messageId,
    })

    console.log(
      `[handler] Translated: ${result.sourceLang} → vi | room:${roomId.toString()} | msg:${messageId}`,
    )
  } catch (error) {
    if (error instanceof TranslationError) {
      console.error(`[handler] TranslationError [${error.code}]: ${error.message}`)
      return
    }
    console.error('[handler] Unexpected error:', error)
  }
}
