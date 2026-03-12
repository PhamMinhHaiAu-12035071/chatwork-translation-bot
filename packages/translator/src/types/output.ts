import type { TranslationIngressCommand, TranslationResult } from '@chatwork-bot/core'
import type { PipelineTrace } from '@chatwork-bot/translation-prompt'

export interface OutputOrigin {
  type: 'manual' | 'automation'
  datasetFile?: string
  datasetItemId?: string
  datasetLineNumber?: number
}

export interface OutputDelivery {
  status: 'sent' | 'failed'
  destinationRoomId: number
  destinationMessageId?: string
  errorCode?: string
  errorMessage?: string
  sentAt: string
}

export interface OutputRecord {
  command: TranslationIngressCommand
  translation: TranslationResult
  pipeline?: PipelineTrace
  origin?: OutputOrigin
  delivery?: OutputDelivery
}
