import { DEFAULT_TRANSLATION_STYLE } from '@chatwork-bot/core'
import type { TranslationStyle } from '@chatwork-bot/core'
import { SINGLE_CALL_SYSTEM } from '~/sections/single-call'
import { buildTranslationStyleSection } from '~/sections/translation-style-profiles'
import { StructuredTranslationDraftSchema, TranslationDraftSchema } from '~/schemas/review.schema'

/** Prompt input pair for LLM execution. */
export interface PromptPair {
  system: string
  user: string
}

export { TranslationDraftSchema }
export { StructuredTranslationDraftSchema }
export type { StructuredTranslationDraft, TranslationDraft } from '~/schemas/review.schema'

/**
 * Single-call: expert prompt + self-critique gate in one shot.
 * Replaces the 3-phase analysis → translation → review pipeline.
 */
export function buildSingleCallPrompts(
  text: string,
  style: TranslationStyle = DEFAULT_TRANSLATION_STYLE,
): PromptPair {
  return {
    system: [SINGLE_CALL_SYSTEM, buildTranslationStyleSection(style)].join('\n\n'),
    user: `Translate the following text into natural Vietnamese.
Respond ONLY with valid JSON:
{"sourceLang": "<full English language name>", "translated": "<Vietnamese translation>"}

Text:
${text}`,
  }
}

export function buildStructuredTranslationPrompts(
  segments: string[],
  style: TranslationStyle = DEFAULT_TRANSLATION_STYLE,
): PromptPair {
  return {
    system: [SINGLE_CALL_SYSTEM, buildTranslationStyleSection(style)].join('\n\n'),
    user: `Translate each source segment into natural Vietnamese.
Preserve array length and order exactly.
Do not merge, split, drop, or reorder segments.
Respond ONLY with valid JSON:
{"sourceLang": "<full English language name>", "translatedSegments": ["<Vietnamese segment 1>", "<Vietnamese segment 2>"]}

Source segments:
${JSON.stringify(segments, null, 2)}`,
  }
}
