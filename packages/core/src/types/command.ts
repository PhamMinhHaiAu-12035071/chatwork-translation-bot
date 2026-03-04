export const SUPPORTED_LANGUAGES = {
  en: 'English',
  ja: 'Japanese',
  vi: 'Vietnamese',
  zh: 'Chinese',
  ko: 'Korean',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
} as const

export type SupportedLang = keyof typeof SUPPORTED_LANGUAGES

export function isSupportedLang(lang: string): lang is SupportedLang {
  return lang in SUPPORTED_LANGUAGES
}

export interface ParsedCommand {
  targetLang: SupportedLang
  text: string
  sourceAccountId?: number
}
