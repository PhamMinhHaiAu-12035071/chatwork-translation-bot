# Translation Prompt Optimization — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the minimal translation prompt with a production-quality, SOLID-architecture prompt system that produces natural Vietnamese output — especially from Japanese, with correct keigo mapping, IT-term preservation, and JSON-only enforcement.

**Architecture:** Single file refactor of `translation-prompt.ts`. Introduce a `PromptSection` interface + `PROMPT_SECTIONS` registry (array of `{ id, content }` objects). Export three pure functions: `buildSystemPrompt(sections?)`, `buildUserPrompt(text)`, and `buildTranslationPrompt(text)` (backward compat). Update `index.ts` to export the two new functions.

**Tech Stack:** Bun v1.1+, TypeScript 5.4+ strict, Zod, bun:test

---

## Context: Current State

**File:** `packages/translation-prompt/src/translation-prompt.ts`

Current exports (must remain working):

- `TranslationSchema` — Zod schema, **do NOT change**
- `TranslationOutput` — inferred type, **do NOT change**
- `buildTranslationPrompt(text: string): string` — **keep, update to compose system+user**

Current test file: `packages/translation-prompt/src/translation-prompt.test.ts`

- Tests `buildTranslationPrompt` for: contains text, contains "vietnamese", contains "detect"
- All 3 must continue to pass after refactor

**Design doc:** `docs/plans/2026-03-09-translation-prompt-optimization-design.md`

---

## Task 1: Write failing tests for new functions

**Files:**

- Modify: `packages/translation-prompt/src/translation-prompt.test.ts`

### Step 1: Add new test suite to the existing test file

Append to `translation-prompt.test.ts` (after existing suites):

```typescript
import { describe, expect, it } from 'bun:test'
import {
  TranslationSchema,
  buildTranslationPrompt,
  buildSystemPrompt,
  buildUserPrompt,
} from './translation-prompt'

// ... existing tests remain unchanged ...

describe('buildSystemPrompt', () => {
  it('returns a non-empty string', () => {
    expect(buildSystemPrompt().length).toBeGreaterThan(100)
  })

  it('mentions elite translator persona', () => {
    expect(buildSystemPrompt().toLowerCase()).toContain('translator')
  })

  it('mentions vietnamese', () => {
    expect(buildSystemPrompt().toLowerCase()).toContain('vietnamese')
  })

  it('mentions keigo', () => {
    expect(buildSystemPrompt().toLowerCase()).toContain('keigo')
  })

  it('mentions JSON output rule', () => {
    // JSON enforcement is in buildUserPrompt, not system — system should not mention JSON
    // system is persona + rules only
    expect(buildSystemPrompt()).not.toContain('"sourceLang"')
  })

  it('accepts a custom sections array', () => {
    const custom = [{ id: 'test', content: 'Custom section content here' }]
    const result = buildSystemPrompt(custom)
    expect(result).toBe('Custom section content here')
  })

  it('is a pure function — same input always returns same output', () => {
    expect(buildSystemPrompt()).toBe(buildSystemPrompt())
  })
})

describe('buildUserPrompt', () => {
  it('includes the source text', () => {
    const text = 'こんにちは世界'
    expect(buildUserPrompt(text)).toContain(text)
  })

  it('instructs JSON-only output', () => {
    const prompt = buildUserPrompt('test')
    expect(prompt.toLowerCase()).toContain('json')
  })

  it('specifies the required JSON format', () => {
    const prompt = buildUserPrompt('test')
    expect(prompt).toContain('"sourceLang"')
    expect(prompt).toContain('"translated"')
  })

  it('instructs no markdown or code block', () => {
    const prompt = buildUserPrompt('test')
    expect(prompt.toLowerCase()).toContain('no markdown')
  })

  it('contains few-shot example with japanese input', () => {
    const prompt = buildUserPrompt('test')
    // Should contain a Japanese example showing keigo handling
    expect(prompt).toContain('お世話')
  })

  it('contains few-shot example showing IT terms in English', () => {
    const prompt = buildUserPrompt('test')
    expect(prompt).toContain('deploy')
    expect(prompt).toContain('staging')
  })

  it('is a pure function — same text always returns same output', () => {
    expect(buildUserPrompt('hello')).toBe(buildUserPrompt('hello'))
  })
})

describe('buildTranslationPrompt (backward compat)', () => {
  it('still includes the source text', () => {
    expect(buildTranslationPrompt('hello')).toContain('hello')
  })

  it('still mentions vietnamese', () => {
    expect(buildTranslationPrompt('test').toLowerCase()).toContain('vietnamese')
  })

  it('still mentions detecting source language', () => {
    expect(buildTranslationPrompt('test').toLowerCase()).toContain('detect')
  })

  it('composes system + user prompt', () => {
    const full = buildTranslationPrompt('hello')
    const system = buildSystemPrompt()
    const user = buildUserPrompt('hello')
    expect(full).toContain(system)
    expect(full).toContain(user)
  })
})
```

