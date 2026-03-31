import type { AiProvider, TranslationStyle } from '~/stores/room-store'

export interface ModelOption {
  value: string
  label: string
}

export const PROVIDER_MODELS: Record<AiProvider, ModelOption[]> = {
  openai: [
    { value: 'gpt-5.4', label: 'GPT-5.4 ⚡ Latest' },
    { value: 'gpt-5.2', label: 'GPT-5.2' },
    { value: 'gpt-5.1', label: 'GPT-5.1' },
    { value: 'gpt-5-mini', label: 'GPT-5 Mini (Cost-efficient)' },
    { value: 'gpt-4.1', label: 'GPT-4.1 (Stable)' },
  ],
  gemini: [
    { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview ⚡ Latest' },
    { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Stable)' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Stable)' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  ],
}

export const TRANSLATION_STYLE_LABELS: Record<TranslationStyle, string> = {
  NATURAL_CASUAL: 'Natural Casual',
  PROFESSIONAL_BUSINESS: 'Professional Business',
  TECHNICAL: 'Technical',
}

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  openai: 'OpenAI',
  gemini: 'Google Gemini',
}

/** Default when switching provider or when stored model is not in the current provider list. */
export const BEST_MODEL_BY_PROVIDER: Record<AiProvider, string> = {
  openai: 'gpt-5.4',
  gemini: 'gemini-3.1-pro-preview',
}

export function isModelValidForProvider(aiModel: string, provider: AiProvider): boolean {
  return PROVIDER_MODELS[provider].some((m) => m.value === aiModel)
}
