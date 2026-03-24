import { z } from 'zod'

export const TranslationDraftSchema = z.object({
  sourceLang: z.string().min(1),
  translated: z.string().min(1),
})

export type TranslationDraft = z.infer<typeof TranslationDraftSchema>
