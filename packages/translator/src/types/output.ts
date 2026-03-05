import type { ChatworkWebhookEvent, TranslationResult } from '@chatwork-bot/core'

export type OutputRecord = ChatworkWebhookEvent & {
  translation: TranslationResult
}
