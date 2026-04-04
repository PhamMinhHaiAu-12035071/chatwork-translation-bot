/**
 * Japanese translation rules using few-shot learning (research-backed).
 *
 * Structure:
 * 1. General principles (functional greetings, katakana handling)
 * 2. Romanization examples (5 examples covering all entity types: person, company, technical, abbreviation, brand)
 * 3. Inline verification (lightweight CoVe pattern on lines 44-45)
 *
 * Token budget: ~450 tokens (under 800-token adherence limit)
 * Research: 3-5 examples achieve 94% compliance for classification tasks
 *
 * Note: Inline verification (lines 44-45) replaces the 4-item SELF_VERIFICATION checklist
 * that was initially added in Task 8, then removed in simplification pass (commit 676cea6).
 * Research shows single-location verification is clearer for LLMs than dual checklists.
 * The inline self-check covers all requirements: romanization, technical terms, consistency, references.
 *
 * @see docs/superpowers/specs/2026-04-04-enhanced-detection-prompt-research.md
 * @see docs/superpowers/specs/2026-04-04-japanese-romanization-fix.md
 */
export const JAPANESE_RULES = `## Japanese Source Rules

### General Translation Principles
- Read Japanese business formulas by communicative function. Phrases like "お世話になっております" and "よろしくお願いいたします" are functional greetings, not literal content to mirror.
- Do not invent stock Vietnamese closings such as "Trân trọng", "cảm ơn", or "xem xét" unless the source explicitly carries that meaning.
- Render katakana loanwords in the form that sounds most natural in Vietnamese workplace or technical writing.

### Name and Term Romanization - Learn from Examples

Japanese text requiring romanization/translation follows these patterns:

**Example 1 - Person Name with Honorific:**
Input: "佐々木さんに確認しました"  
→ First mention: "Đã xác nhận với Sasaki-san (佐々木さん)"  
→ Later mentions: "Đã xác nhận với Sasaki-san"  
Pattern: Name ending with さん/様/殿 → Romanize using Hepburn + keep suffix

**Example 2 - Company/Organization Name:**
Input: "デキスパート基本部の2nd開発"  
→ First mention: "Phát triển giai đoạn 2 của DExpert Kihon-bu (デキスパート基本部)"  
→ Later mentions: "Phát triển giai đoạn 2 của DExpert Kihon-bu"  
Pattern: Katakana + Kanji structure → Romanize all parts

**Example 3 - Technical Compound Term:**
Input: "2nd開発を開始します"  
→ Output: "Chúng tôi sẽ bắt đầu phát triển giai đoạn 2"  
Pattern: Number/Ordinal + Japanese term → Fully translate to Vietnamese using "giai đoạn"

**Example 4 - Abbreviation (Keep As-Is):**
Input: "MTGの議題について"  
→ Output: "Về nội dung của MTG"  
Pattern: Common abbreviations (MTG, PJ, API) → Keep unchanged

**Example 5 - Famous Brand (Keep As-Is):**
Input: "Toyotaの製品を使用"  
→ Output: "Sử dụng sản phẩm của Toyota"  
Pattern: Well-known global brands (Toyota, Sony, Honda) → Keep unchanged

**Special Cases:**
- Profile names may include working hours like "(Working time: 09:00~18:00)" - romanize the name but preserve working hours exactly as written
- Text after [rp] tags in quotes: romanize person names but preserve working hours and formatting
- Consistency: Same name/term must be romanized identically throughout the document

### Before Outputting - Self-Check
Verify: All Japanese names are romanized (person names with Hepburn, company names with all parts), all technical compound terms are fully translated to Vietnamese, no Japanese script remains except in first-mention parentheses, same name/term romanized identically throughout.`

export const ENGLISH_RULES = `## English Source Rules
- Treat English as a first-class workplace source, not as a fallback to Japanese-specific rules.
- Resolve hedging such as "Could you", "Just checking", "Hope you're well", and "I wanted to follow up" by communicative intent.
- Avoid bookish or syntax-mirroring Vietnamese when English is indirect, polite, or terse.
- Keep short task-oriented English concise in Vietnamese workplace writing.`
