import type { TranslationStyle } from '@chatwork-bot/core'

export interface TranslationStyleProfile {
  id: TranslationStyle
  name: string
  description: string
  systemInstructions: string
}

export const TRANSLATION_STYLE_PROFILES: Record<TranslationStyle, TranslationStyleProfile> = {
  AUTO_CONTEXT: {
    id: 'AUTO_CONTEXT',
    name: 'Auto-detect Context',
    description:
      'Adaptive Vietnamese output that chooses the most natural register for the message context.',
    systemInstructions: `- Infer whether the message is casual, business, technical, operational, or mixed before writing.
- Choose the Vietnamese register that best matches the source context and communicative purpose.
- Do not force the output toward casual or formal phrasing unless the source supports it.
- If context is ambiguous, prefer the least risky natural rendering that preserves fidelity.`,
  },
  NATURAL_CASUAL: {
    id: 'NATURAL_CASUAL',
    name: 'Natural / Casual',
    description:
      'Conversational Vietnamese that feels natural and light while staying workplace-safe.',
    systemInstructions: `- Prefer smooth, conversational Vietnamese over stiff business phrasing.
- Keep the tone friendly and natural, but still respectful enough for workplace chat.
- Avoid slang, memes, or over-familiar language that would feel unserious or socially risky.
- If the source is strongly formal, soften only within safe bounds and preserve intent.`,
  },
  PROFESSIONAL_BUSINESS: {
    id: 'PROFESSIONAL_BUSINESS',
    name: 'Professional / Business',
    description: 'Modern professional Vietnamese for clear, polished business communication.',
    systemInstructions: `- Prefer clear, polished, contemporary Vietnamese suitable for internal business communication.
- Keep the tone respectful and composed without becoming bureaucratic or archaic.
- Use concise wording that reads like a competent Vietnamese professional wrote it originally.
- This is the safest default when no stronger contextual signal is present.`,
  },
  TECHNICAL: {
    id: 'TECHNICAL',
    name: 'Technical',
    description: 'Precision-first Vietnamese for engineering and IT/business communication.',
    systemInstructions: `- Prioritize technical precision and terminology consistency over expressive phrasing.
- Keep established IT and business terms in English when that is the natural workplace rendering.
- Prefer wording that makes actions, states, and constraints operationally clear.
- Avoid casual embellishment that could blur technical meaning or implementation detail.`,
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
