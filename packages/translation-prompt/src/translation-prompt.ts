import { DEFAULT_TRANSLATION_STYLE } from '@chatwork-bot/core'
import type { TranslationStyle } from '@chatwork-bot/core'
import { SINGLE_CALL_SYSTEM } from '~/sections/single-call'
import { POLISH_SYSTEM, buildPolishStyleSection } from '~/sections/polish'
import { buildTranslationStyleSection } from '~/sections/translation-style-profiles'
import { StructuredTranslationDraftSchema, TranslationDraftSchema } from '~/schemas/review.schema'
import { PolishResultSchema, StructuredPolishResultSchema } from '~/schemas/polish.schema'

/** Prompt input pair for LLM execution. */
export interface PromptPair {
  system: string
  user: string
}

export { TranslationDraftSchema }
export { StructuredTranslationDraftSchema }
export { PolishResultSchema }
export { StructuredPolishResultSchema }
export type { StructuredTranslationDraft, TranslationDraft } from '~/schemas/review.schema'
export type { PolishResult, StructuredPolishResult } from '~/schemas/polish.schema'

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

/**
 * Step 2 — Polish: refine draft with source visible.
 */
export function buildPolishPrompts(
  sourceText: string,
  draftTranslation: string,
  style: TranslationStyle = DEFAULT_TRANSLATION_STYLE,
): PromptPair {
  return {
    system: [POLISH_SYSTEM, buildPolishStyleSection(style)].join('\n\n'),
    user: `Here is a draft translation that needs polishing.

Original text:
${sourceText}

Draft translation:
${draftTranslation}

Polish the translation so it reads naturally as original Vietnamese text.
Respond ONLY with valid JSON:
{"translated": "<polished Vietnamese translation>"}`,
  }
}

export function buildStructuredPolishPrompts(
  sourceSegments: string[],
  draftSegments: string[],
  style: TranslationStyle = DEFAULT_TRANSLATION_STYLE,
): PromptPair {
  return {
    system: [POLISH_SYSTEM, buildPolishStyleSection(style)].join('\n\n'),
    user: `Here are draft translations that need polishing.

Original segments:
${JSON.stringify(sourceSegments, null, 2)}

Draft translations:
${JSON.stringify(draftSegments, null, 2)}

Polish each translation so it reads naturally as original Vietnamese text.
Preserve array length and order exactly.
Respond ONLY with valid JSON:
{"translatedSegments": ["<polished segment 1>", "<polished segment 2>"]}`,
  }
}
