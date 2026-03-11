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

export const SourceProfileSchema = z.object({
  language: z.enum(['japanese', 'english']),
  medium: z.enum(['chat', 'email', 'notice', 'technical_doc', 'mixed']),
  domain: z.enum(['business', 'technical', 'support', 'general']),
  hasCode: z.boolean(),
  hasUrl: z.boolean(),
  hasJapaneseName: z.boolean(),
  hasSpecialFormatting: z.boolean(),
})

export const IntentLabelsSchema = z.object({
  phraseType: z.enum([
    'email_opening_formula',
    'email_closing_formula',
    'keigo_request',
    'request',
    'status_question',
    'maintenance_notice',
    'apology',
    'gratitude',
    'proper_name_reference',
    'code_mixed',
    'url_mixed',
    'general_statement',
    'ambiguous_short_utterance',
  ]),
  confidence: z.enum(['high', 'medium', 'low']),
})

export const RenderingPolicySchema = z.object({
  strategy: z.enum(['functional_vietnamese']),
  targetStyle: z.enum(['natural_office_vi', 'technical_vi', 'customer_service_vi']),
  preserveAmbiguity: z.boolean(),
  allowNaturalAdaptation: z.boolean(),
  avoidLiteralFormulaTranslation: z.boolean(),
})

export const PreservationRulesSchema = z.object({
  preserveUrl: z.boolean(),
  preserveCode: z.boolean(),
  preserveUnits: z.boolean(),
  preserveChatworkMarkup: z.boolean(),
  preserveJapaneseNameScript: z.boolean(),
  allowRomajiGloss: z.boolean(),
  forbidGenderInference: z.boolean(),
})

export const StructuredHintsSchema = z.object({
  sourceProfile: SourceProfileSchema,
  intentLabels: IntentLabelsSchema,
  renderingPolicy: RenderingPolicySchema,
  preservationRules: PreservationRulesSchema,
  reviewFocus: z.array(z.string()),
})

export const AnalysisSchema = z.object({
  skopos: SkoposSchema,
  extratextual: ExtratextualSchema,
  intratextual: IntratextualSchema,
  crossCutting: CrossCuttingSchema,
  structuredHints: StructuredHintsSchema,
})

export type Skopos = z.infer<typeof SkoposSchema>
export type SourceProfile = z.infer<typeof SourceProfileSchema>
export type IntentLabels = z.infer<typeof IntentLabelsSchema>
export type RenderingPolicy = z.infer<typeof RenderingPolicySchema>
export type PreservationRules = z.infer<typeof PreservationRulesSchema>
export type StructuredHints = z.infer<typeof StructuredHintsSchema>
export type AnalysisResult = z.infer<typeof AnalysisSchema>
