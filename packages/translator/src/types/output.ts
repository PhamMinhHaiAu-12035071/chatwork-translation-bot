import type { ChatworkWebhookEvent, TranslationResult } from '@chatwork-bot/core'
import type { PipelineTrace } from '@chatwork-bot/translation-prompt'

export type OutputRecord = ChatworkWebhookEvent & {
  translation: TranslationResult
  pipeline?: PipelineTrace
}
