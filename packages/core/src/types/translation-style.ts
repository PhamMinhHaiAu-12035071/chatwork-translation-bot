export const TRANSLATION_STYLE_VALUES = [
  'NATURAL_CASUAL',
  'PROFESSIONAL_BUSINESS',
  'TECHNICAL',
] as const

export type TranslationStyle = (typeof TRANSLATION_STYLE_VALUES)[number]

export const DEFAULT_TRANSLATION_STYLE: TranslationStyle = 'PROFESSIONAL_BUSINESS'

export function isTranslationStyle(value: string): value is TranslationStyle {
  return TRANSLATION_STYLE_VALUES.includes(value as TranslationStyle)
}
