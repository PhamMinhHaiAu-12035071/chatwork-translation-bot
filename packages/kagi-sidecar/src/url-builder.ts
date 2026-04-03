const KAGI_TRANSLATE_BASE_URL = 'https://translate.kagi.com/'

type KagiTranslationType = 'natural' | 'literal'
type KagiFormality = 'standard' | 'vietnamese_formal' | 'vietnamese_casual'
type KagiReadingLevel = 'standard' | 'a2' | 'b2' | 'c1' | 'c2'

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

type KagiStylePreset = Readonly<{
  translationType: KagiTranslationType
  formality: KagiFormality
  readingLevel: KagiReadingLevel
}>

const KAGI_STYLE_PRESETS: Record<KagiStyle, KagiStylePreset> = {
  Wild: {
    translationType: 'natural',
    formality: 'vietnamese_casual',
    readingLevel: 'c2',
  },
  Warm: {
    translationType: 'natural',
    formality: 'vietnamese_casual',
    readingLevel: 'standard',
  },
  Easy: {
    translationType: 'natural',
    formality: 'standard',
    readingLevel: 'a2',
  },
  Clear: {
    translationType: 'natural',
    formality: 'standard',
    readingLevel: 'standard',
  },
  Smart: {
    translationType: 'natural',
    formality: 'standard',
    readingLevel: 'c1',
  },
  Deep: {
    translationType: 'natural',
    formality: 'standard',
    readingLevel: 'c2',
  },
  Fine: {
    translationType: 'natural',
    formality: 'vietnamese_formal',
    readingLevel: 'standard',
  },
  Polite: {
    translationType: 'natural',
    formality: 'vietnamese_formal',
    readingLevel: 'b2',
  },
  Elegant: {
    translationType: 'natural',
    formality: 'vietnamese_formal',
    readingLevel: 'c2',
  },
  True: {
    translationType: 'literal',
    formality: 'standard',
    readingLevel: 'b2',
  },
  Precise: {
    translationType: 'literal',
    formality: 'standard',
    readingLevel: 'standard',
  },
  Exact: {
    translationType: 'literal',
    formality: 'standard',
    readingLevel: 'c2',
  },
}

type KagiStyleQuery = Readonly<{
  formality?: 'less' | 'more'
  formalityContext?: string
  languageComplexity?: Exclude<KagiReadingLevel, 'standard'>
  style?: 'literal'
}>

function mapFormality(
  formality: KagiFormality,
): Pick<KagiStyleQuery, 'formality' | 'formalityContext'> {
  if (formality === 'vietnamese_formal') {
    return {
      formality: 'more',
      formalityContext: 'vi_formal',
    }
  }

  if (formality === 'vietnamese_casual') {
    return {
      formality: 'less',
      formalityContext: 'vi_casual',
    }
  }

  return {}
}

function mapReadingLevel(
  readingLevel: KagiReadingLevel,
): Pick<KagiStyleQuery, 'languageComplexity'> {
  if (readingLevel === 'standard') {
    return {}
  }

  return {
    languageComplexity: readingLevel,
  }
}

function mapTranslationType(translationType: KagiTranslationType): Pick<KagiStyleQuery, 'style'> {
  if (translationType === 'literal') {
    return {
      style: 'literal',
    }
  }

  return {}
}

function getStyleQuery(style: KagiStyle): KagiStyleQuery {
  const preset = KAGI_STYLE_PRESETS[style]

  return {
    ...mapFormality(preset.formality),
    ...mapReadingLevel(preset.readingLevel),
    ...mapTranslationType(preset.translationType),
  }
}

export function buildKagiUrl(text: string, style: KagiStyle, context?: string): string {
  const params = new URLSearchParams()
  const styleParams = getStyleQuery(style)
  const trimmedContext = context?.trim()

  params.set('from', 'auto')
  params.set('to', 'vi')
  params.set('text', text)
  params.set('preserveFormatting', 'true')

  if (styleParams.formality !== undefined) {
    params.set('formality', styleParams.formality)
  }

  if (styleParams.formalityContext !== undefined) {
    params.set('formality_context', styleParams.formalityContext)
  }

  if (styleParams.languageComplexity !== undefined) {
    params.set('language_complexity', styleParams.languageComplexity)
  }

  if (styleParams.style !== undefined) {
    params.set('style', styleParams.style)
  }

  if (trimmedContext !== undefined && trimmedContext.length > 0) {
    params.set('context', trimmedContext)
  }

  return `${KAGI_TRANSLATE_BASE_URL}?${params.toString()}`
}
