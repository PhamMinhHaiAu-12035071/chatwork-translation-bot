export type TranslationStyle =
  | 'AUTO_CONTEXT'
  | 'NATURAL_CASUAL'
  | 'PROFESSIONAL_BUSINESS'
  | 'TECHNICAL'

export type AiProvider = 'openai' | 'gemini'

export interface RoomConfigPublic {
  id: string
  originalRoomId: number
  destinationRoomId: number
  destinationRoomName: string
  aiProvider: AiProvider
  aiModel: string | null
  translationStyle: TranslationStyle
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface ProviderInfo {
  id: string
  name: string
  models: string[]
  defaultModel: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  details?: unknown
  webhookUrl?: string
}

export interface CreateRoomInput {
  originalRoomId: number
  destinationRoomName: string
  aiProvider: AiProvider
  aiModel: string | null
  translationStyle: TranslationStyle
  aiApiToken: string
  webhookSecret: string
}

export interface DeleteRoomResult {
  outcome: 'deleted' | 'already_deleted'
}

export interface UpdateRoomInput {
  destinationRoomName?: string
  aiProvider?: AiProvider
  aiModel?: string | null
  translationStyle?: TranslationStyle
  aiApiToken?: string
  webhookSecret?: string
}
