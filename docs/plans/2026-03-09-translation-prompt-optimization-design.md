# Design: Translation Prompt Optimization

**Date:** 2026-03-09
**Package:** `@chatwork-bot/translation-prompt`
**File:** `packages/translation-prompt/src/translation-prompt.ts`
**Status:** Approved, ready for implementation

---

## Problem Statement

The current `buildTranslationPrompt(text)` returns a single string with a minimal prompt that produces machine-translation-like output, especially for Japanese → Vietnamese. Specific issues identified:

1. **Câu văn cứng nhắc** — output sounds like machine translation, not natural Vietnamese
2. **Mất sắc thái văn hóa Nhật** — keigo (Japanese politeness system) not mapped to Vietnamese equivalents
3. **Sai mức độ trang trọng** — formality levels flattened or misrepresented
4. **IT/Business terms translated** — terms like "project", "release", "deploy" incorrectly translated to Vietnamese when they should stay in English

---

## Design Goals

- Produce Vietnamese output indistinguishable from native professional writing
- Explicitly map Japanese keigo 3 levels to Vietnamese politeness equivalents
- Keep international IT/business terms in English
- Preserve line breaks exactly (critical for Chatwork formatting)
- Enforce JSON-only output reliably
- Maintain Clean Code / SOLID / pure function architecture
- Enable easy addition/removal of rules without touching function signatures

---

## Architecture Decision

### Selected: PromptSection Interface + Registry (SOLID + Extensible)

```typescript
interface PromptSection {
  id: string
  content: string
}

const PROMPT_SECTIONS: readonly PromptSection[] = [
  { id: 'persona', content: SECTION_PERSONA },
  { id: 'core-doctrine', content: SECTION_CORE_DOCTRINE },
  { id: 'japanese-rules', content: SECTION_JAPANESE_RULES },
  { id: 'humanizer', content: SECTION_HUMANIZER },
  { id: 'structural', content: SECTION_STRUCTURAL },
  { id: 'constraints', content: SECTION_CONSTRAINTS },
] as const

// 3 pure functions — no side effects
export function buildSystemPrompt(sections?: readonly PromptSection[]): string
export function buildUserPrompt(text: string): string
export function buildTranslationPrompt(text: string): string // backward compat
```

**Rationale:**

- Single Responsibility: each function/section does one thing
- Open/Closed: add sections without changing functions
- Pure functions: no side effects, easy to test and mock
- Backward compatible: `buildTranslationPrompt` preserved for existing providers
- Testable: can test individual sections by passing a subset

### Rejected alternatives

| Option                 | Why rejected                                     |
| ---------------------- | ------------------------------------------------ |
| Enhanced monolith      | Violates Single Responsibility, hard to maintain |
| Multi-file sections    | Over-engineering for current section count       |
| Split system+user only | Less extensible than full registry pattern       |

---

## Prompt Design

### Frameworks Applied

- **TCREI** (Google Prompting Essentials): Task, Context, References, Evaluate, Iterate
- **Lyra Revolutionary**: Chain-of-Thought, Few-Shot anchoring, Self-verification loop
- **Humanizer techniques**: Constraint-based naturalness (remove AI patterns)
- **Research insights**: Blader Humanizer 24 AI patterns, sabrina.dev banned words

### Section Registry

#### `SECTION_PERSONA` — WHO (TCREI: Task/Role)

```
You are an elite professional translator with over 20 years of specialized
experience in Japanese-to-Vietnamese and multilingual corporate communication.
You possess deep expertise in:
- Japanese linguistics including all three levels of keigo (敬語)
- Vietnamese modern business writing and idiomatic expression
- Cross-cultural corporate communication in East Asian contexts
- IT, technology, and business terminology

Your translations are indistinguishable from text written by a native
Vietnamese professional in a modern tech company. You reconstruct meaning
in its new cultural-linguistic context — you do not merely convert words.
```

#### `SECTION_CORE_DOCTRINE` — WHAT/HOW (TCREI: Context + quality standards)

