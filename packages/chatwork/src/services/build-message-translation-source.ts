import type { ChatworkWebhookPayload } from '~/types/webhook'
import type { MessageDecorationSnapshot } from '~/types/message-decoration'
import { parseMessageDecoration } from './parse-message-decoration'

export interface MessageTranslationSource {
  translationInputs: string[]
  translatableText: string
  decorationSnapshot: {
    webhookPayload: ChatworkWebhookPayload
    snapshot: MessageDecorationSnapshot
  }
}

/**
 * Builds a comprehensive translation source from a webhook payload.
 * Parses the message body into a structured snapshot with ordered translation inputs,
 * portable render template, and metadata hints.
 */
export function buildMessageTranslationSource(
  payload: ChatworkWebhookPayload,
): MessageTranslationSource {
  const snapshot = parseMessageDecoration(payload.webhook_event.body)

  return {
    translationInputs: snapshot.translationInputs,
    translatableText: snapshot.translatableText,
    decorationSnapshot: {
      webhookPayload: payload,
      snapshot,
    },
  }
}
