import { PERSONA, CORE_DOCTRINE } from '~/sections/core'
import { JAPANESE_RULES } from '~/sections/language-layers'
import { HUMANIZER, STRUCTURAL } from '~/sections/humanizer'
import { CONSTRAINTS } from '~/sections/constraints'
import { buildAnalysisPrompts as _buildAnalysisPrompts } from '~/sections/analysis'
import { buildReviewPrompts as _buildReviewPrompts } from '~/sections/review'
import type { AnalysisResult } from '~/schemas/analysis.schema'
import { TranslationDraftSchema, ReviewSchema } from '~/schemas/review.schema'
import { AnalysisSchema } from '~/schemas/analysis.schema'
import { PipelineTraceSchema } from '~/schemas/pipeline-trace.schema'

/** Prompt input pair for LLM execution. */
export interface PromptPair {
  system: string
  user: string
}

export { TranslationDraftSchema }
export type { TranslationDraft } from '~/schemas/review.schema'
export { AnalysisSchema }
export type { AnalysisResult } from '~/schemas/analysis.schema'
export type {
  SourceProfile,
  IntentLabels,
  RenderingPolicy,
  PreservationRules,
  StructuredHints,
} from '~/schemas/analysis.schema'
export { ReviewSchema }
export type { ReviewResult } from '~/schemas/review.schema'
export { PipelineTraceSchema }
export type { PipelineTrace } from '~/schemas/pipeline-trace.schema'

const TRANSLATION_SYSTEM = [
  PERSONA,
  CORE_DOCTRINE,
  JAPANESE_RULES,
  HUMANIZER,
  STRUCTURAL,
  CONSTRAINTS,
].join('\n\n')

/**
 * Phase 0+1: Skopos inference + 14D source analysis.
 * Returns prompts for the LLM to produce an AnalysisResult JSON.
 */
export function buildAnalysisPrompts(text: string): PromptPair {
  return _buildAnalysisPrompts(text)
}

function buildStructuredHintsBlock(analysis: AnalysisResult): string {
  const { structuredHints } = analysis
  const { intentLabels, renderingPolicy, preservationRules, reviewFocus } = structuredHints

  const reviewFocusLines =
    reviewFocus.length > 0 ? reviewFocus.map((f) => `- ${f}`).join('\n') : '- (none)'

  return `## Structured Hints
- Phrase type: ${intentLabels.phraseType} (${intentLabels.confidence} confidence)
- Target style: ${renderingPolicy.targetStyle}
- avoidLiteralFormulaTranslation: ${String(renderingPolicy.avoidLiteralFormulaTranslation)}
- Preserve ambiguity: ${String(renderingPolicy.preserveAmbiguity)}

## Preservation Rules
- preserveUrl: ${String(preservationRules.preserveUrl)}
- preserveCode: ${String(preservationRules.preserveCode)}
- preserveUnits: ${String(preservationRules.preserveUnits)}
- preserveChatworkMarkup: ${String(preservationRules.preserveChatworkMarkup)}
- preserveJapaneseNameScript: ${String(preservationRules.preserveJapaneseNameScript)}
- allowRomajiGloss: ${String(preservationRules.allowRomajiGloss)}
- forbidGenderInference: ${String(preservationRules.forbidGenderInference)}

## Review Focus
${reviewFocusLines}`
}

/**
 * Phase 2: Translation informed by analysis context.
 * Returns prompts for the LLM to produce a TranslationDraft JSON.
 */
export function buildTranslationPrompts(text: string, analysis: AnalysisResult): PromptPair {
  const analysisContext = `## Translation Context (from source analysis)
- Skopos strategy: ${analysis.skopos.strategy}
- Register: ${analysis.skopos.register}
- Audience: ${analysis.skopos.audience}
- Text function: ${analysis.crossCutting.textFunction}
- Tone: ${analysis.crossCutting.registerTone}
- Subject: ${analysis.intratextual.subjectMatter}
- Key notes: ${analysis.intratextual.lexisNotes}

Apply this context to produce a translation that serves the Vietnamese reader (${analysis.skopos.strategy} strategy).`

  const hintsBlock = buildStructuredHintsBlock(analysis)

  return {
    system: TRANSLATION_SYSTEM,
    user: `${analysisContext}

${hintsBlock}

Translate the following text into natural Vietnamese.
Respond ONLY with valid JSON:
{"sourceLang": "<full English language name>", "translated": "<Vietnamese translation>"}

Text:
${text}`,
  }
}

/**
 * Phase 3: 3-Persona MQM-Lite review.
 * Returns prompts for the LLM to produce a ReviewResult JSON.
 */
export function buildReviewPrompts(
  text: string,
  analysis: AnalysisResult,
  currentDraft: string,
  round: number,
  escalated = false,
): PromptPair {
  return _buildReviewPrompts(text, analysis, currentDraft, round, escalated)
}