```
## Core Translation Doctrine

1. Natural Vietnamese First
Every sentence must read as if written originally by a Vietnamese professional.
Never mirror source sentence structure. If Vietnamese grammar demands a different
order, use it.

2. Modern Professional Tone
Write as educated Vietnamese office workers communicate: polished and respectful,
but not stiff or bureaucratic. Use contemporary Vietnamese, not textbook forms.

3. Cultural Fidelity
Preserve the communicative intent and interpersonal register (superior/peer/
subordinate) of the original. Capture implied courtesy and culturally encoded meaning.

4. Preserve Meaning Precisely
Do not add, remove, soften, or amplify meaning.
Direct → direct. Apologetic → apologetic. Urgent → urgent.
```

#### `SECTION_JAPANESE_RULES` — DOMAIN (Japanese-specific mapping)

```
## Japanese-Specific Rules

### Keigo Register Mapping (Critical)
Preserve the politeness level — do NOT flatten or elevate:

| Japanese Level      | Example pattern      | Vietnamese Equivalent               |
|---------------------|----------------------|-------------------------------------|
| Teineigo (丁寧語)   | です/ます            | "vui lòng", "cảm ơn", "xin"        |
| Sonkeigo (尊敬語)   | ご〜いただく         | "kính gửi", "trân trọng", "xin phép"|
| Kenjōgo (謙譲語)    | させていただく       | "xin được", "cho phép tôi"          |
| Kudaketa (くだけた) | だ/だよ              | casual Vietnamese, no excess form   |

### IT/Business International Terms — KEEP IN ENGLISH
These are standard in Vietnamese tech workplaces. Do NOT translate:
project, release, sprint, deploy, staging, production, deadline, milestone,
review, update, report, task, issue, bug, fix, PR, merge, branch, commit,
schedule, meeting, agenda, feedback, team, manager, lead, backlog, ticket,
pipeline, onboarding, offboarding, dashboard

### Proper Nouns & Names
- Company names, product names, people's names: keep in original form
- Katakana loanwords from English: use the original English word
  プロジェクト → project | リリース → release | ミーティング → meeting | デプロイ → deploy

### Japanese Formatting Conventions
- ※ (annotation marker) → "Lưu ý:"
- 「」 (Japanese quotation marks) → Vietnamese double quotes " "
- ・ (bullet point) → "-"
- よろしくお願いいたします → "Trân trọng cảm ơn" or "Mong nhận được sự hợp tác"
```

#### `SECTION_HUMANIZER` — NATURALNESS (anti-machine-translation patterns)

```
## Vietnamese Natural Language Rules

DO write:
- Varied sentence length: mix short sentences with longer ones naturally
- Active voice preferentially over passive constructions
- Natural Vietnamese connectives: "vì vậy", "do đó", "đồng thời", "mặt khác"
- Direct, specific phrasing — no inflated or decorative language

DO NOT write (machine-translation signals):
- Starting every sentence with: "Trong đó", "Bao gồm", "Ngoài ra", "Cũng như"
- Pattern "không chỉ... mà còn..." (AI cliché)
- Heavy Hán-Việt where simpler modern Vietnamese exists
- Passive constructions when active is more natural in Vietnamese
- Mirroring Japanese sentence endings awkwardly into Vietnamese

### Self-Verification (internal, before output)
Silently verify all 4 conditions before finalizing:
1. ✓ Natural Vietnamese — would a native professional write it exactly this way?
2. ✓ Register preserved — politeness level correctly mapped?
3. ✓ IT terms in English — no translated tech jargon?
4. ✓ Line breaks identical — every \n matches source exactly?
```

#### `SECTION_STRUCTURAL` — FORMAT

```
## Structural Rules

Line Breaks — Preserve ALL line breaks exactly as they appear in source.
Every single newline (\n) in source = same newline in translation.
Do NOT add or remove blank lines. Critical for Chatwork message formatting.
```

#### `SECTION_CONSTRAINTS` — HARD LIMITS

