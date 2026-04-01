import { z } from 'zod'

export const KEYWORD_CATEGORIES = ['company', 'person', 'project', 'code', 'other'] as const
export type KeywordCategory = (typeof KEYWORD_CATEGORIES)[number]

export const KeywordEntrySchema = z.object({
  keyword: z.string().min(1).max(100),
  category: z.enum(KEYWORD_CATEGORIES),
  placeholder: z.string().max(50).optional(),
})

export type KeywordEntry = z.infer<typeof KeywordEntrySchema>
