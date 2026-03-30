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
    userInstruction: 'Use the natural-casual workplace style.',
    systemInstructions: `## Active Style: NATURAL_CASUAL
- Highest paraphrase budget.
- Most native-feeling Vietnamese for conversational workplace messages.
- Keep English only when it is truly everyday workplace or tech speech.
- Prefer no pronoun over guessed hierarchy.
- Use light particles only when local context supports them, especially in local requests or questions.

Avoid:
- Chat-app slang, overfamiliar xưng hô, and performative filler.
- Half-English hybrids or literal phrasing that still sounds translated.
- Warmth markers that require guessing gender, rank, or relationship.`,
  },
  PROFESSIONAL_BUSINESS: {
    id: 'PROFESSIONAL_BUSINESS',
    name: 'Professional / Business',
    description: 'Modern professional Vietnamese for clear, polished business communication.',
    userInstruction: 'Use the professional-business workplace style.',
    systemInstructions: `## Active Style: PROFESSIONAL_BUSINESS
- Stable default workplace style.
- Modern, respectful, concise internal business prose.
- Medium paraphrase budget with clean sentence rhythm.
- Keep business and technical wording natural without sounding casual.

Avoid:
- Bureaucratic phrasing, archaic honorifics, and casual filler.
- Casual particles by default.
- Japanese punctuation artifacts such as （...） or 「...」 in Vietnamese output.
- Sounding like chat messages or terse technical notes.`,
  },
  TECHNICAL: {
    id: 'TECHNICAL',
    name: 'Technical',
    description: 'Precision-first Vietnamese for engineering and technical communication.',
    userInstruction: 'Use the technical workplace style.',
    systemInstructions: `## Active Style: TECHNICAL
- Lowest paraphrase budget.
- Preserve technical force and industry-standard English where Vietnamese teams normally use it.
- Use short direct sentences in a technical prose register.
- Prefer imperative phrasing for constraints, instructions, and incident notes.

Avoid:
- Decorative language, emotional wrap-up, and casual particles.
- Business-email cadence.
- Hybrid technical phrasing such as "detect object".
- Replacing established English terminology with awkward Vietnamese.`,
  },
}

export function buildTranslationStyleSection(style: TranslationStyle): string {
  const profile = TRANSLATION_STYLE_PROFILES[style]

  return profile.systemInstructions
}