### Step 2: Run tests to verify they fail

```bash
cd /Users/phamau/Desktop/projects/research/chatwork-translation-bot
bun test packages/translation-prompt
```

Expected: FAIL — `buildSystemPrompt` and `buildUserPrompt` are not yet exported.
The 3 original `buildTranslationPrompt` tests should still pass.

---

## Task 2: Implement the PromptSection registry + section constants

**Files:**

- Modify: `packages/translation-prompt/src/translation-prompt.ts`

### Step 1: Replace the entire file content

```typescript
import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// Schema (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const TranslationSchema = z.object({
  sourceLang: z
    .string()
    .min(2)
    .max(50)
    .describe(
      "Full language name in English, e.g. 'Japanese', 'Vietnamese', 'Traditional Chinese'",
    ),
  translated: z.string().min(1),
})

export type TranslationOutput = z.infer<typeof TranslationSchema>

// ─────────────────────────────────────────────────────────────────────────────
// PromptSection registry
// ─────────────────────────────────────────────────────────────────────────────

interface PromptSection {
  id: string
  content: string
}

// Section 1: Persona — WHO the translator is (TCREI: Task/Role)
const SECTION_PERSONA: PromptSection = {
  id: 'persona',
  content: `You are an elite professional translator with over 20 years of specialized experience in Japanese-to-Vietnamese and multilingual corporate communication. You possess deep expertise in:
- Japanese linguistics including all three levels of keigo (敬語)
- Vietnamese modern business writing and idiomatic expression
- Cross-cultural corporate communication in East Asian contexts
- IT, technology, and business terminology

Your translations are indistinguishable from text written by a native Vietnamese professional in a modern tech company. You reconstruct meaning in its new cultural-linguistic context — you do not merely convert words.`,
}

// Section 2: Core Doctrine — WHAT quality means (TCREI: Context)
const SECTION_CORE_DOCTRINE: PromptSection = {
  id: 'core-doctrine',
  content: `## Core Translation Doctrine

1. Natural Vietnamese First
Every sentence must read as if written originally by a Vietnamese professional. Never mirror source sentence structure. If Vietnamese grammar demands a different order, use it.

2. Modern Professional Tone
Write as educated Vietnamese office workers communicate: polished and respectful, but not stiff or bureaucratic. Use contemporary Vietnamese, not textbook or archaic forms.

3. Cultural Fidelity
Preserve the communicative intent and interpersonal register (superior/peer/subordinate) of the original. Capture implied courtesy and culturally encoded meaning — do not flatten nuance.

4. Preserve Meaning Precisely
Do not add, remove, soften, or amplify meaning. Direct → direct. Apologetic → apologetic. Urgent → urgent.`,
}

// Section 3: Japanese-specific rules — DOMAIN knowledge (TCREI: References)
const SECTION_JAPANESE_RULES: PromptSection = {
  id: 'japanese-rules',
  content: `## Japanese-Specific Rules

