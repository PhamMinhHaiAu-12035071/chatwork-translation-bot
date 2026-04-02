export const KAGI_TRANSLATION_TYPE_VALUES = ['natural', 'literal'] as const
export type KagiTranslationType = (typeof KAGI_TRANSLATION_TYPE_VALUES)[number]

export const KAGI_FORMALITY_VALUES = ['standard', 'vietnamese_formal', 'vietnamese_casual'] as const
export type KagiFormality = (typeof KAGI_FORMALITY_VALUES)[number]

export const KAGI_READING_LEVEL_VALUES = ['standard', 'a2', 'b2', 'c1', 'c2'] as const
export type KagiReadingLevel = (typeof KAGI_READING_LEVEL_VALUES)[number]

export const KAGI_STYLE_VALUES = [
  'Wild',
  'Warm',
  'Easy',
  'Clear',
  'Smart',
  'Deep',
  'Fine',
  'Polite',
  'Elegant',
  'True',
  'Precise',
  'Exact',
] as const
export type KagiStyle = (typeof KAGI_STYLE_VALUES)[number]

export interface KagiStylePreset {
  label: string
  translationType: KagiTranslationType
  formality: KagiFormality
  readingLevel: KagiReadingLevel
}

export const KAGI_STYLE_PRESETS: Record<KagiStyle, KagiStylePreset> = {
  Wild: {
    label: 'Wild',
    translationType: 'natural',
    formality: 'vietnamese_casual',
    readingLevel: 'c2',
  },
  Warm: {
    label: 'Warm',
    translationType: 'natural',
    formality: 'vietnamese_casual',
    readingLevel: 'standard',
  },
  Easy: {
    label: 'Easy',
    translationType: 'natural',
    formality: 'standard',
    readingLevel: 'a2',
  },
  Clear: {
    label: 'Clear',
    translationType: 'natural',
    formality: 'standard',
    readingLevel: 'standard',
  },
  Smart: {
    label: 'Smart',
    translationType: 'natural',
    formality: 'standard',
    readingLevel: 'c1',
  },
  Deep: {
    label: 'Deep',
    translationType: 'natural',
    formality: 'standard',
    readingLevel: 'c2',
  },
  Fine: {
    label: 'Fine',
    translationType: 'natural',
    formality: 'vietnamese_formal',
    readingLevel: 'standard',
  },
  Polite: {
    label: 'Polite',
    translationType: 'natural',
    formality: 'vietnamese_formal',
    readingLevel: 'b2',
  },
  Elegant: {
    label: 'Elegant',
    translationType: 'natural',
    formality: 'vietnamese_formal',
    readingLevel: 'c2',
  },
  True: {
    label: 'True',
    translationType: 'literal',
    formality: 'standard',
    readingLevel: 'b2',
  },
  Precise: {
    label: 'Precise',
    translationType: 'literal',
    formality: 'standard',
    readingLevel: 'standard',
  },
  Exact: {
    label: 'Exact',
    translationType: 'literal',
    formality: 'standard',
    readingLevel: 'c2',
  },
}

export const KAGI_STYLE_LABELS: Record<KagiStyle, string> = {
  Wild: KAGI_STYLE_PRESETS.Wild.label,
  Warm: KAGI_STYLE_PRESETS.Warm.label,
  Easy: KAGI_STYLE_PRESETS.Easy.label,
  Clear: KAGI_STYLE_PRESETS.Clear.label,
  Smart: KAGI_STYLE_PRESETS.Smart.label,
  Deep: KAGI_STYLE_PRESETS.Deep.label,
  Fine: KAGI_STYLE_PRESETS.Fine.label,
  Polite: KAGI_STYLE_PRESETS.Polite.label,
  Elegant: KAGI_STYLE_PRESETS.Elegant.label,
  True: KAGI_STYLE_PRESETS.True.label,
  Precise: KAGI_STYLE_PRESETS.Precise.label,
  Exact: KAGI_STYLE_PRESETS.Exact.label,
}

export const KAGI_STYLE_DESCRIPTIONS: Record<KagiStyle, string> = {
  Wild: 'Casual, vivid, and full of energy.',
  Warm: 'Casual and friendly without sounding too loose.',
  Easy: 'Simple, light, and very easy to follow.',
  Clear: 'Balanced, natural, and easy to read.',
  Smart: 'Sharper and more polished for thoughtful writing.',
  Deep: 'Rich and nuanced for dense or complex ideas.',
  Fine: 'Polite and refined with a formal tone.',
  Polite: 'Professional, courteous, and business-friendly.',
  Elegant: 'Formal, polished, and elevated in tone.',
  True: 'Literal and faithful to the source wording.',
  Precise: 'Literal with a clean and straightforward tone.',
  Exact: 'Literal and highly precise for nuanced text.',
}

export interface KagiTranslateRequest {
  text: string
  style: KagiStyle
  context?: string
}

export interface KagiTranslateResponse {
  translated: string
}

export interface KagiErrorPayload {
  error: {
    code: string
    message: string
  }
}
