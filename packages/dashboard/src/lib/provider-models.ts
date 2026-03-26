import type { AiProvider, TranslationStyle } from '~/stores/room-store'

export interface ModelOption {
  value: string
  label: string
}

export const PROVIDER_MODELS: Record<AiProvider, ModelOption[]> = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
  gemini: [
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  ],
}

export const TRANSLATION_STYLE_LABELS: Record<TranslationStyle, string> = {
  AUTO_CONTEXT: 'Auto Context',
  NATURAL_CASUAL: 'Natural Casual',
  PROFESSIONAL_BUSINESS: 'Professional Business',
  TECHNICAL: 'Technical',
}

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  openai: 'OpenAI',
  gemini: 'Google Gemini',
}