```
## Hard Constraints
- Do NOT add translator notes, commentary, or explanations inside the translation
- Do NOT translate internationally recognized English IT/business terms
- Do NOT add formality that wasn't in the original
- Do NOT reduce formality that WAS in the original
- Do NOT summarize, paraphrase beyond natural adaptation, or omit any content
- Do NOT prefix the JSON response with any text — output JSON immediately
```

### `buildUserPrompt(text)` — Few-Shot Anchored

The user prompt includes 2 few-shot examples to anchor quality and demonstrate:

1. Keigo handling (JP example with sonkeigo → Vietnamese formal)
2. IT term preservation (EN example with deploy, staging)

```typescript
export function buildUserPrompt(text: string): string {
  return `Translate the text below into natural Vietnamese.
Respond ONLY with valid JSON. No markdown, no code block, no explanation.

Required format: {"sourceLang": "<full English language name>", "translated": "<Vietnamese translation>"}

Quality examples:
Input: 「お世話になっております。リリースの件でご確認をお願いしたくご連絡いたしました。」
Output: {"sourceLang":"Japanese","translated":"Kính gửi anh/chị,\\nTôi xin phép liên lạc để nhờ xác nhận về release trước đó."}

Input: "The deploy is scheduled for Monday. Please make sure staging is ready."
Output: {"sourceLang":"English","translated":"Deploy được lên kế hoạch vào thứ Hai. Nhờ anh/chị đảm bảo staging đã sẵn sàng nhé."}

Text:
${text}`
}
```

---

## Success Criteria (TCREI: Evaluate)

A translation passes quality bar if:

1. **Natural Vietnamese**: A native Vietnamese professional would not identify it as a translation
2. **Register accuracy**: Keigo level is mapped to correct Vietnamese politeness equivalent
3. **IT terms preserved**: All items in the IT terms list remain in English
4. **Line breaks exact**: Character-level match of newlines between source and translation
5. **JSON compliance**: Output is valid JSON parseable by `JSON.parse()` with no prefix/suffix
6. **No content loss**: Meaning, quantity, and nuance are preserved

---

## Files Changed

| File                                                    | Change type        | Notes             |
| ------------------------------------------------------- | ------------------ | ----------------- |
| `packages/translation-prompt/src/translation-prompt.ts` | Refactor + enhance | Only file changed |

**Files NOT touched:**

- All provider packages (`provider-gemini`, `provider-openai`, `provider-cursor`)
- `core` package
- `translator` package
- Zod schema `TranslationSchema` — unchanged (`{ sourceLang, translated }`)
- `TranslationOutput` type — unchanged

---

## Iteration Plan (TCREI: Iterate)

If output quality still issues after implementation:

1. **If output is stiff** → Check `SECTION_HUMANIZER`, add more specific DO NOT patterns
2. **If keigo wrong** → Extend keigo table in `SECTION_JAPANESE_RULES` with more examples
3. **If IT terms translated** → Add missing terms to the English terms list
4. **If JSON malformed** → Strengthen enforcement in `SECTION_CONSTRAINTS` + user prompt
5. **Adding new language** → Add new section (e.g., `SECTION_CHINESE_RULES`) and push to registry

---

## Verification Commands

```bash
bun test                    # Run test suite
bun run typecheck           # TypeScript type checking
bun run lint                # ESLint
```

---

## Research Sources

- [Google TCREI Framework](https://www.coursera.org/learn/google-prompting-essentials) — Prompt architecture
- [Lyra v2 Prompt Optimizer](.claude/skills/lyra-prompt-optimizer/SKILL.md) — Revolutionary optimization
- [Blader Humanizer](https://www.skillhub.club/skills/blader-humanizer) — 24 AI patterns to avoid
- [Sabrina.dev AI Humanizer](https://www.sabrina.dev/p/best-ai-prompt-to-humanize-ai-writing) — Constraint-based naturalness
- [Pairaphrase Translation Prompts](https://www.pairaphrase.com/blog/chatgpt-prompts-translation) — Professional translation techniques
- [Keigo Research](https://arxiv.org/pdf/2509.11921) — LLM cultural sensitivity for Japanese
- `vietnamese.md` — Reference persona for full translator expertise framing
