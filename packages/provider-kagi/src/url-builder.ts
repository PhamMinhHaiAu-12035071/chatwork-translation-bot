import type { KagiStyle } from './types'
import { KAGI_STYLE_PRESETS } from './types'

const KAGI_TRANSLATE_BASE_URL = 'https://translate.kagi.com/'

type KagiTranslationType = 'natural' | 'literal'
type KagiFormality = 'standard' | 'vietnamese_formal' | 'vietnamese_casual'
type KagiReadingLevel = 'standard' | 'a2' | 'b2' | 'c1' | 'c2'

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

export function buildPreviewUrl(style: KagiStyle, context?: string | null): string {
  return buildKagiUrl('hello', style, context ?? undefined)
}
