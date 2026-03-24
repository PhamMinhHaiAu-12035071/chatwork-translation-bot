import type { TranslationIngressCommand, TranslationResult } from '@chatwork-bot/core'

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
  origin?: OutputOrigin
  delivery?: OutputDelivery
}