### Keigo Register Mapping (Critical)
Detect the politeness level and map to the Vietnamese equivalent — do NOT flatten or elevate:

| Japanese Level      | Example pattern      | Vietnamese Equivalent                |
|---------------------|----------------------|--------------------------------------|
| Teineigo (丁寧語)   | です/ます            | "vui lòng", "cảm ơn", "xin"         |
| Sonkeigo (尊敬語)   | ご〜いただく         | "kính gửi", "trân trọng", "xin phép" |
| Kenjōgo (謙譲語)    | させていただく       | "xin được", "cho phép tôi"           |
| Kudaketa (くだけた) | だ/だよ              | casual Vietnamese, no excess form    |

### IT/Business International Terms — KEEP IN ENGLISH
These terms are standard in Vietnamese tech workplaces. Do NOT translate them into Vietnamese:
project, release, sprint, deploy, staging, production, deadline, milestone, review, update, report, task, issue, bug, fix, PR, merge, branch, commit, schedule, meeting, agenda, feedback, team, manager, lead, backlog, ticket, pipeline, onboarding, offboarding, dashboard

### Proper Nouns & Names
- Company names, product names, people's names: keep in original form
- Katakana loanwords from English: use the original English word, not Vietnamese transliteration
  プロジェクト → project | リリース → release | ミーティング → meeting | デプロイ → deploy

### Japanese Formatting Conventions
- ※ (annotation marker) → "Lưu ý:"
- 「」 (Japanese quotation marks) → Vietnamese double quotes " "
- ・ (bullet point) → "-"
- よろしくお願いいたします → "Trân trọng cảm ơn" or "Mong nhận được sự hợp tác"`,
}

// Section 4: Humanizer rules — NATURALNESS (anti-machine-translation patterns)
const SECTION_HUMANIZER: PromptSection = {
  id: 'humanizer',
  content: `## Vietnamese Natural Language Rules

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
- Mirroring Japanese sentence endings awkwardly into Vietnamese phrasing

### Self-Verification (internal check before finalizing output)
Silently verify all 4 conditions before producing the JSON:
1. ✓ Natural Vietnamese — would a native professional write it exactly this way?
2. ✓ Register preserved — politeness level correctly mapped to Vietnamese equivalent?
3. ✓ IT terms in English — no translated tech jargon anywhere in the output?
4. ✓ Line breaks identical — every \\n in source appears exactly in translation?`,
}

// Section 5: Structural rules — FORMAT preservation
const SECTION_STRUCTURAL: PromptSection = {
  id: 'structural',
  content: `## Structural Rules

Line Breaks: Preserve ALL line breaks exactly as they appear in the source text.
Every single newline (\\n) in source = the same newline in translation.
Do NOT add or remove blank lines. This is critical for Chatwork message formatting.`,
}

// Section 6: Hard constraints — what to NEVER do
const SECTION_CONSTRAINTS: PromptSection = {
  id: 'constraints',
  content: `## Hard Constraints
- Do NOT add translator notes, commentary, or explanations inside the translation
- Do NOT translate internationally recognized English IT/business terms
- Do NOT add formality that was not present in the original
- Do NOT reduce formality that WAS present in the original
- Do NOT summarize, paraphrase beyond natural adaptation, or omit any content
- Do NOT prefix the JSON response with any text — output JSON immediately`,
}

/** All sections in composition order. Add new sections here. */
const PROMPT_SECTIONS: readonly PromptSection[] = [
  SECTION_PERSONA,
  SECTION_CORE_DOCTRINE,
  SECTION_JAPANESE_RULES,
  SECTION_HUMANIZER,
  SECTION_STRUCTURAL,
  SECTION_CONSTRAINTS,
] as const

// ─────────────────────────────────────────────────────────────────────────────
// Public API — pure functions, no side effects
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the system-level prompt: persona, doctrine, language rules, and constraints.
 * Accepts an optional sections array for testing or customisation.
 * Pure function — no side effects.
 */
export function buildSystemPrompt(sections: readonly PromptSection[] = PROMPT_SECTIONS): string {
  return sections.map((s) => s.content).join('\n\n')
}

/**
 * Returns the user-level prompt with the text to translate.
 * Enforces JSON-only output and includes two few-shot examples to anchor quality.
 * Pure function — no side effects.
 */
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

/**
 * Combines system and user prompts into a single string.
 * Maintained for backward compatibility with providers that send a single prompt string.
 * Pure function — no side effects.
 */
export function buildTranslationPrompt(text: string): string {
  return `${buildSystemPrompt()}\n\n${buildUserPrompt(text)}`
}
```

