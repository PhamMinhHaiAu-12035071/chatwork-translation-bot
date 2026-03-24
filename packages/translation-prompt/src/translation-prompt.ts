import { SINGLE_CALL_SYSTEM } from '~/sections/single-call'
import { TranslationDraftSchema } from '~/schemas/review.schema'

/** Prompt input pair for LLM execution. */
export interface PromptPair {
  system: string
  user: string
}

export { TranslationDraftSchema }
export type { TranslationDraft } from '~/schemas/review.schema'

/**
 * Single-call: expert prompt + self-critique gate in one shot.
 * Replaces the 3-phase analysis → translation → review pipeline.
 */
export function buildSingleCallPrompts(text: string): PromptPair {
  return {
    system: SINGLE_CALL_SYSTEM,
    user: `Translate the following text into natural Vietnamese.
Respond ONLY with valid JSON:
{"sourceLang": "<full English language name>", "translated": "<Vietnamese translation>"}

Text:
${text}`,
  }
}
