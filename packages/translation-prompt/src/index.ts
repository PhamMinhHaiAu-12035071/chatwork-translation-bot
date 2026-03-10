export {
  buildAnalysisPrompts,
  buildTranslationPrompts,
  buildReviewPrompts,
  TranslationDraftSchema,
  AnalysisSchema,
  ReviewSchema,
  PipelineTraceSchema,
} from './translation-prompt'
export type {
  TranslationDraft,
  AnalysisResult,
  ReviewResult,
  PipelineTrace,
} from './translation-prompt'

// Legacy exports for backward compatibility
export {
  buildTranslationPrompt as buildTranslationPrompt_legacy,
  buildSystemPrompt as buildSystemPrompt_legacy,
  buildUserPrompt as buildUserPrompt_legacy,
} from './translation-prompt'
export type { TranslationOutput } from './translation-prompt'
