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
    account_id: _accountId,
    message_id: messageId,
    body,
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
      ...event,
      translation: result,
    })

    console.log(
      `[handler] Translated: ${result.sourceLang} → ${result.targetLang} | room:${roomId.toString()} | msg:${messageId}`,
    )
  } catch (error) {
    if (error instanceof TranslationError) {
      console.error(`[handler] TranslationError [${error.code}]: ${error.message}`)
      return
    }
    console.error('[handler] Unexpected error:', error)
  }
}
