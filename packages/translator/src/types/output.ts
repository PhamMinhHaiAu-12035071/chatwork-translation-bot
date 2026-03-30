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

export interface OutputLLMPrompt {
  system: string
  user: string
  systemSha256: string
  userSha256: string
}

export interface OutputLLMGeneration {
  temperature: number | null
  maxOutputTokens: number | null
  providerOptions: Record<string, unknown> | null
  providerManaged: boolean
}

export interface OutputLLM {
  provider: string
  model: string
  translationStyle: string
  promptMode: 'single_text' | 'structured_segments'
  promptBuildId: string
  prompt: OutputLLMPrompt
  generation: OutputLLMGeneration
}

export interface OutputRecord {
  command: TranslationIngressCommand
  translation: TranslationResult
  origin?: OutputOrigin
  delivery?: OutputDelivery
  llm?: OutputLLM
}
