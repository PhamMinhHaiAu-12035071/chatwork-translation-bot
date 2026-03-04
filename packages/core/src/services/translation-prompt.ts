import { z } from 'zod'

export const TranslationSchema = z.object({
  sourceLang: z
    .string()
    .min(2)
    .max(50)
    .describe(
      "Full language name in English, e.g. 'Japanese', 'Vietnamese', 'Traditional Chinese'",
    ),
  translated: z.string().min(1),
})

export type TranslationOutput = z.infer<typeof TranslationSchema>

export function encodeNewlines(text: string): string {
  return text.replaceAll('\n', '[[NL]]')
}

export function decodeNewlines(text: string): string {
  return text.replaceAll('[[NL]]', '\n')
}

export function buildTranslationPrompt(text: string): string {
  return `You are a professional translator.
Detect the source language and translate the following text into natural, human-readable Vietnamese.
Use natural, idiomatic phrasing within each paragraph.
Preserve the original meaning, tone, and nuance.
The text contains [[NL]] tokens marking line breaks — preserve them exactly in the translation.
Do NOT remove, merge, or translate [[NL]] tokens.
Return the detected source language as its full English name (e.g., 'Japanese', 'Vietnamese', 'Traditional Chinese').

Text: ${text}`
}
