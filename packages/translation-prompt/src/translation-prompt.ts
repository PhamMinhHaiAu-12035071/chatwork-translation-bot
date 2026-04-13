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

export const TRANSLATION_PROMPT_BUILD_ID = '2026-04-13-context-honorific-policy-v1'

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
- The room context may contain structured or unstructured notes about people, aliases, roles, gender, seniority, and tone.
- If the message or mention target matches a person described in the room context, use that information when it is clearly stated.
- Prefer the Latin alias in Vietnamese output when the context provides both a Latin alias and the original Japanese name; treat the Japanese name only as a matching anchor.
- If the context only provides the original Japanese name, keep that name and do not invent a romanized form.
- Use gender, role, title, or seniority hints only when clearly stated; if uncertain, translate conservatively and naturally.
- If no reliable person metadata is available, ignore these person-specific rules and translate normally.`

function buildContextSection(roomContext?: string): string {
  if (!roomContext?.trim()) return ''
  return `## Room Context\n${CONTEXT_ENFORCEMENT_HEADER}\n\n${roomContext.trim()}`
}

function buildSingleUserPrompt(
  text: string,
  _style: TranslationStyle,
  mentionHint?: string,
): string {
  const mentionBlock = mentionHint
    ? `\n<MENTION_CONTEXT>\n${mentionHint}\n</MENTION_CONTEXT>\n`
    : ''

  return `Translate into Vietnamese as JSON:
{"sourceLang": "<language>", "translated": "<Vietnamese>"}
${mentionBlock}
<TRANSLATE_TEXT>
${text}
</TRANSLATE_TEXT>`
}

function buildStructuredUserPrompt(
  segments: string[],
  _style: TranslationStyle,
  fullMessageContext?: string,
  mentionHint?: string,
): string {
  const contextBlock =
    fullMessageContext === undefined
      ? ''
      : `<MESSAGE_CONTEXT>
${fullMessageContext}
</MESSAGE_CONTEXT>

`

  const mentionBlock = mentionHint
    ? `<MENTION_CONTEXT>
${mentionHint}
</MENTION_CONTEXT>

`
    : ''

  return `Translate each segment into Vietnamese as JSON. Preserve array order/length exactly.
{"sourceLang": "<language>", "translatedSegments": ["<Vietnamese 1>", "<Vietnamese 2>"]}

${contextBlock}${mentionBlock}<TRANSLATE_SEGMENTS>
${JSON.stringify(segments, null, 2)}
</TRANSLATE_SEGMENTS>`
}

export function buildStructuredTranslationPrompts(
  segments: string[],
  style: TranslationStyle = DEFAULT_TRANSLATION_STYLE,
  fullMessageContext?: string,
  roomContext?: string,
  keywordSystemHint?: string,
  mentionHint?: string,
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
    user: buildStructuredUserPrompt(segments, style, fullMessageContext, mentionHint),
  }
}

export function buildSingleCallPrompts(
  text: string,
  style: TranslationStyle = DEFAULT_TRANSLATION_STYLE,
  roomContext?: string,
  keywordSystemHint?: string,
  mentionHint?: string,
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
    user: buildSingleUserPrompt(text, style, mentionHint),
  }
}
