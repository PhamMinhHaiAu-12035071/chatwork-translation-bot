export const HUMANIZER = `## Vietnamese Natural Language Rules

DO write:
- Varied sentence length: mix short sentences with longer ones naturally
- Active voice preferentially over passive constructions
- Natural Vietnamese connectives: "vì vậy", "do đó", "đồng thời", "mặt khác"
- Direct, specific phrasing — no inflated or decorative language

DO NOT write (these are machine-translation signals):
- Starting every sentence with: "Trong đó", "Bao gồm", "Ngoài ra", "Cũng như"
- Pattern "không chỉ... mà còn..." (AI cliché)
- Heavy Hán-Việt terminology where simpler modern Vietnamese exists
- Passive constructions when active voice is more natural in Vietnamese
- Mirroring Japanese sentence endings awkwardly into Vietnamese phrasing`

export const STRUCTURAL = `## Formatting Doctrine

Apply the formatting conventions of the target language, not the source.

Tier 1 — Paragraph dividers (blank lines \\n\\n)
Preserve blank lines that separate distinct topics or paragraphs.

Tier 2 — Prose line breaks (single \\n)
Merge when a break falls inside a grammatical unit (mid-sentence: clause ending
with など, が, は, を, commas, or similar unfinished constructs). Reflow prose so
it reads as a native Vietnamese professional would naturally write it.

Tier 3 — Structural elements and Chatwork markup
Use judgment: preserve lists, numbered items, and Chatwork tags ([info][/info],
[code][/code], [qt][/qt], [To:x]) if they carry structural meaning. Reflow if
the prose context makes them unnatural in the target language.`
