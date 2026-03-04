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
Use natural, idiomatic phrasing within each paragraph.
Preserve the original meaning, tone, and nuance.
Preserve ALL whitespace structure exactly:
- Single newline (\\n) = soft line break within the same paragraph — keep as-is in the translation
- Double newline (\\n\\n) = paragraph separator — keep as-is in the translation
Do NOT merge, re-flow, or remove any line breaks.
Return the detected source language as its full English name (e.g., 'Japanese', 'Vietnamese', 'Traditional Chinese').

Text: ${text}`
}
