export const HUMANIZER = `## Vietnamese Natural Language Rules

### DO — Native Vietnamese patterns
- Vary sentence length naturally: mix short punchy sentences with occasional longer ones. Monotonous length is a machine-translation signal.
- Prefer active voice over passive. Vietnamese reads more naturally in active voice in most contexts.
- Use natural Vietnamese connectives: "vì vậy", "do đó", "đồng thời", "mặt khác", "tuy nhiên", "nhờ đó", "thế nên".
- Use rhetorical questions when the source implies wondering or musing (e.g., 「コストどうですか？」→ "Chi phí thì sao nhỉ?" — not "Chi phí sẽ như thế nào?").
- Use elliptical sentences — drop the subject when context makes it obvious. Native Vietnamese writing omits repeated subjects naturally.
- Prefer native Vietnamese words over Sino-Vietnamese (Hán-Việt) when both exist and the simpler form is equally clear: "dùng" > "sử dụng", "thay đổi" > "biến đổi", "bởi vì" > "do nguyên nhân", "giúp" > "hỗ trợ".
- Reflow long source sentences into 2-3 shorter Vietnamese sentences when that reads more naturally. Vietnamese prose favors shorter sentences than Japanese.
- Use sentence-final particles naturally per style: "thôi", "nhỉ", "rồi", "đấy", "nha", "nhé" — but only where they fit organically.
- Direct, specific phrasing — no inflated or decorative language.

### DO NOT — Machine-translation signals (eliminate ALL of these)
- Starting every sentence with filler openers: "Trong đó", "Bao gồm", "Ngoài ra", "Cũng như", "Đồng thời" when they add no meaning.
- Pattern "không chỉ... mà còn..." — overused AI cliché. Restructure the sentence instead.
- Heavy Hán-Việt terminology where simpler modern Vietnamese exists. "Tiến hành thực hiện" → "làm". "Đảm bảo rằng" → "để".
- Passive constructions ("được X", "bị X") when active voice is more natural in Vietnamese.
- Mirroring source language sentence structure instead of using natural Vietnamese word order.
- "Việc..." opening sentences unnecessarily — gratuitous nominalization. "Việc thay đổi này" → "Thay đổi này".
- "Một cách [adj]" pattern — calque from English "-ly" adverb. "Một cách nhanh chóng" → "nhanh".
- Repeating the subject in every sentence when Vietnamese naturally omits it after first mention.
- Word-by-word translation of idioms instead of using Vietnamese equivalents or natural paraphrasing.
- Excessive "Sự" + verb nominalization: "sự thay đổi" when "thay đổi" alone works.
- Starting multiple consecutive sentences with the same word or pattern — vary the openings.
- Over-hedging with "có thể" when the source is definitive.
- Inserting "của" (possession marker) between every noun pair when Vietnamese allows juxtaposition.`

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
