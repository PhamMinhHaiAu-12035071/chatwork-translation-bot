# Translation Prompt Level-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade translation prompts to Kagi Translate quality with a two-step draft→polish pipeline, 3 enriched style profiles, and comprehensive anti-translationese patterns.

**Architecture:** Remove AUTO_CONTEXT style (embed context-awareness into base prompt). Enrich existing prompt sections. Add new polish prompt builders and schemas. Modify pipeline to call LLM twice (draft → polish) with fallback to draft on polish failure.

**Tech Stack:** Bun · TypeScript · Zod 4 · bun:test

---

## File Map

### Create

| File                                                            | Responsibility                                                                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `packages/translation-prompt/src/sections/polish.ts`            | Polish system prompt sections (POLISH_PERSONA, POLISH_DOCTRINE, ANTI_TRANSLATIONESE_CHECKLIST, POLISH_CONSTRAINTS) |
| `packages/translation-prompt/src/sections/polish.test.ts`       | Tests for polish prompt section exports                                                                            |
| `packages/translation-prompt/src/schemas/polish.schema.ts`      | PolishResultSchema, StructuredPolishResultSchema                                                                   |
| `packages/translation-prompt/src/schemas/polish.schema.test.ts` | Tests for polish schemas                                                                                           |

### Modify

| File                                                                     | What changes                                         |
| ------------------------------------------------------------------------ | ---------------------------------------------------- |
| `packages/core/src/types/translation-style.ts`                           | Remove `AUTO_CONTEXT` from values array              |
| `packages/core/src/types/translation-style.test.ts`                      | Update tests for 3 styles                            |
| `packages/translation-prompt/src/sections/core.ts`                       | Add context-awareness principle #5 to CORE_DOCTRINE  |
| `packages/translation-prompt/src/sections/humanizer.ts`                  | Expand HUMANIZER with anti-translationese patterns   |
| `packages/translation-prompt/src/sections/single-call.ts`                | Enhance INTERNAL_REASONING self-critique gate        |
| `packages/translation-prompt/src/sections/translation-style-profiles.ts` | Remove AUTO_CONTEXT, enrich 3 style profiles         |
| `packages/translation-prompt/src/translation-prompt.ts`                  | Add buildPolishPrompts, buildStructuredPolishPrompts |
| `packages/translation-prompt/src/translation-prompt.test.ts`             | Tests for polish builders + update style tests       |
| `packages/translation-prompt/src/index.ts`                               | Export new builders, schemas, types                  |
| `packages/translator/src/pipeline/pipeline.ts`                           | Two-step pipeline with fallback                      |
| `packages/translator/src/pipeline/pipeline.test.ts`                      | Tests for two-step + fallback                        |

---

### Task 1: Remove AUTO_CONTEXT from core types

**Files:**

- Modify: `packages/core/src/types/translation-style.ts`
- Test: `packages/core/src/types/translation-style.test.ts`

- [ ] **Step 1: Check if translation-style.test.ts exists, if not find related test**

```bash
ls packages/core/src/types/translation-style.test.ts 2>/dev/null || echo "No test file yet"
```

If no test file exists, check for tests elsewhere:

```bash
bun test --list-tests 2>/dev/null | grep -i translation-style || echo "No existing tests"
```

- [ ] **Step 2: Write failing test for 3-style system**

Create `packages/core/src/types/translation-style.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test'
import {
  TRANSLATION_STYLE_VALUES,
  DEFAULT_TRANSLATION_STYLE,
  isTranslationStyle,
} from './translation-style'
import type { TranslationStyle } from './translation-style'

describe('TRANSLATION_STYLE_VALUES', () => {
  it('contains exactly 3 styles without AUTO_CONTEXT', () => {
    expect(TRANSLATION_STYLE_VALUES).toEqual([
      'NATURAL_CASUAL',
      'PROFESSIONAL_BUSINESS',
      'TECHNICAL',
    ])
  })

  it('does not include AUTO_CONTEXT', () => {
    expect(TRANSLATION_STYLE_VALUES).not.toContain('AUTO_CONTEXT')
  })
})

describe('DEFAULT_TRANSLATION_STYLE', () => {
  it('is PROFESSIONAL_BUSINESS', () => {
    expect(DEFAULT_TRANSLATION_STYLE).toBe('PROFESSIONAL_BUSINESS')
  })
})

describe('isTranslationStyle', () => {
  it('returns true for valid styles', () => {
    expect(isTranslationStyle('NATURAL_CASUAL')).toBe(true)
    expect(isTranslationStyle('PROFESSIONAL_BUSINESS')).toBe(true)
    expect(isTranslationStyle('TECHNICAL')).toBe(true)
  })

  it('returns false for AUTO_CONTEXT', () => {
    expect(isTranslationStyle('AUTO_CONTEXT')).toBe(false)
  })

  it('returns false for arbitrary strings', () => {
    expect(isTranslationStyle('INVALID')).toBe(false)
    expect(isTranslationStyle('')).toBe(false)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
bun test packages/core/src/types/translation-style.test.ts
```

Expected: FAIL — `TRANSLATION_STYLE_VALUES` still contains `AUTO_CONTEXT`.

- [ ] **Step 4: Update translation-style.ts to remove AUTO_CONTEXT**

Replace the content of `packages/core/src/types/translation-style.ts`:

```typescript
export const TRANSLATION_STYLE_VALUES = [
  'NATURAL_CASUAL',
  'PROFESSIONAL_BUSINESS',
  'TECHNICAL',
] as const

export type TranslationStyle = (typeof TRANSLATION_STYLE_VALUES)[number]

export const DEFAULT_TRANSLATION_STYLE: TranslationStyle = 'PROFESSIONAL_BUSINESS'

export function isTranslationStyle(value: string): value is TranslationStyle {
  return TRANSLATION_STYLE_VALUES.includes(value as TranslationStyle)
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
bun test packages/core/src/types/translation-style.test.ts
```

Expected: PASS

- [ ] **Step 6: Fix any downstream TypeScript errors**

```bash
bun run typecheck 2>&1 | head -40
```

The removal of `AUTO_CONTEXT` from the union type will cause TS errors in:

- `packages/translation-prompt/src/sections/translation-style-profiles.ts` (has `AUTO_CONTEXT` key)
- `packages/translation-prompt/src/translation-prompt.test.ts` (test uses `AUTO_CONTEXT`)

These will be fixed in subsequent tasks. For now just verify the core package compiles:

