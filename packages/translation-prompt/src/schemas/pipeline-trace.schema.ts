import { z } from 'zod'
import { AnalysisSchema } from './analysis.schema'
import { ReviewSchema } from './review.schema'

export const PipelineTraceSchema = z.object({
  analysis: AnalysisSchema,
  rounds: z.array(ReviewSchema).max(5),
  finalScore: z.number().min(0).max(10),
  totalRounds: z.number().int().min(0),
  escalated: z.boolean(),
  durationMs: z.number().int().min(0),
})

export type PipelineTrace = z.infer<typeof PipelineTraceSchema>
