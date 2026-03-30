import type { TranslationStyle } from '@chatwork-bot/core'

export interface TranslationStyleProfile {
  id: TranslationStyle
  name: string
  description: string
  userInstruction: string
  systemInstructions: string
}

export const TRANSLATION_STYLE_PROFILES: Record<TranslationStyle, TranslationStyleProfile> = {
  NATURAL_CASUAL: {
    id: 'NATURAL_CASUAL',
    name: 'Natural / Casual',
    description: 'Natural Vietnamese with a casual workplace register.',
    userInstruction: 'Use natural casual Vietnamese for an informal workplace register.',
    systemInstructions: `## Active Style: NATURAL_CASUAL
Target: B2 Vietnamese (CEFR) — conversational workplace register.

Apply the Three-Step Naturalness Process above with Step 3 (Casual workplace register) fully enforced.

Localize technical terms when natural. Keep English only when genuinely used daily.

Avoid:
- Chat-app tone, overfamiliar xưng hô, or performative slang.
- Literal phrasing that mirrors source structure.
- Heavy Hán-Việt when everyday Vietnamese exists.
- Half-English hybrids like "AI detect" or "độ chính xác detect".`,
  },
  PROFESSIONAL_BUSINESS: {
    id: 'PROFESSIONAL_BUSINESS',
    name: 'Professional / Business',
    description: 'Modern professional Vietnamese for clear, polished business communication.',
    userInstruction: 'Use professional Vietnamese for clear internal business prose.',
    systemInstructions: `## Active Style: PROFESSIONAL_BUSINESS
Register: Internal business prose. Clear, modern, respectful.

Do:
- Use calm professional Vietnamese with one clean idea per sentence.
- Keep wording concise, polished, and easy to skim.
- Keep business and technical wording natural for internal communication.

Avoid:
- Bureaucratic phrasing and archaic honorifics.
- Casual particles and casual filler.
- Japanese punctuation artifacts such as （...） or 「...」 in Vietnamese output.
- Sounding like chat messages or terse technical notes.`,
  },
  TECHNICAL: {
    id: 'TECHNICAL',
    name: 'Technical',
    description: 'Precision-first Vietnamese for engineering and technical communication.',
    userInstruction: 'Use precise Vietnamese in a technical register.',
    systemInstructions: `## Active Style: TECHNICAL
Register: Technical prose for docs, reviews, and incident notes.

Do:
- Use short direct sentences in a terse technical register.
- Keep established engineering terms in English when Vietnamese teams normally do: chunk, proxy video, frame rate, object detection, deploy, staging.
- Prefer imperative phrasing for instructions and precise wording for constraints.
- Normalize punctuation into standard Vietnamese or ASCII punctuation.

Avoid:
- Decorative language, emotional tone, and casual particles.
- Business-email cadence and conversational wrap-up phrasing.
- Hybrid phrasing like "detect object" — use the established form "object detection".
- Replacing industry-standard English terminology with awkward Vietnamese.`,
  },
}

export function buildTranslationStyleSection(style: TranslationStyle): string {
  const profile = TRANSLATION_STYLE_PROFILES[style]

  return profile.systemInstructions
}
