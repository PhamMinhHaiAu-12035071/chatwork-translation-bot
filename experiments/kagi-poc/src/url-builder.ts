import type { KagiTranslateOptions } from './types'

const BASE_URL = 'https://translate.kagi.com/'

export function buildKagiUrl(options: KagiTranslateOptions): string {
  if (!options.text.trim()) {
    throw new Error('text must not be empty')
  }

  const params = new URLSearchParams()
  params.set('from', options.from)
  params.set('to', options.to)
  params.set('text', options.text)

  if (options.style !== undefined) params.set('style', options.style)
  if (options.formality !== undefined) params.set('formality', options.formality)
  if (options.quality !== undefined) params.set('quality', options.quality)
  if (options.languageComplexity !== undefined)
    params.set('language_complexity', options.languageComplexity)
  if (options.speakerGender !== undefined) params.set('speaker_gender', options.speakerGender)
  if (options.addresseeGender !== undefined) params.set('addressee_gender', options.addresseeGender)
  if (options.context !== undefined && options.context !== '')
    params.set('context', options.context)
  if (options.preserveFormatting !== undefined)
    params.set('preserveFormatting', String(options.preserveFormatting))

  return `${BASE_URL}?${params.toString()}`
}