```bash
cd packages/core && bun run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/types/translation-style.ts packages/core/src/types/translation-style.test.ts
git commit -m "feat(core): remove AUTO_CONTEXT from translation style values

BREAKING CHANGE: AUTO_CONTEXT is no longer a valid TranslationStyle.
Context-awareness will be embedded in the base prompt instead.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Enrich style profiles and remove AUTO_CONTEXT profile

**Files:**

- Modify: `packages/translation-prompt/src/sections/translation-style-profiles.ts`

- [ ] **Step 1: Replace translation-style-profiles.ts with enriched 3-style profiles**

Replace the entire file `packages/translation-prompt/src/sections/translation-style-profiles.ts`:

```typescript
import type { TranslationStyle } from '@chatwork-bot/core'

export interface TranslationStyleProfile {
  id: TranslationStyle
  name: string
  description: string
  systemInstructions: string
  polishCriteria: string
}

export const TRANSLATION_STYLE_PROFILES: Record<TranslationStyle, TranslationStyleProfile> = {
  NATURAL_CASUAL: {
    id: 'NATURAL_CASUAL',
    name: 'Natural / Casual',
    description:
      'Conversational Vietnamese that feels natural and light while staying workplace-safe. Voice: a friendly colleague chatting on Zalo/Slack.',
    systemInstructions: `- Write as a friendly colleague chatting on Zalo or Slack — smooth, conversational, workplace-safe.
- Prefer short sentences with quick rhythm and natural flow. Break long source sentences into 2-3 shorter Vietnamese sentences when it reads better.
- Use Vietnamese sentence-final particles naturally where they fit: "nhé", "nha", "á", "đấy", "thôi", "rồi", "nhỉ". Do not force them onto every sentence — sprinkle, do not spray.
- Use light conversational connectives: "kiểu", "cơ mà", "mà thôi", "thế là", "thì", "nên là".
- Allow rhetorical questions and light personal commentary when the source implies it (e.g., 「コストどうですか？」 → "Chi phí thì sao nhỉ?" not "Chi phí sẽ như thế nào?").
- Drop the subject when context makes it obvious — this is how native Vietnamese actually reads. Do not repeat "chúng tôi" or "nó" in every sentence.
- Prefer native Vietnamese words over Sino-Vietnamese (Hán-Việt) when both exist: "bởi vì" over "do nguyên nhân", "thay đổi" over "biến đổi", "dùng" over "sử dụng".
- Soften strongly formal source text within safe bounds while preserving intent. A formal Japanese request can become a friendly Vietnamese suggestion without losing meaning.
- This style must sound like a REAL PERSON chatting — not like PROFESSIONAL_BUSINESS with particles sprinkled on top. The sentence structure, word choice, and rhythm must be fundamentally different from professional style.

DO NOT:
- Use vulgar language, memes, internet slang, or language that would feel unserious in a workplace.
- Use heavy Sino-Vietnamese terminology when simpler Vietnamese exists.
- Use passive voice ("được X") when active voice is more natural.
- Produce long multi-clause sentences — split them.
- Use formal markers ("vui lòng", "xin", "kính") — these belong to PROFESSIONAL_BUSINESS.
- Start multiple consecutive sentences with the same word or pattern.`,
    polishCriteria: `Re-read each sentence aloud. If a colleague said this on Zalo, would it sound natural? If it sounds like a translated document or a business email, rewrite it. Check that sentence-final particles feel organic, not mechanical. Verify the rhythm is conversational — short punchy sentences mixed with occasional longer ones.`,
  },
  PROFESSIONAL_BUSINESS: {
    id: 'PROFESSIONAL_BUSINESS',
    name: 'Professional / Business',
    description:
      'Modern professional Vietnamese for clear, polished business communication. Voice: a competent PM writing internal email.',
    systemInstructions: `- Write as a competent project manager composing an internal email — clear, polished, modern, respectful.
- Use medium-length sentences with clear structure. Each sentence conveys one idea.
- Use professional but not stiff vocabulary. Contemporary Vietnamese that educated office workers actually use.
- Use moderate politeness markers where appropriate: "vui lòng", "xin", "mời". But do not overuse them — one per paragraph is usually enough.
- Keep wording concise — every word earns its place. Reads like a competent Vietnamese professional wrote it originally, not like a translation.
- Maintain consistent register throughout — do not oscillate between casual and formal within the same message.
- Preserve the interpersonal register of the source: superior-to-subordinate, peer-to-peer, or subordinate-to-superior should map to equivalent Vietnamese professional register.

DO NOT:
- Sound bureaucratic or archaic ("kính gửi quý ông/bà", "trân trọng kính báo").
- Use excessive Sino-Vietnamese formality that makes text feel like a government document.
- Use casual particles or conversational fillers ("nhé", "nha", "á", "kiểu", "cơ mà").
- Sound either too casual (like NATURAL_CASUAL) or too formal (like a legal notice).
- Use decorative or inflated language — "tiến hành thực hiện" when "làm" suffices.
- Start sentences with heavy nominalizations ("Việc...", "Sự...") unless truly needed.`,
    polishCriteria: `Re-read each sentence. If a PM sent this in an internal email, would it sound professional and natural? If it sounds too stiff or bureaucratic, loosen it. If it sounds too casual, tighten it. The middle ground is the target.`,
  },
  TECHNICAL: {
    id: 'TECHNICAL',
    name: 'Technical',
    description:
      'Precision-first Vietnamese for engineering and IT/business communication. Voice: a senior engineer writing tech docs or code review comments.',
    systemInstructions: `- Write as a senior engineer writing documentation, code review comments, or incident reports — precision first, terse.
- Use short, direct sentences. Every sentence states a fact, action, or constraint without ambiguity.
- Keep established IT and business terms in English when that is the natural workplace rendering. Do not translate "deploy", "commit", "pipeline", "staging", "rollback", etc.
- Prefer imperative mood when giving instructions: "Chạy lệnh sau" not "Bạn có thể chạy lệnh sau".
- Structure-focused output: preserve or create bullet points, numbered lists, and code blocks when they aid clarity.
- Operational clarity is paramount: actions, states, conditions, and constraints must be unambiguous.
- Use precise quantifiers and qualifiers: "tối đa 3 lần", "trong vòng 5 giây", not "một vài lần", "nhanh chóng".

DO NOT:
- Use decorative language, conversational fillers, or emotional expressions.
- Translate technical terms into Vietnamese when the English term is industry-standard in Vietnamese workplaces.
- Use casual particles ("nhé", "nha", "á") or informal connectives ("kiểu", "cơ mà").
- Use vague hedging language ("có thể", "có lẽ", "khoảng") when the source is precise.
- Prioritize readability over technical precision — precision wins when they conflict.
- Add polite softeners ("vui lòng", "xin") unless the source explicitly requests politeness.`,
    polishCriteria: `Re-read each sentence. Is the terminology precise and consistent? Any decorative fluff that adds no information? Cut it. Any vague language where the source was specific? Tighten it. Would a senior engineer accept this in a tech doc?`,
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
```

- [ ] **Step 2: Run typecheck to verify it compiles**

```bash
cd packages/translation-prompt && bun run typecheck
```

Expected: PASS — the type `TranslationStyle` no longer includes `AUTO_CONTEXT`, so the `Record<TranslationStyle, ...>` now expects exactly 3 keys.

- [ ] **Step 3: Commit**

```bash
git add packages/translation-prompt/src/sections/translation-style-profiles.ts
git commit -m "feat(translation-prompt): enrich 3 style profiles with distinct personas

Each style now has 15-20 lines of specific behavioral instructions plus
polishCriteria for the upcoming two-step pipeline. AUTO_CONTEXT profile
removed — context-awareness moves to CORE_DOCTRINE.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Enhance CORE_DOCTRINE with context-awareness

**Files:**

- Modify: `packages/translation-prompt/src/sections/core.ts`

- [ ] **Step 1: Add context-awareness principle #5 to CORE_DOCTRINE**

Edit `packages/translation-prompt/src/sections/core.ts`. Add to end of `CORE_DOCTRINE`:

```typescript
export const CORE_DOCTRINE = `## Core Translation Doctrine

1. Natural Vietnamese First
Every sentence must read as if written originally by a Vietnamese professional. Never mirror source sentence structure. If Vietnamese grammar demands a different order, use it.

2. Modern Professional Tone
Write as educated Vietnamese office workers communicate: polished and respectful, but not stiff or bureaucratic. Use contemporary Vietnamese, not textbook or archaic forms.

3. Cultural Fidelity
Preserve the communicative intent and interpersonal register (superior/peer/subordinate) of the original. Capture implied courtesy and culturally encoded meaning — do not flatten nuance.

4. Preserve Meaning Precisely
Do not add, remove, soften, or amplify meaning. Direct → direct. Apologetic → apologetic. Urgent → urgent.

5. Context-Aware Register
Before translating, silently detect the message context — is it casual chat, business email, technical discussion, operational notice, or mixed? Let the detected context inform word choice and sentence structure WITHIN the bounds of the active translation style. Do not override the style, but let context refine it naturally.`
```

- [ ] **Step 2: Run existing tests to verify nothing breaks**

```bash
bun test packages/translation-prompt/
```

Expected: Some tests may fail due to AUTO_CONTEXT removal in test file — this is expected and will be fixed in Task 6.

- [ ] **Step 3: Commit**

```bash
git add packages/translation-prompt/src/sections/core.ts
git commit -m "feat(translation-prompt): add context-aware register to core doctrine

Embeds AUTO_CONTEXT capability as principle #5 in CORE_DOCTRINE. All
styles now auto-detect message context and adjust register within style
bounds.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Expand HUMANIZER with anti-translationese patterns

**Files:**

- Modify: `packages/translation-prompt/src/sections/humanizer.ts`

- [ ] **Step 1: Replace HUMANIZER section with expanded version**

Edit `packages/translation-prompt/src/sections/humanizer.ts` — replace the `HUMANIZER` export (keep `STRUCTURAL` unchanged):

```typescript
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
```

Keep the `STRUCTURAL` export exactly as-is — do not modify it.

- [ ] **Step 2: Run tests to verify HUMANIZER content is detected**

```bash
bun test packages/translation-prompt/ --test-name-pattern "humanizer|machine.translation"
```

- [ ] **Step 3: Commit**

```bash
git add packages/translation-prompt/src/sections/humanizer.ts
git commit -m "feat(translation-prompt): expand HUMANIZER with comprehensive anti-translationese patterns

Adds 10 DO patterns and 13 DO NOT patterns covering nominalization,
passive voice, Sino-Vietnamese overuse, subject repetition, idiom
calques, and other machine-translation signals.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Enhance INTERNAL_REASONING self-critique gate

**Files:**

- Modify: `packages/translation-prompt/src/sections/single-call.ts`

- [ ] **Step 1: Update INTERNAL_REASONING in single-call.ts**

Edit `packages/translation-prompt/src/sections/single-call.ts` — replace the `INTERNAL_REASONING` constant:

```typescript
const INTERNAL_REASONING = `## Internal Reasoning Instruction (Do Not Output)

Before writing the translation, silently assess:
1. Source language — detect from script/vocabulary
2. Register/keigo level — map to the appropriate Vietnamese register
3. Communicative function — is this an email formula, apology, request, gratitude, maintenance notice, etc.?
4. Preservation flags — does text contain URLs, code, Chatwork markup, Japanese proper names, numeric units?
5. Rendering policy — literal mapping or functional communicative equivalent?
6. Message context — casual chat, business email, technical discussion, operational notice, or mixed?

Then apply the self-critique gate before finalizing output:
- Natural flow: would a Vietnamese professional write this sentence exactly as written? Read it aloud mentally.
- Cultural fidelity: is the register/keigo mapping accurate and natural in Vietnamese?
- Semantic accuracy: nothing added, removed, softened, or amplified vs the source?
- Translationese check: does any sentence mirror the source language's sentence structure rather than Vietnamese natural structure?
- Particle check: are sentence-ending particles (if used) organic, not mechanically inserted?
- Redundancy check: any unnecessary nominalizations ("Việc...", "Sự..."), passive constructions, or decorative Sino-Vietnamese terms that could be simplified?

Only output the JSON after passing all gates.`
```

- [ ] **Step 2: Run tests**

```bash
bun test packages/translation-prompt/ --test-name-pattern "self-critique|natural flow"
```

- [ ] **Step 3: Commit**

```bash
git add packages/translation-prompt/src/sections/single-call.ts
git commit -m "feat(translation-prompt): enhance self-critique gate with translationese checks

Adds context detection, translationese structure check, particle
naturalness check, and Sino-Vietnamese redundancy check to the
internal reasoning gate.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Add polish schemas

**Files:**

- Create: `packages/translation-prompt/src/schemas/polish.schema.ts`
- Create: `packages/translation-prompt/src/schemas/polish.schema.test.ts`

- [ ] **Step 1: Write failing tests for polish schemas**

Create `packages/translation-prompt/src/schemas/polish.schema.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test'
import { PolishResultSchema, StructuredPolishResultSchema } from './polish.schema'

describe('PolishResultSchema', () => {
  it('parses valid polish result', () => {
    const result = PolishResultSchema.parse({ translated: 'Xin chào' })
    expect(result.translated).toBe('Xin chào')
  })

  it('rejects empty translated', () => {
    expect(() => PolishResultSchema.parse({ translated: '' })).toThrow()
  })

  it('rejects missing translated', () => {
    expect(() => PolishResultSchema.parse({})).toThrow()
  })
})

describe('StructuredPolishResultSchema', () => {
  it('parses valid structured polish result', () => {
    const result = StructuredPolishResultSchema.parse({
      translatedSegments: ['Xin chào', 'Vui lòng xem tài liệu.'],
    })
    expect(result.translatedSegments).toEqual(['Xin chào', 'Vui lòng xem tài liệu.'])
  })

  it('rejects empty translatedSegments array', () => {
    expect(() => StructuredPolishResultSchema.parse({ translatedSegments: [] })).toThrow()
  })

  it('rejects segments with empty strings', () => {
    expect(() =>
      StructuredPolishResultSchema.parse({ translatedSegments: ['Xin chào', ''] }),
    ).toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test packages/translation-prompt/src/schemas/polish.schema.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create polish.schema.ts**

Create `packages/translation-prompt/src/schemas/polish.schema.ts`:

```typescript
import { z } from 'zod'

export const PolishResultSchema = z.object({
  translated: z.string().min(1),
})

export type PolishResult = z.infer<typeof PolishResultSchema>

export const StructuredPolishResultSchema = z.object({
  translatedSegments: z.array(z.string().min(1)).nonempty(),
})

export type StructuredPolishResult = z.infer<typeof StructuredPolishResultSchema>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test packages/translation-prompt/src/schemas/polish.schema.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/translation-prompt/src/schemas/polish.schema.ts packages/translation-prompt/src/schemas/polish.schema.test.ts
git commit -m "feat(translation-prompt): add polish result schemas

Adds PolishResultSchema (single) and StructuredPolishResultSchema
(multi-segment) for the two-step pipeline polish step.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Create polish prompt sections

**Files:**

- Create: `packages/translation-prompt/src/sections/polish.ts`
- Create: `packages/translation-prompt/src/sections/polish.test.ts`

- [ ] **Step 1: Write failing tests for polish sections**

Create `packages/translation-prompt/src/sections/polish.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test'
import { POLISH_SYSTEM, buildPolishStyleSection } from './polish'

describe('POLISH_SYSTEM', () => {
  it('contains polish persona', () => {
    expect(POLISH_SYSTEM).toMatch(/native Vietnamese editor|translationese/i)
  })

  it('contains anti-translationese checklist', () => {
    expect(POLISH_SYSTEM).toMatch(/mirror.*source.*structure|Sino-Vietnamese|passive voice/i)
  })

  it('contains polish constraints', () => {
    expect(POLISH_SYSTEM).toMatch(/do NOT change meaning|do NOT add or remove/i)
  })

  it('instructs to keep good drafts unchanged', () => {
    expect(POLISH_SYSTEM).toMatch(/already good|do not change for the sake of changing/i)
  })
})

describe('buildPolishStyleSection', () => {
  it('includes NATURAL_CASUAL polish criteria', () => {
    const section = buildPolishStyleSection('NATURAL_CASUAL')
    expect(section).toMatch(/Zalo|colleague|conversational/i)
  })

  it('includes PROFESSIONAL_BUSINESS polish criteria', () => {
    const section = buildPolishStyleSection('PROFESSIONAL_BUSINESS')
    expect(section).toMatch(/PM|email|professional/i)
  })

  it('includes TECHNICAL polish criteria', () => {
    const section = buildPolishStyleSection('TECHNICAL')
    expect(section).toMatch(/terminology|precision|fluff/i)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test packages/translation-prompt/src/sections/polish.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create polish.ts**

Create `packages/translation-prompt/src/sections/polish.ts`:

```typescript
import type { TranslationStyle } from '@chatwork-bot/core'
import { TRANSLATION_STYLE_PROFILES } from '~/sections/translation-style-profiles'

const POLISH_PERSONA = `You are a native Vietnamese editor with 15 years of professional editing experience. You specialize in detecting and eliminating "translationese" — the subtle but unmistakable signs that a text was translated rather than originally written in Vietnamese.`

const POLISH_DOCTRINE = `## Polish Doctrine

Your sole task is to make the draft translation read as if it were ORIGINALLY WRITTEN in Vietnamese by a native speaker — not translated from another language.

1. Restructure sentences freely if the current structure mirrors the source language rather than natural Vietnamese word order.
2. Replace Sino-Vietnamese (Hán-Việt) terms with simpler native Vietnamese when both exist and the simpler form is equally clear.
3. Preserve 100% of the original meaning — change only HOW it is expressed, never WHAT is expressed.
4. Respect the active translation style — your polish must stay within the style's voice and register.`

const ANTI_TRANSLATIONESE_CHECKLIST = `## Anti-Translationese Checklist (Apply Before Output)

Before finalizing, silently verify each sentence:
1. Does any sentence mirror the source language's sentence structure rather than natural Vietnamese structure? If yes, restructure.
2. Can any heavy Sino-Vietnamese term be replaced with a simpler native Vietnamese word without losing precision? If yes, replace.
3. Is there unnecessary passive voice ("được X", "bị X") where active voice is more natural? If yes, rewrite in active voice.
4. Would a native Vietnamese speaker actually say or write this sentence exactly this way? If no, rewrite.
5. Does the text flow naturally when read aloud? Are sentence transitions smooth? If not, adjust connectives and rhythm.
6. Are there gratuitous nominalizations ("Việc...", "Sự...") or adverb calques ("một cách...")? If yes, simplify.
7. Is the subject repeated in consecutive sentences when Vietnamese would naturally omit it? If yes, drop repeated subjects.`

const POLISH_CONSTRAINTS = `## Polish Constraints
- Do NOT change the meaning of any sentence — only change how it is expressed.
- Do NOT add information, commentary, or context that was not in the draft.
- Do NOT remove any information that was present in the draft.
- Do NOT output anything except the requested JSON format.
- If the draft is already good and natural, keep it as-is — do not change for the sake of changing.
- Preserve all Chatwork markup tags, URLs, code blocks, and proper nouns exactly as they appear in the draft.`

export const POLISH_SYSTEM = [
  POLISH_PERSONA,
  POLISH_DOCTRINE,
  ANTI_TRANSLATIONESE_CHECKLIST,
  POLISH_CONSTRAINTS,
].join('\n\n')

export function buildPolishStyleSection(style: TranslationStyle): string {
  const profile = TRANSLATION_STYLE_PROFILES[style]

  return `## Polish Style Criteria
Style: ${profile.id}
Voice: ${profile.description}

### Style-Specific Polish Check
${profile.polishCriteria}

### Guardrail
- If polishing for style would change the meaning or lose important nuance, preserve the draft wording.`
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test packages/translation-prompt/src/sections/polish.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/translation-prompt/src/sections/polish.ts packages/translation-prompt/src/sections/polish.test.ts
git commit -m "feat(translation-prompt): add polish system prompt sections

Adds POLISH_SYSTEM (persona + doctrine + anti-translationese checklist +
constraints) and buildPolishStyleSection() for style-specific polish
criteria.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Add polish prompt builders to translation-prompt.ts

**Files:**

- Modify: `packages/translation-prompt/src/translation-prompt.ts`
- Modify: `packages/translation-prompt/src/translation-prompt.test.ts`

- [ ] **Step 1: Write failing tests for polish prompt builders**

Add to `packages/translation-prompt/src/translation-prompt.test.ts` — append these new describe blocks and update the existing style test:

```typescript
// Add these imports at the top (merge with existing imports):
import {
  buildSingleCallPrompts,
  buildStructuredTranslationPrompts,
  buildPolishPrompts,
  buildStructuredPolishPrompts,
  StructuredTranslationDraftSchema,
  TranslationDraftSchema,
  PolishResultSchema,
  StructuredPolishResultSchema,
} from './translation-prompt'

// --- Add these new describe blocks at the end of the file ---

describe('buildPolishPrompts', () => {
  it('returns PromptPair with system and user strings', () => {
    const result = buildPolishPrompts('テスト', 'Kiểm tra', 'NATURAL_CASUAL')
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
  })

  it('embeds source text in user prompt', () => {
    const result = buildPolishPrompts('お世話になっております。', 'Xin chào.', 'NATURAL_CASUAL')
    expect(result.user).toContain('お世話になっております。')
  })

  it('embeds draft translation in user prompt', () => {
    const result = buildPolishPrompts('テスト', 'Bản dịch nháp', 'NATURAL_CASUAL')
    expect(result.user).toContain('Bản dịch nháp')
  })

  it('system prompt contains polish persona', () => {
    const result = buildPolishPrompts('テスト', 'Kiểm tra', 'PROFESSIONAL_BUSINESS')
    expect(result.system).toMatch(/native Vietnamese editor|translationese/i)
  })

  it('system prompt contains style-specific polish criteria', () => {
    const result = buildPolishPrompts('テスト', 'Kiểm tra', 'NATURAL_CASUAL')
    expect(result.system).toContain('NATURAL_CASUAL')
    expect(result.system).toMatch(/Zalo|colleague|conversational/i)
  })

  it('user prompt instructs JSON-only output with translated key', () => {
    const result = buildPolishPrompts('テスト', 'Kiểm tra', 'NATURAL_CASUAL')
    expect(result.user).toContain('JSON')
    expect(result.user).toContain('"translated"')
  })
})

describe('buildStructuredPolishPrompts', () => {
  it('returns PromptPair with system and user strings', () => {
    const result = buildStructuredPolishPrompts(
      ['一つ目', '二つ目'],
      ['Cái thứ nhất', 'Cái thứ hai'],
      'PROFESSIONAL_BUSINESS',
    )
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
  })

  it('embeds source segments in user prompt', () => {
    const segments = ['お世話になっております。', '資料をご確認ください。']
    const drafts = ['Xin chào.', 'Vui lòng xem tài liệu.']
    const result = buildStructuredPolishPrompts(segments, drafts, 'PROFESSIONAL_BUSINESS')
    for (const seg of segments) {
      expect(result.user).toContain(seg)
    }
  })

  it('embeds draft segments in user prompt', () => {
    const segments = ['テスト']
    const drafts = ['Bản dịch nháp']
    const result = buildStructuredPolishPrompts(segments, drafts, 'PROFESSIONAL_BUSINESS')
    expect(result.user).toContain('Bản dịch nháp')
  })

  it('instructs JSON-only output with translatedSegments', () => {
    const result = buildStructuredPolishPrompts(['テスト'], ['Kiểm tra'], 'TECHNICAL')
    expect(result.user).toContain('JSON')
    expect(result.user).toContain('translatedSegments')
  })
})

describe('PolishResultSchema', () => {
  it('parses valid polish result', () => {
    const result = PolishResultSchema.parse({ translated: 'Xin chào' })
    expect(result.translated).toBe('Xin chào')
  })
})

describe('StructuredPolishResultSchema', () => {
  it('parses valid structured polish result', () => {
    const result = StructuredPolishResultSchema.parse({
      translatedSegments: ['Xin chào'],
    })
    expect(result.translatedSegments).toEqual(['Xin chào'])
  })
})
```

Also update the existing `'translation style profiles'` test to remove the AUTO_CONTEXT assertion:

```typescript
// Replace the existing 'defines stable profile content for all four presets' test:
describe('translation style profiles', () => {
  it('defines stable profile content for all three presets', async () => {
    const { TRANSLATION_STYLE_PROFILES } = await import('~/sections/translation-style-profiles')

    expect(TRANSLATION_STYLE_PROFILES.NATURAL_CASUAL).toMatchObject({
      name: 'Natural / Casual',
    })
    expect(TRANSLATION_STYLE_PROFILES.PROFESSIONAL_BUSINESS).toMatchObject({
      name: 'Professional / Business',
    })
    expect(TRANSLATION_STYLE_PROFILES.TECHNICAL).toMatchObject({
      name: 'Technical',
    })
  })
})
```

And update the test that uses `AUTO_CONTEXT`:

```typescript
// Replace: it('keeps fidelity-first wording inside the style policy', () => {
//   const result = buildSingleCallPrompts('テスト', 'AUTO_CONTEXT')
// Change to use NATURAL_CASUAL instead:
it('keeps fidelity-first wording inside the style policy', () => {
  const result = buildSingleCallPrompts('テスト', 'NATURAL_CASUAL')
  expect(result.system).toMatch(/preserve fidelity|source meaning|politeness intent/i)
})
```

- [ ] **Step 2: Run tests to verify new tests fail**

```bash
bun test packages/translation-prompt/src/translation-prompt.test.ts
```

Expected: New polish builder tests FAIL (functions don't exist yet). Existing tests should now PASS (AUTO_CONTEXT refs removed).

- [ ] **Step 3: Add polish prompt builders to translation-prompt.ts**

Edit `packages/translation-prompt/src/translation-prompt.ts` — add imports and new functions:

```typescript
import { DEFAULT_TRANSLATION_STYLE } from '@chatwork-bot/core'
import type { TranslationStyle } from '@chatwork-bot/core'
import { SINGLE_CALL_SYSTEM } from '~/sections/single-call'
import { POLISH_SYSTEM, buildPolishStyleSection } from '~/sections/polish'
import { buildTranslationStyleSection } from '~/sections/translation-style-profiles'
import { StructuredTranslationDraftSchema, TranslationDraftSchema } from '~/schemas/review.schema'
import { PolishResultSchema, StructuredPolishResultSchema } from '~/schemas/polish.schema'

/** Prompt input pair for LLM execution. */
export interface PromptPair {
  system: string
  user: string
}

export { TranslationDraftSchema }
export { StructuredTranslationDraftSchema }
export { PolishResultSchema }
export { StructuredPolishResultSchema }
export type { StructuredTranslationDraft, TranslationDraft } from '~/schemas/review.schema'
export type { PolishResult, StructuredPolishResult } from '~/schemas/polish.schema'

/**
 * Step 1 — Draft: expert prompt + self-critique gate.
 */
export function buildSingleCallPrompts(
  text: string,
  style: TranslationStyle = DEFAULT_TRANSLATION_STYLE,
): PromptPair {
  return {
    system: [SINGLE_CALL_SYSTEM, buildTranslationStyleSection(style)].join('\n\n'),
    user: `Translate the following text into natural Vietnamese.
Respond ONLY with valid JSON:
{"sourceLang": "<full English language name>", "translated": "<Vietnamese translation>"}

Text:
${text}`,
  }
}

export function buildStructuredTranslationPrompts(
  segments: string[],
  style: TranslationStyle = DEFAULT_TRANSLATION_STYLE,
): PromptPair {
  return {
    system: [SINGLE_CALL_SYSTEM, buildTranslationStyleSection(style)].join('\n\n'),
    user: `Translate each source segment into natural Vietnamese.
Preserve array length and order exactly.
Do not merge, split, drop, or reorder segments.
Respond ONLY with valid JSON:
{"sourceLang": "<full English language name>", "translatedSegments": ["<Vietnamese segment 1>", "<Vietnamese segment 2>"]}

Source segments:
${JSON.stringify(segments, null, 2)}`,
  }
}

/**
 * Step 2 — Polish: refine draft with source visible.
 */
export function buildPolishPrompts(
  sourceText: string,
  draftTranslation: string,
  style: TranslationStyle = DEFAULT_TRANSLATION_STYLE,
): PromptPair {
  return {
    system: [POLISH_SYSTEM, buildPolishStyleSection(style)].join('\n\n'),
    user: `Here is a draft translation that needs polishing.

Original text:
${sourceText}

Draft translation:
${draftTranslation}

Polish the translation so it reads naturally as original Vietnamese text.
Respond ONLY with valid JSON:
{"translated": "<polished Vietnamese translation>"}`,
  }
}

export function buildStructuredPolishPrompts(
  sourceSegments: string[],
  draftSegments: string[],
  style: TranslationStyle = DEFAULT_TRANSLATION_STYLE,
): PromptPair {
  return {
    system: [POLISH_SYSTEM, buildPolishStyleSection(style)].join('\n\n'),
    user: `Here are draft translations that need polishing.

Original segments:
${JSON.stringify(sourceSegments, null, 2)}

Draft translations:
${JSON.stringify(draftSegments, null, 2)}

Polish each translation so it reads naturally as original Vietnamese text.
Preserve array length and order exactly.
Respond ONLY with valid JSON:
{"translatedSegments": ["<polished segment 1>", "<polished segment 2>"]}`,
  }
}
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
bun test packages/translation-prompt/src/translation-prompt.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add packages/translation-prompt/src/translation-prompt.ts packages/translation-prompt/src/translation-prompt.test.ts
git commit -m "feat(translation-prompt): add polish prompt builders for two-step pipeline

Adds buildPolishPrompts() and buildStructuredPolishPrompts() that
receive source text + draft translation + style. Updates tests to
remove AUTO_CONTEXT references and add polish builder coverage.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 9: Update package exports

**Files:**

- Modify: `packages/translation-prompt/src/index.ts`

- [ ] **Step 1: Update index.ts barrel exports**

Replace `packages/translation-prompt/src/index.ts`:

```typescript
export {
  buildPolishPrompts,
  buildSingleCallPrompts,
  buildStructuredPolishPrompts,
  buildStructuredTranslationPrompts,
  PolishResultSchema,
  StructuredPolishResultSchema,
  StructuredTranslationDraftSchema,
  TranslationDraftSchema,
} from './translation-prompt'
export {
  buildTranslationStyleSection,
  TRANSLATION_STYLE_PROFILES,
} from '~/sections/translation-style-profiles'
export type {
  PolishResult,
  PromptPair,
  StructuredPolishResult,
  StructuredTranslationDraft,
  TranslationDraft,
} from './translation-prompt'
```

- [ ] **Step 2: Run typecheck**

```bash
cd packages/translation-prompt && bun run typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/translation-prompt/src/index.ts
git commit -m "feat(translation-prompt): export polish builders and schemas from barrel

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 10: Integrate two-step pipeline in translator

**Files:**

- Modify: `packages/translator/src/pipeline/pipeline.ts`
- Modify: `packages/translator/src/pipeline/pipeline.test.ts`

- [ ] **Step 1: Write failing tests for two-step pipeline**

Add to `packages/translator/src/pipeline/pipeline.test.ts` — add new describe blocks:

```typescript
describe('two-step pipeline (draft → polish)', () => {
  it('calls executor twice for single text — draft then polish', async () => {
    let callCount = 0
    const executor: ILLMExecutor = {
      execute<T>(_prompts: PromptPair, _schema: ISchema<T>) {
        callCount++
        if (callCount === 1) {
          return Promise.resolve({ sourceLang: 'Japanese', translated: 'Bản nháp' } as T)
        }
        return Promise.resolve({ translated: 'Bản hoàn thiện' } as T)
      },
    }
    const pipeline = new TranslationPipeline(executor)
    const result = await pipeline.run('テスト')
    expect(callCount).toBe(2)
    expect(result.translatedText).toBe('Bản hoàn thiện')
    expect(result.sourceLang).toBe('Japanese')
  })

  it('calls executor twice for structured multi-segment translation', async () => {
    let callCount = 0
    const executor: ILLMExecutor = {
      execute<T>(_prompts: PromptPair, _schema: ISchema<T>) {
        callCount++
        if (callCount === 1) {
          return Promise.resolve({
            sourceLang: 'Japanese',
            translatedSegments: ['Nháp 1', 'Nháp 2'],
          } as T)
        }
        return Promise.resolve({ translatedSegments: ['Hoàn thiện 1', 'Hoàn thiện 2'] } as T)
      },
    }
    const pipeline = new TranslationPipeline(executor)
    const result = await pipeline.runStructured({
      cleanText: 'こんにちは\n資料をご確認ください。',
      translationInputs: ['こんにちは', '資料をご確認ください。'],
    })
    expect(callCount).toBe(2)
    expect(result.translatedSegments).toEqual(['Hoàn thiện 1', 'Hoàn thiện 2'])
  })

  it('passes source text and draft to polish prompt (second call)', async () => {
    const calls: PromptPair[] = []
    const executor: ILLMExecutor = {
      execute<T>(prompts: PromptPair, _schema: ISchema<T>) {
        calls.push(prompts)
        if (calls.length === 1) {
          return Promise.resolve({ sourceLang: 'Japanese', translated: 'Bản nháp' } as T)
        }
        return Promise.resolve({ translated: 'Bản hoàn thiện' } as T)
      },
    }
    const pipeline = new TranslationPipeline(executor)
    await pipeline.run('テスト')
    expect(calls).toHaveLength(2)
    // Polish call (second) should contain both source and draft
    expect(calls[1]!.user).toContain('テスト')
    expect(calls[1]!.user).toContain('Bản nháp')
  })

  it('falls back to draft when polish step fails', async () => {
    let callCount = 0
    const executor: ILLMExecutor = {
      execute<T>(_prompts: PromptPair, _schema: ISchema<T>) {
        callCount++
        if (callCount === 1) {
          return Promise.resolve({ sourceLang: 'Japanese', translated: 'Bản nháp' } as T)
        }
        return Promise.reject(new Error('Polish LLM failed'))
      },
    }
    const pipeline = new TranslationPipeline(executor)
    const result = await pipeline.run('テスト')
    expect(result.translatedText).toBe('Bản nháp')
    expect(result.sourceLang).toBe('Japanese')
  })

  it('falls back to draft segments when structured polish step fails', async () => {
    let callCount = 0
    const executor: ILLMExecutor = {
      execute<T>(_prompts: PromptPair, _schema: ISchema<T>) {
        callCount++
        if (callCount === 1) {
          return Promise.resolve({
            sourceLang: 'Japanese',
            translatedSegments: ['Nháp 1', 'Nháp 2'],
          } as T)
        }
        return Promise.reject(new Error('Polish LLM failed'))
      },
    }
    const pipeline = new TranslationPipeline(executor)
    const result = await pipeline.runStructured({
      cleanText: 'こんにちは\n資料',
      translationInputs: ['こんにちは', '資料'],
    })
    expect(result.translatedSegments).toEqual(['Nháp 1', 'Nháp 2'])
  })

  it('still skips LLM entirely for zero-input structured requests', async () => {
    const { executor, getCallCount } = makeExecutor()
    const pipeline = new TranslationPipeline(executor)
    const result = await pipeline.runStructured({
      cleanText: '[code]x[/code]',
      translationInputs: [],
    })
    expect(getCallCount()).toBe(0)
    expect(result.translatedSegments).toEqual([])
  })
})
```

Also update the existing test that asserts `callCount === 1`:

```typescript
// Change: it('calls executor exactly once for any text'
// To:
it('calls executor twice for any text (draft + polish)', async () => {
  const { executor, getCallCount } = makeExecutor()
  const pipeline = new TranslationPipeline(executor)
  await pipeline.run('お世話になっております。')
  expect(getCallCount()).toBe(2)
})

// Change: it('calls executor exactly once for short text'
// To:
it('calls executor twice for short text (draft + polish)', async () => {
  const { executor, getCallCount } = makeExecutor()
  const pipeline = new TranslationPipeline(executor)
  await pipeline.run('OK')
  expect(getCallCount()).toBe(2)
})
```

Note: The existing `makeExecutor` returns `{ sourceLang: 'Japanese', translated: '...' }` which works for both draft and polish schemas since both have a `translated` field.

- [ ] **Step 2: Run tests to verify new tests fail**

```bash
bun test packages/translator/src/pipeline/pipeline.test.ts
```

Expected: New two-step tests FAIL (pipeline still calls once). Updated count tests FAIL.

- [ ] **Step 3: Update pipeline.ts with two-step logic**

Replace `packages/translator/src/pipeline/pipeline.ts`:

```typescript
import { DEFAULT_TRANSLATION_STYLE, TranslationError } from '@chatwork-bot/core'
import type { ILLMExecutor } from '@chatwork-bot/core'
import type { ISchema, PromptPair } from '@chatwork-bot/core'
import type { TranslationResult } from '@chatwork-bot/core'
import type { TranslationStyle } from '@chatwork-bot/core'
import {
  buildPolishPrompts,
  buildSingleCallPrompts,
  buildStructuredPolishPrompts,
  buildStructuredTranslationPrompts,
  PolishResultSchema,
  StructuredPolishResultSchema,
  StructuredTranslationDraftSchema,
  TranslationDraftSchema,
} from '@chatwork-bot/translation-prompt'
import { DEFAULT_TRANSLATOR_PIPELINE_TIMEOUT_MS } from '~/services/pipeline-timeout'

export interface PipelineRunOptions {
  signal?: AbortSignal
  timeoutMs?: number
  phaseObserver?: {
    onPhaseStarted?: (params: { phase: 'translation' }) => Promise<void> | void
    onPhaseCompleted?: (params: { phase: 'translation' }) => Promise<void> | void
    onPhaseFailed?: (params: { phase: 'translation'; error: unknown }) => Promise<void> | void
  }
}

export const DEFAULT_TIMEOUT_MS = DEFAULT_TRANSLATOR_PIPELINE_TIMEOUT_MS

export interface StructuredPipelineInput {
  cleanText: string
  translationInputs: string[]
}

export interface PipelineTranslationResult {
  translation: TranslationResult
  translatedSegments: string[]
}

export class TranslationPipeline {
  constructor(
    private readonly executor: ILLMExecutor,
    private readonly opts: { timeoutMs?: number; translationStyle?: TranslationStyle } = {},
  ) {}

  async run(text: string, options: PipelineRunOptions = {}): Promise<TranslationResult> {
    const result = await this.runStructured({ cleanText: text, translationInputs: [text] }, options)
    return result.translation
  }

  async runStructured(
    input: StructuredPipelineInput,
    options: PipelineRunOptions = {},
  ): Promise<PipelineTranslationResult> {
    this.checkAbort(options.signal)

    const style = this.opts.translationStyle ?? DEFAULT_TRANSLATION_STYLE

    if (input.translationInputs.length === 0) {
      return {
        translation: this.buildTranslationResult(input.cleanText, '', 'Unknown'),
        translatedSegments: [],
      }
    }

    if (input.translationInputs.length === 1) {
      const [singleInput] = input.translationInputs
      const sourceText = singleInput ?? input.cleanText

      // Step 1: Draft
      const draft = await this.executeDraft(
        buildSingleCallPrompts(sourceText, style),
        TranslationDraftSchema,
        options,
      )

      // Step 2: Polish (fallback to draft on failure)
      const polished = await this.executePolish(
        buildPolishPrompts(sourceText, draft.translated, style),
        PolishResultSchema,
        options,
      )

      const finalText = polished?.translated ?? draft.translated

      return {
        translation: this.buildTranslationResult(input.cleanText, finalText, draft.sourceLang),
        translatedSegments: [finalText],
      }
    }

    // Step 1: Draft (structured)
    const structuredDraft = await this.executeDraft(
      buildStructuredTranslationPrompts(input.translationInputs, style),
      StructuredTranslationDraftSchema,
      options,
    )

    if (structuredDraft.translatedSegments.length !== input.translationInputs.length) {
      throw new TranslationError('Translation segment count mismatch', 'INVALID_RESPONSE')
    }

    // Step 2: Polish (fallback to draft on failure)
    const polished = await this.executePolish(
      buildStructuredPolishPrompts(
        input.translationInputs,
        structuredDraft.translatedSegments,
        style,
      ),
      StructuredPolishResultSchema,
      options,
    )

    const finalSegments = polished?.translatedSegments ?? structuredDraft.translatedSegments

    return {
      translation: this.buildTranslationResult(
        input.cleanText,
        finalSegments.join('\n'),
        structuredDraft.sourceLang,
      ),
      translatedSegments: finalSegments,
    }
  }

  private buildSignal(options: PipelineRunOptions): AbortSignal {
    const timeoutMs = options.timeoutMs ?? this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const timeoutController = new AbortController()
    const upstreamSignal = options.signal
    const timer = setTimeout(() => {
      timeoutController.abort(
        new TranslationError(
          `Translation pipeline timed out after ${timeoutMs.toString()}ms`,
          'TIMEOUT',
        ),
      )
    }, timeoutMs)

    if (typeof timer.unref === 'function') timer.unref()
    timeoutController.signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
      },
      { once: true },
    )

    if (upstreamSignal) {
      if (upstreamSignal.aborted) {
        timeoutController.abort(this.toAbortReason(upstreamSignal.reason))
      } else {
        upstreamSignal.addEventListener(
          'abort',
          () => {
            timeoutController.abort(this.toAbortReason(upstreamSignal.reason))
          },
          { once: true },
        )
      }
    }
    return timeoutController.signal
  }

  private checkAbort(signal?: AbortSignal): void {
    if (signal?.aborted) {
      if (signal.reason instanceof TranslationError) throw signal.reason
      throw new TranslationError('Translation pipeline aborted', 'ABORTED', signal.reason)
    }
  }

  private toAbortReason(reason: unknown): TranslationError {
    if (reason instanceof TranslationError) return reason
    return new TranslationError('Translation pipeline aborted', 'ABORTED', reason)
  }

  private async executeDraft<T>(
    prompts: PromptPair,
    schema: ISchema<T>,
    options: PipelineRunOptions,
  ): Promise<T> {
    const signal = this.buildSignal(options)

    this.checkAbort(signal)

    const phase = 'translation' as const
    const phaseParams = { phase }

    await options.phaseObserver?.onPhaseStarted?.(phaseParams)

    try {
      const draft = await this.executor.execute(prompts, schema, { signal })
      await options.phaseObserver?.onPhaseCompleted?.(phaseParams)
      return draft
    } catch (error) {
      await options.phaseObserver?.onPhaseFailed?.({ ...phaseParams, error })
      throw error
    }
  }

  private async executePolish<T>(
    prompts: PromptPair,
    schema: ISchema<T>,
    options: PipelineRunOptions,
  ): Promise<T | null> {
    try {
      const signal = this.buildSignal(options)
      return await this.executor.execute(prompts, schema, { signal })
    } catch {
      // Polish failure is non-fatal — fall back to draft
      return null
    }
  }

  private buildTranslationResult(
    cleanText: string,
    translatedText: string,
    sourceLang: string,
  ): TranslationResult {
    return {
      cleanText,
      translatedText,
      sourceLang,
      targetLang: 'Vietnamese',
      timestamp: new Date().toISOString(),
    }
  }
}
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
bun test packages/translator/src/pipeline/pipeline.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add packages/translator/src/pipeline/pipeline.ts packages/translator/src/pipeline/pipeline.test.ts
git commit -m "feat(translator): implement two-step draft→polish pipeline

Pipeline now calls LLM twice: draft for accuracy, polish for naturalness.
Polish step receives source + draft with style-specific criteria. Falls
back to draft result if polish fails (non-fatal).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 11: Full suite validation

**Files:** None — validation only.

- [ ] **Step 1: Run full typecheck across all packages**

```bash
bun run typecheck
```

Expected: PASS — no TS errors.

If there are errors related to `AUTO_CONTEXT`, search for remaining references:

```bash
grep -r "AUTO_CONTEXT" packages/ --include="*.ts" -l
```

Fix any remaining references by removing them or replacing with a valid style.

- [ ] **Step 2: Run full test suite**

```bash
bun test
```

Expected: ALL 600+ tests PASS.

- [ ] **Step 3: Run lint**

```bash
bun run lint
```

Expected: PASS.

- [ ] **Step 4: Run definition of done**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: ALL PASS.

- [ ] **Step 5: Final commit if any fixes were needed**

If any fixes were applied during validation:

```bash
git add -A
git commit -m "fix(repo): resolve remaining AUTO_CONTEXT references after style removal

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
