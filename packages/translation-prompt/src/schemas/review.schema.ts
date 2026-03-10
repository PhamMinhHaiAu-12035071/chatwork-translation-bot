import { z } from 'zod'

export const MQMLiteSchema = z.object({
  naturalFlow: z.number().int().min(0).max(3), // 3pts — reads naturally in Vietnamese
  culturalFidelity: z.number().int().min(0).max(2), // 2pts — cultural context preserved
  readerExperience: z.number().int().min(0).max(2), // 2pts — Vietnamese reader experience
  semanticAccuracy: z.number().int().min(0).max(2), // 2pts — no meaning lost/added
  targetConventions: z.number().int().min(0).max(1), // 1pt  — target language conventions
})

export const ReviewSchema = z.object({
  scores: MQMLiteSchema,
  totalScore: z.number().int().min(0).max(10),
  passed: z.boolean(),
  critique: z.string().min(1),
  refinedTranslation: z.string().min(1),
  personaFeedback: z.object({
    freshReader: z.string(),
    linguist: z.string(),
    editor: z.string(),
  }),
})

export const TranslationDraftSchema = z.object({
  sourceLang: z.string().min(1),
  translated: z.string().min(1),
})

export type MQMLite = z.infer<typeof MQMLiteSchema>
export type ReviewResult = z.infer<typeof ReviewSchema>
export type TranslationDraft = z.infer<typeof TranslationDraftSchema>
