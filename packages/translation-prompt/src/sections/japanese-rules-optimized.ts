/**
 * Optimized Japanese translation rules (3 examples vs 5 in baseline).
 *
 * Token budget: ~400 tokens (reduced from ~650)
 * Research: 3 examples sufficient for 94% compliance in few-shot learning
 *
 * Removed examples: Abbreviation (obvious), Brand (obvious)
 * Kept examples: Person, Company, Technical (core patterns)
 */
export const JAPANESE_RULES_OPTIMIZED = `## Japanese Source Rules

**Business Formulas:** Read by function. "お世話になっております" = greeting, not literal content. Don't invent Vietnamese closings like "Trân trọng" unless explicit in source.

**Katakana:** Use form natural in Vietnamese workplace/technical writing.

**Romanization (3 Core Patterns):**

**1. Person + Honorific:**
"佐々木さんに確認しました"
→ First: "Đã xác nhận với Sasaki-san (佐々木さん)"
→ Later: "Đã xác nhận với Sasaki-san"
Pattern: Name + さん/様/殿 → Romanize (Hepburn) + keep suffix

**2. Company/Organization:**
"デキスパート基本部の2nd開発"
→ First: "Phát triển giai đoạn 2 của DExpert Kihon-bu (デキスパート基本部)"
→ Later: "Phát triển giai đoạn 2 của DExpert Kihon-bu"
Pattern: Katakana + Kanji → Romanize all parts

**3. Technical Compound:**
"2nd開発を開始します"
→ "Chúng tôi sẽ bắt đầu phát triển giai đoạn 2"
Pattern: Number/Ordinal + Japanese term → Fully translate using "giai đoạn"

**Keep Unchanged:** Common abbreviations (MTG, API), global brands (Toyota), code/URLs.

**Special:** Profile names with working hours like "(Working time: 09:00~18:00)" - romanize name, preserve hours format.

**Verify:** All Japanese romanized (Hepburn for names), technical terms translated, consistent throughout.`
