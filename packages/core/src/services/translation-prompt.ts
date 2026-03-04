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

export function buildTranslationPrompt(text: string): string {
  return `You are a professional translator.
Detect the source language and translate the following text into natural, human-readable Vietnamese.
Use natural, idiomatic phrasing so the translation reads like prose written by a native speaker.
Preserve the original meaning, tone, and nuance.
Preserve paragraph breaks (blank lines) when they still feel natural in Vietnamese.
Single line breaks within the same paragraph may be smoothed for better readability.
Return the detected source language as its full English name (e.g., 'Japanese', 'Vietnamese', 'Traditional Chinese').

Text: ${text}`
}
