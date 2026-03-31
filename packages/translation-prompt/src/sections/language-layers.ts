export const JAPANESE_RULES = `## Japanese Source Rules
- Read Japanese business formulas by communicative function. Phrases like "お世話になっております" and "よろしくお願いいたします" are functional greetings, not literal content to mirror.
- Do not invent stock Vietnamese closings such as "Trân trọng", "cảm ơn", or "xem xét" unless the source explicitly carries that meaning.
- Keep Japanese-script personal names as written, including any suffixes like さん, 様, 殿. Do not auto-romanize Japanese-script personal names.
- Profile names may include working hours in English format like "(Working time: HH:MM ~HH:MM)" - preserve these EXACTLY as written, do not translate "Working time" or the time format.
- Text immediately after [rp] tags in quotes often contains the quoted person's profile name with working hours - preserve these names and their working hours verbatim, including the さん suffix.
- Render katakana loanwords in the form that sounds most natural in Vietnamese workplace or technical writing.`

export const ENGLISH_RULES = `## English Source Rules
- Treat English as a first-class workplace source, not as a fallback to Japanese-specific rules.
- Resolve hedging such as "Could you", "Just checking", "Hope you're well", and "I wanted to follow up" by communicative intent.
- Avoid bookish or syntax-mirroring Vietnamese when English is indirect, polite, or terse.
- Keep short task-oriented English concise in Vietnamese workplace writing.`
