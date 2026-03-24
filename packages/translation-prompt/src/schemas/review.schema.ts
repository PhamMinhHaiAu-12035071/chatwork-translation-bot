import { z } from 'zod'

export const TranslationDraftSchema = z.object({
  sourceLang: z.string().min(1),
  translated: z.string().min(1),
})

export type TranslationDraft = z.infer<typeof TranslationDraftSchema>

export const StructuredTranslationDraftSchema = z.object({
  sourceLang: z.string().min(1),
  translatedSegments: z.array(z.string().min(1)).nonempty(),
})

export type StructuredTranslationDraft = z.infer<typeof StructuredTranslationDraftSchema>
