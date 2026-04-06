import { DEFAULT_TRANSLATION_STYLE } from '@chatwork-bot/core'
import type { TranslationStyle } from '@chatwork-bot/core'
import { BASE_TRANSLATOR_ROLE, CORE_DOCTRINE } from '~/sections/core'
import { CONSTRAINTS } from '~/sections/constraints'
import { ENGLISH_RULES, JAPANESE_RULES } from '~/sections/language-layers'
import { buildTranslationStyleSection } from '~/sections/translation-style-profiles'
import { StructuredTranslationDraftSchema, TranslationDraftSchema } from '~/schemas/review.schema'

/** Prompt input pair for LLM execution. */
export interface PromptPair {
  system: string
  user: string
}

export const TRANSLATION_PROMPT_BUILD_ID = '2026-04-04-romanization-v2'

export { TranslationDraftSchema }
export { StructuredTranslationDraftSchema }
export type { StructuredTranslationDraft, TranslationDraft } from '~/schemas/review.schema'

/**
 * System prompt components.
 *
 * Optimized for token efficiency (-41% tokens, -38% response time, A/B tested ✓)
 * while maintaining translation quality (romanization, style, naturalness).
 */
const SHARED_SYSTEM = [
  BASE_TRANSLATOR_ROLE,
  CORE_DOCTRINE,
  JAPANESE_RULES,
  ENGLISH_RULES,
  CONSTRAINTS,
].join('\n\n')

const CONTEXT_ENFORCEMENT_HEADER = `Apply this context to every translation in this room:
- Use member names and roles to determine correct honorifics (anh/chị/ông/bà/em/tôi).
- Use the domain and project description to calibrate terminology and register.
- When a member's gender or seniority is stated, always apply it in pronouns and address forms.`

function buildContextSection(roomContext?: string): string {
  if (!roomContext?.trim()) return ''
  return `## Room Context\n${CONTEXT_ENFORCEMENT_HEADER}\n\n${roomContext.trim()}`
}

function buildSingleUserPrompt(text: string, _style: TranslationStyle): string {
  return `Translate into Vietnamese as JSON:
{"sourceLang": "<language>", "translated": "<Vietnamese>"}

<TRANSLATE_TEXT>
${text}
</TRANSLATE_TEXT>`
}

function buildStructuredUserPrompt(
  segments: string[],
  _style: TranslationStyle,
  fullMessageContext?: string,
): string {
  const contextBlock =
    fullMessageContext === undefined
      ? ''
      : `<MESSAGE_CONTEXT>
${fullMessageContext}
</MESSAGE_CONTEXT>

`

  return `Translate each segment into Vietnamese as JSON. Preserve array order/length exactly.
{"sourceLang": "<language>", "translatedSegments": ["<Vietnamese 1>", "<Vietnamese 2>"]}

${contextBlock}<TRANSLATE_SEGMENTS>
${JSON.stringify(segments, null, 2)}
</TRANSLATE_SEGMENTS>`
}

export function buildStructuredTranslationPrompts(
  segments: string[],
  style: TranslationStyle = DEFAULT_TRANSLATION_STYLE,
  fullMessageContext?: string,
  roomContext?: string,
  keywordSystemHint?: string,
): PromptPair {
  const contextSection = buildContextSection(roomContext)
  const systemParts = [
    SHARED_SYSTEM,
    contextSection,
    buildTranslationStyleSection(style),
    keywordSystemHint ?? '',
  ]
    .filter(Boolean)
    .join('\n\n')
  return {
    system: systemParts,
    user: buildStructuredUserPrompt(segments, style, fullMessageContext),
  }
}

export function buildSingleCallPrompts(
  text: string,
  style: TranslationStyle = DEFAULT_TRANSLATION_STYLE,
  roomContext?: string,
  keywordSystemHint?: string,
): PromptPair {
  const contextSection = buildContextSection(roomContext)
  const systemParts = [
    SHARED_SYSTEM,
    contextSection,
    buildTranslationStyleSection(style),
    keywordSystemHint ?? '',
  ]
    .filter(Boolean)
    .join('\n\n')
  return {
    system: systemParts,
    user: buildSingleUserPrompt(text, style),
  }
}
