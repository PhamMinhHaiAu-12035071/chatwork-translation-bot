import type { PromptPair } from '@chatwork-bot/core'

// ─────────────────────────────────────────────────────────────────────────────
// Schemas (imported from separate files)
// ─────────────────────────────────────────────────────────────────────────────

export {
  AnalysisSchema,
  type AnalysisResult,
} from './schemas/analysis.schema'
export {
  ReviewSchema,
  TranslationDraftSchema,
  type ReviewResult,
  type TranslationDraft,
} from './schemas/review.schema'
export {
  PipelineTraceSchema,
  type PipelineTrace,
} from './schemas/pipeline-trace.schema'

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builders (imported from sections)
// ─────────────────────────────────────────────────────────────────────────────

export { buildAnalysisPrompts } from './sections/analysis'
export { buildReviewPrompts } from './sections/review'

// ─────────────────────────────────────────────────────────────────────────────
// Translation prompt builder (Phase 2)
// ─────────────────────────────────────────────────────────────────────────────

import { PERSONA, CORE_DOCTRINE } from './sections/core'
import { JAPANESE_RULES } from './sections/language-layers'
import { HUMANIZER, STRUCTURAL } from './sections/humanizer'
import { CONSTRAINTS } from './sections/constraints'
import type { AnalysisResult } from './schemas/analysis.schema'

const TRANSLATION_SYSTEM = [
  PERSONA,
  CORE_DOCTRINE,
  JAPANESE_RULES,
  HUMANIZER,
  STRUCTURAL,
  CONSTRAINTS,
].join('\n\n')

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

  return {
    system: TRANSLATION_SYSTEM,
    user: `${analysisContext}

Translate the following text into natural Vietnamese.
Respond ONLY with valid JSON:
{"sourceLang": "<full English language name>", "translated": "<Vietnamese translation>"}

Text:
${text}`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy API for backward compatibility
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod'

export const TranslationSchema = z.object({
  sourceLang: z
    .string()
    .min(2)
    .max(50)
    .describe(
      "Full language name in English, e.g. 'Japanese', 'Vietnamese', 'Traditional Chinese'",
    ),
  translated: z.string().min(1),
})

export type TranslationOutput = z.infer<typeof TranslationSchema>

interface PromptSection {
  id: string
  content: string
}

const SECTION_PERSONA: PromptSection = {
  id: 'persona',
  content: PERSONA,
}

const SECTION_CORE_DOCTRINE: PromptSection = {
  id: 'core-doctrine',
  content: CORE_DOCTRINE,
}

const SECTION_JAPANESE_RULES: PromptSection = {
  id: 'japanese-rules',
  content: JAPANESE_RULES,
}

const SECTION_HUMANIZER: PromptSection = {
  id: 'humanizer',
  content: HUMANIZER,
}

const SECTION_STRUCTURAL: PromptSection = {
  id: 'structural',
  content: STRUCTURAL,
}

const SECTION_CONSTRAINTS: PromptSection = {
  id: 'constraints',
  content: CONSTRAINTS,
}

const PROMPT_SECTIONS: readonly PromptSection[] = [
  SECTION_PERSONA,
  SECTION_CORE_DOCTRINE,
  SECTION_JAPANESE_RULES,
  SECTION_HUMANIZER,
  SECTION_STRUCTURAL,
  SECTION_CONSTRAINTS,
] as const

/**
 * Legacy: Returns the system-level prompt.
 */
export function buildSystemPrompt(sections: readonly PromptSection[] = PROMPT_SECTIONS): string {
  return sections.map((s) => s.content).join('\n\n')
}

/**
 * Legacy: Returns the user-level prompt with the text to translate.
 */
export function buildUserPrompt(text: string): string {
  return `Translate the text below into natural Vietnamese.
Respond ONLY with valid JSON. No markdown, no code block, no explanation.

Required format: {"sourceLang": "<full English language name>", "translated": "<Vietnamese translation>"}

Quality examples:
Input: 「お世話になっております。リリースの件でご確認をお願いしたくご連絡いたしました。」
Output: {"sourceLang":"Japanese","translated":"Kính gửi anh/chị,\\nTôi xin phép liên lạc để nhờ xác nhận về release trước đó."}

Input: "The deploy is scheduled for Monday. Please make sure staging is ready."
Output: {"sourceLang":"English","translated":"Deploy được lên kế hoạch vào thứ Hai. Nhờ anh/chị đảm bảo staging đã sẵn sàng nhé."}

Input: "実装してみてテストが荒くなるようでしたらあちらに引き継ぎしちゃうなど\\nそのあたりは柔軟に相談できると思います。"
Output: {"sourceLang":"Japanese","translated":"Nếu lúc implement thử mà thấy phần test có vẻ phức tạp thì mình cứ bàn giao lại cho bên đó chẳng hạn, mấy vấn đề đó mình nghĩ có thể trao đổi linh hoạt được."}

Text:
${text}`
}

/**
 * Legacy: Combines system and user prompts into a single string.
 */
export function buildTranslationPrompt(text: string): string {
  return `${buildSystemPrompt()}\n\n${buildUserPrompt(text)}`
}
