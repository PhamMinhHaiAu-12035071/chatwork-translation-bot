import { z } from 'zod'

export const PolishResultSchema = z.object({
  translated: z.string().min(1),
})

export type PolishResult = z.infer<typeof PolishResultSchema>

export const StructuredPolishResultSchema = z.object({
  translatedSegments: z.array(z.string().min(1)).nonempty(),
})

export type StructuredPolishResult = z.infer<typeof StructuredPolishResultSchema>
