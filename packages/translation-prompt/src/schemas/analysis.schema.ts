import { z } from 'zod'

export const SkoposSchema = z.object({
  purpose: z.enum(['informational', 'persuasive', 'emotional', 'technical', 'casual']),
  audience: z.string().min(1),
  strategy: z.enum(['instrumental', 'documentary']),
  register: z.enum(['formal', 'semi-formal', 'casual', 'intimate']),
})

export const ExtratextualSchema = z.object({
  sender: z.string(),
  intention: z.string(),
  audience: z.string(),
  medium: z.string(),
  temporalContext: z.string(),
})

export const IntratextualSchema = z.object({
  subjectMatter: z.string(),
  contentSummary: z.string(),
  presuppositions: z.string(),
  textStructure: z.string(),
  lexisNotes: z.string(),
  nonVerbalElements: z.string(),
})

export const CrossCuttingSchema = z.object({
  textFunction: z.string(),
  registerTone: z.string(),
  expectedEffect: z.string(),
})

export const AnalysisSchema = z.object({
  skopos: SkoposSchema,
  extratextual: ExtratextualSchema,
  intratextual: IntratextualSchema,
  crossCutting: CrossCuttingSchema,
})

export type Skopos = z.infer<typeof SkoposSchema>
export type AnalysisResult = z.infer<typeof AnalysisSchema>
