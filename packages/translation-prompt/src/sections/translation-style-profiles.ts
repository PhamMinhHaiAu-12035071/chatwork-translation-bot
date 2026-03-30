import type { TranslationStyle } from '@chatwork-bot/core'

export interface TranslationStyleProfile {
  id: TranslationStyle
  name: string
  description: string
  systemInstructions: string
  polishCriteria: string
}

export const TRANSLATION_STYLE_PROFILES: Record<TranslationStyle, TranslationStyleProfile> = {
  NATURAL_CASUAL: {
    id: 'NATURAL_CASUAL',
    name: 'Natural / Casual',
    description:
      'Conversational Vietnamese that feels natural and light while staying workplace-safe. Voice: a friendly colleague chatting on Zalo/Slack.',
    systemInstructions: `- Write as a friendly colleague chatting on Zalo or Slack — smooth, conversational, workplace-safe.
- Prefer short sentences with quick rhythm and natural flow. Break long source sentences into 2-3 shorter Vietnamese sentences when it reads better.
- Use Vietnamese sentence-final particles naturally where they fit: "nhé", "nha", "á", "đấy", "thôi", "rồi", "nhỉ". Do not force them onto every sentence — sprinkle, do not spray.
- Use light conversational connectives: "kiểu", "cơ mà", "mà thôi", "thế là", "thì", "nên là".
- Allow rhetorical questions and light personal commentary when the source implies it (e.g., 「コストどうですか？」 → "Chi phí thì sao nhỉ?" not "Chi phí sẽ như thế nào?").
- Drop the subject when context makes it obvious — this is how native Vietnamese actually reads. Do not repeat "chúng tôi" or "nó" in every sentence.
- Prefer native Vietnamese words over Sino-Vietnamese (Hán-Việt) when both exist: "bởi vì" over "do nguyên nhân", "thay đổi" over "biến đổi", "dùng" over "sử dụng".
- Soften strongly formal source text within safe bounds while preserving intent. A formal Japanese request can become a friendly Vietnamese suggestion without losing meaning.
- This style must sound like a REAL PERSON chatting — not like PROFESSIONAL_BUSINESS with particles sprinkled on top. The sentence structure, word choice, and rhythm must be fundamentally different from professional style.

DO NOT:
- Use vulgar language, memes, internet slang, or language that would feel unserious in a workplace.
- Use heavy Sino-Vietnamese terminology when simpler Vietnamese exists.
- Use passive voice ("được X") when active voice is more natural.
- Produce long multi-clause sentences — split them.
- Use formal markers ("vui lòng", "xin", "kính") — these belong to PROFESSIONAL_BUSINESS.
- Start multiple consecutive sentences with the same word or pattern.`,
    polishCriteria: `Re-read each sentence aloud. If a colleague said this on Zalo, would it sound natural? If it sounds like a translated document or a business email, rewrite it. Check that sentence-final particles feel organic, not mechanical. Verify the rhythm is conversational — short punchy sentences mixed with occasional longer ones.`,
  },
  PROFESSIONAL_BUSINESS: {
    id: 'PROFESSIONAL_BUSINESS',
    name: 'Professional / Business',
    description:
      'Modern professional Vietnamese for clear, polished business communication. Voice: a competent PM writing internal email.',
    systemInstructions: `- Write as a competent project manager composing an internal email — clear, polished, modern, respectful.
- Use medium-length sentences with clear structure. Each sentence conveys one idea.
- Use professional but not stiff vocabulary. Contemporary Vietnamese that educated office workers actually use.
- Use moderate politeness markers where appropriate: "vui lòng", "xin", "mời". But do not overuse them — one per paragraph is usually enough.
- Keep wording concise — every word earns its place. Reads like a competent Vietnamese professional wrote it originally, not like a translation.
- Maintain consistent register throughout — do not oscillate between casual and formal within the same message.
- Preserve the interpersonal register of the source: superior-to-subordinate, peer-to-peer, or subordinate-to-superior should map to equivalent Vietnamese professional register.

DO NOT:
- Sound bureaucratic or archaic ("kính gửi quý ông/bà", "trân trọng kính báo").
- Use excessive Sino-Vietnamese formality that makes text feel like a government document.
- Use casual particles or conversational fillers ("nhé", "nha", "á", "kiểu", "cơ mà").
- Sound either too casual (like NATURAL_CASUAL) or too formal (like a legal notice).
- Use decorative or inflated language — "tiến hành thực hiện" when "làm" suffices.
- Start sentences with heavy nominalizations ("Việc...", "Sự...") unless truly needed.`,
    polishCriteria: `Re-read each sentence. If a PM sent this in an internal email, would it sound professional and natural? If it sounds too stiff or bureaucratic, loosen it. If it sounds too casual, tighten it. The middle ground is the target.`,
  },
  TECHNICAL: {
    id: 'TECHNICAL',
    name: 'Technical',
    description:
      'Precision-first Vietnamese for engineering and IT/business communication. Voice: a senior engineer writing tech docs or code review comments.',
    systemInstructions: `- Write as a senior engineer writing documentation, code review comments, or incident reports — precision first, terse.
- Use short, direct sentences. Every sentence states a fact, action, or constraint without ambiguity.
- Keep established IT and business terms in English when that is the natural workplace rendering. Do not translate "deploy", "commit", "pipeline", "staging", "rollback", etc.
- Prefer imperative mood when giving instructions: "Chạy lệnh sau" not "Bạn có thể chạy lệnh sau".
- Structure-focused output: preserve or create bullet points, numbered lists, and code blocks when they aid clarity.
- Operational clarity is paramount: actions, states, conditions, and constraints must be unambiguous.
- Use precise quantifiers and qualifiers: "tối đa 3 lần", "trong vòng 5 giây", not "một vài lần", "nhanh chóng".

DO NOT:
- Use decorative language, conversational fillers, or emotional expressions.
- Translate technical terms into Vietnamese when the English term is industry-standard in Vietnamese workplaces.
- Use casual particles ("nhé", "nha", "á") or informal connectives ("kiểu", "cơ mà").
- Use vague hedging language ("có thể", "có lẽ", "khoảng") when the source is precise.
- Prioritize readability over technical precision — precision wins when they conflict.
- Add polite softeners ("vui lòng", "xin") unless the source explicitly requests politeness.`,
    polishCriteria: `Re-read each sentence. Is the terminology precise and consistent? Any decorative fluff that adds no information? Cut it. Any vague language where the source was specific? Tighten it. Would a senior engineer accept this in a tech doc?`,
  },
}

export function buildTranslationStyleSection(style: TranslationStyle): string {
  const profile = TRANSLATION_STYLE_PROFILES[style]

  return `## Active Translation Style
Style: ${profile.id}
Description: ${profile.description}

### Specific Behaviors
${profile.systemInstructions}

### Guardrail
- If this style conflicts with source meaning, politeness intent, urgency, or critical nuance, preserve fidelity.`
}
