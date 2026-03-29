export interface KagiTranslateOptions {
  text: string
  from: string // ISO 639-1 or 'auto'
  to: string // ISO 639-1
  style?: 'natural' | 'literal'
  formality?: 'default' | 'more' | 'less'
  quality?: 'standard' | 'best'
  languageComplexity?: 'standard' | 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2'
  speakerGender?: 'unknown' | 'masculine' | 'feminine' | 'neutral'
  addresseeGender?: 'unknown' | 'masculine' | 'feminine' | 'neutral'
  context?: string
  preserveFormatting?: boolean
}
