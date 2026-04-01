const KAGI_TRANSLATE_BASE_URL = 'https://translate.kagi.com/'

export const KAGI_STYLE_VALUES = ['Wild', 'Easy', 'Clear', 'Smart', 'Fine', 'True'] as const
export type KagiStyle = (typeof KAGI_STYLE_VALUES)[number]

type KagiStyleQuery = Readonly<{
  formality?: 'more' | 'less'
  formalityContext?: string
  languageComplexity?: 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2'
  style?: 'literal'
}>

const KAGI_STYLE_QUERY_MAP: Record<KagiStyle, KagiStyleQuery> = {
  Wild: {
    formality: 'more',
    formalityContext: 'vi_casual',
    languageComplexity: 'c2',
  },
  Easy: {
    languageComplexity: 'a2',
  },
  Clear: {},
  Smart: {
    languageComplexity: 'c1',
  },
  Fine: {
    formality: 'more',
    formalityContext: 'vi_formal',
  },
  True: {
    style: 'literal',
    languageComplexity: 'b2',
  },
}

export function buildKagiUrl(text: string, style: KagiStyle, context?: string): string {
  const params = new URLSearchParams()
  const styleParams = KAGI_STYLE_QUERY_MAP[style]
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
