import { z } from 'zod'

export const TranslationSchema = z.object({
  sourceLang: z.string().min(2).max(10),
  translated: z.string().min(1),
})

export type TranslationOutput = z.infer<typeof TranslationSchema>

export function buildTranslationPrompt(text: string): string {
  return `You are a professional translator.
Detect the source language and translate the following text into natural, human-readable Vietnamese prose.
Write as flowing sentences, not word-by-word.
Preserve the original meaning, tone, and nuance.

Text: ${text}`
}
