/**
 * Language-specific translation rules.
 *
 * This file re-exports rules from dedicated files to maintain a clean API boundary.
 */
export { JAPANESE_RULES } from './japanese-rules'

export const ENGLISH_RULES = `## English Source Rules
- Treat English as a first-class workplace source, not as a fallback to Japanese-specific rules.
- Resolve hedging such as "Could you", "Just checking", "Hope you're well", and "I wanted to follow up" by communicative intent.
- Avoid bookish or syntax-mirroring Vietnamese when English is indirect, polite, or terse.
- Keep short task-oriented English concise in Vietnamese workplace writing.`