### Step 2: Run tests to verify they pass

```bash
bun test packages/translation-prompt
```

Expected: All tests PASS — including the 3 original tests and all new tests.

---

## Task 3: Update index.ts exports

**Files:**

- Modify: `packages/translation-prompt/src/index.ts`

### Step 1: Add new exports

Replace the current content:

```typescript
export {
  TranslationSchema,
  buildTranslationPrompt,
  buildSystemPrompt,
  buildUserPrompt,
} from './translation-prompt'
export type { TranslationOutput } from './translation-prompt'
```

### Step 2: Run tests again to confirm no regression

```bash
bun test packages/translation-prompt
```

Expected: All PASS

---

## Task 4: Full verification

**Files:** none changed

### Step 1: Run full test suite

```bash
cd /Users/phamau/Desktop/projects/research/chatwork-translation-bot
bun test
```

Expected: All tests across all packages pass.

### Step 2: TypeScript type check

```bash
bun run typecheck
```

Expected: No type errors.

### Step 3: Lint

```bash
bun run lint
```

Expected: No new lint errors (pre-existing errors do not count).

---

## Task 5: Commit

### Step 1: Stage only the changed files

```bash
git add packages/translation-prompt/src/translation-prompt.ts
git add packages/translation-prompt/src/index.ts
git add packages/translation-prompt/src/translation-prompt.test.ts
git add docs/plans/
```

### Step 2: Commit

```bash
git commit -m "feat(translation-prompt): optimize prompt with PromptSection registry and natural Vietnamese rules

- Add PromptSection interface + 6-section registry (persona, core-doctrine,
  japanese-rules, humanizer, structural, constraints)
- Export buildSystemPrompt(sections?) and buildUserPrompt(text) as pure functions
- Keep buildTranslationPrompt(text) for backward compatibility
- Add keigo 4-level mapping table (teineigo/sonkeigo/kenjōgo/kudaketa)
- Add IT/business term list kept in English (25+ terms)
- Add self-verification checklist and anti-machine-translation rules
- Add few-shot examples in user prompt to anchor JSON quality
- Expand test coverage for new functions
- Add design doc and implementation plan"
```

---

## Definition of Done

- [ ] `bun test` — all tests pass including new test suites
- [ ] `bun run typecheck` — zero type errors
- [ ] `bun run lint` — no new lint errors
- [ ] `buildTranslationPrompt('hello')` still contains "hello", "vietnamese", "detect"
- [ ] `buildSystemPrompt()` mentions keigo, translator, vietnamese
- [ ] `buildUserPrompt('test')` enforces JSON, has few-shot examples
- [ ] `buildSystemPrompt([{ id: 'x', content: 'y' }])` returns `'y'` (custom sections work)
- [ ] No other packages changed

---

## Notes for Implementer

**Import alias:** This project uses `~/path` for intra-package imports. Since everything is in `src/`, direct relative imports are fine within this file.

**No `../` imports:** The `no-restricted-imports` ESLint rule forbids `../` for intra-package imports. This file only imports `zod` — no relative imports needed.

**Bun test runner:** Use `bun test` not `jest` or `vitest`. Import from `bun:test`.

**Pure functions:** All three exported functions must have zero side effects. They only read their arguments and constants — never read env vars, never call external APIs.

**Section constants are module-level constants**, not exported. Only the functions are exported. `PROMPT_SECTIONS` is intentionally not exported (use `buildSystemPrompt()` instead).
