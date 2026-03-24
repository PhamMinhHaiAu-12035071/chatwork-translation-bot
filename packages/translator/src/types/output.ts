import type { TranslationIngressCommand, TranslationResult } from '@chatwork-bot/core'

export interface OutputOrigin {
  type: 'manual' | 'automation'
  datasetFile?: string
  datasetItemId?: string
  datasetLineNumber?: number
}

export interface OutputDelivery {
  status: 'sent' | 'partial' | 'failed'
  destinationRoomId: number
  messages?: OutputDeliveryMessage[]
  destinationMessageId?: string
  errorCode?: string
  errorMessage?: string
  sentAt: string
}

export interface OutputDeliveryMessage {
  kind: 'metadata' | 'body'
  status: 'sent' | 'failed'
  destinationMessageId?: string
  errorCode?: string
  errorMessage?: string
}

export interface OutputRecord {
  command: TranslationIngressCommand
  translation: TranslationResult
  origin?: OutputOrigin
  delivery?: OutputDelivery
}
