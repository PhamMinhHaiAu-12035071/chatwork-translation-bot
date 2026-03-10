# Enhanced Translation Pipeline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-prompt translation with a research-backed 4-phase pipeline (Skopos → 14D analysis → informed translation → 3-Persona MQM-Lite review loop) producing human-like Vietnamese output with full developer trace.

**Architecture:** Big-bang refactor — no backward compatibility, no feature flag. `ProviderPlugin.create()` now returns `ILLMExecutor` (not `ITranslationService`). `TranslationPipeline` takes an `ILLMExecutor` and orchestrates all 4 phases. The handler calls `pipeline.run()` directly; `translateWithPolicy` is bypassed.

**Tech Stack:** Bun v1.1+ · TypeScript 5.4 strict · Zod v4 · bun:test · Monorepo workspace imports (`@chatwork-bot/*`) · intra-package path alias `~/`

---

## File Map (all files touched)

**Create (new):**

- `packages/core/src/interfaces/llm-executor.ts` — `ISchema<T>`, `PromptPair`, `ILLMExecutor`
- `packages/translation-prompt/src/schemas/analysis.schema.ts` — Zod schemas: Skopos, Extratextual, Intratextual, CrossCutting, Analysis
- `packages/translation-prompt/src/schemas/review.schema.ts` — Zod schemas: MQMLite, Review, TranslationDraft
- `packages/translation-prompt/src/schemas/pipeline-trace.schema.ts` — PipelineTrace Zod schema
- `packages/translation-prompt/src/sections/core.ts` — PERSONA + CORE_DOCTRINE strings
- `packages/translation-prompt/src/sections/language-layers.ts` — JP + EN cultural rules strings
- `packages/translation-prompt/src/sections/humanizer.ts` — 3-tier formatting doctrine string
- `packages/translation-prompt/src/sections/constraints.ts` — hard constraints string
- `packages/translation-prompt/src/sections/analysis.ts` — `buildAnalysisPrompts(text)` → PromptPair
- `packages/translation-prompt/src/sections/review.ts` — `buildReviewPrompts(...)` → PromptPair
- `packages/translator/src/pipeline/pipeline.ts` — `TranslationPipeline` class
- `packages/translator/src/pipeline/pipeline.test.ts` — fixture-based tests

**Modify (existing):**

- `packages/core/src/interfaces/provider-plugin.ts` — `create()` return type → `ILLMExecutor`
- `packages/core/src/index.ts` — export `ILLMExecutor`, `ISchema`, `PromptPair`
- `packages/translation-prompt/src/translation-prompt.ts` — replace public API (3 new functions; remove old `buildTranslationPrompt` / `buildSystemPrompt` / `buildUserPrompt`)
- `packages/translation-prompt/src/translation-prompt.test.ts` — update tests for new API
- `packages/translation-prompt/src/index.ts` — export schemas + new API
- `packages/provider-gemini/src/gemini-plugin.ts` — implement `ILLMExecutor`, remove `translate()`, update `create()` return type
- `packages/provider-gemini/src/gemini-plugin.test.ts` — update to test `execute()`
- `packages/provider-openai/src/openai-plugin.ts` — identical pattern to Gemini
- `packages/provider-cursor/src/cursor-translation.ts` — remove hardcoded `JSON_FORMAT_INSTRUCTION`, implement `ILLMExecutor.execute<T>()`
- `packages/translator/src/types/output.ts` — add `pipeline?: PipelineTrace`
- `packages/translator/src/webhook/handler.ts` — call `TranslationPipeline.run()` instead of `translateWithPolicy`
- `packages/translator/src/webhook/handler.test.ts` — mock `executor.execute()` instead of `service.translate()`

---

## Chunk 1: Foundation — ILLMExecutor in @chatwork-bot/core

### Task 1: Create `ILLMExecutor` interface

**Files:**

- Create: `packages/core/src/interfaces/llm-executor.ts`
- Create: `packages/core/src/interfaces/llm-executor.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1.1: Write the failing test**

```typescript
// packages/core/src/interfaces/llm-executor.test.ts
import { describe, it, expect } from 'bun:test'
import type { ILLMExecutor, PromptPair, ISchema } from './llm-executor'

describe('ILLMExecutor types', () => {
  it('ISchema is satisfied by an object with parse()', () => {
    const schema: ISchema<number> = { parse: (d: unknown) => Number(d) }
    expect(schema.parse('42')).toBe(42)
  })

  it('PromptPair has system and user fields', () => {
    const pair: PromptPair = { system: 'sys', user: 'usr' }
    expect(pair.system).toBe('sys')
    expect(pair.user).toBe('usr')
  })

  it('an object implementing ILLMExecutor is type-compatible', async () => {
    const executor: ILLMExecutor = {
      async execute<T>(prompts: PromptPair, schema: ISchema<T>) {
        return schema.parse({ x: 1 })
      },
    }
    const result = await executor.execute(
      { system: 'sys', user: 'usr' },
      { parse: (d: unknown) => d as { x: number } },
    )
    expect(result.x).toBe(1)
  })
})
```

- [ ] **Step 1.2: Run test to verify it fails**

```bash
cd packages/core && bun test src/interfaces/llm-executor.test.ts
```

Expected: error — `Cannot find module './llm-executor'`

- [ ] **Step 1.3: Create the interface file**

```typescript
// packages/core/src/interfaces/llm-executor.ts

/** Structural duck-type for any schema with a parse() method. Zod schemas satisfy this. */
export interface ISchema<T> {
  parse(data: unknown): T
}

/** A system+user prompt pair for structured LLM calls. */
export type PromptPair = { system: string; user: string }

/** Generic LLM execution interface — all providers implement this. */
export interface ILLMExecutor {
  execute<T>(
    prompts: PromptPair,
    schema: ISchema<T>,
    options?: { signal?: AbortSignal },
  ): Promise<T>
}
```

- [ ] **Step 1.4: Run test to verify it passes**

```bash
cd packages/core && bun test src/interfaces/llm-executor.test.ts
```

Expected: 3 pass

- [ ] **Step 1.5: Export from `packages/core/src/index.ts`**

Add after the `ProviderPlugin` block:

```typescript
export type { ILLMExecutor, ISchema, PromptPair } from './interfaces/llm-executor'
```

- [ ] **Step 1.5b: Add `'ABORTED'` to `TranslationError` code union**

In `packages/core/src/interfaces/translation.ts`, change:

```typescript
public readonly code: 'API_ERROR' | 'QUOTA_EXCEEDED' | 'INVALID_RESPONSE' | 'UNKNOWN',
```

to:

```typescript
public readonly code: 'API_ERROR' | 'QUOTA_EXCEEDED' | 'INVALID_RESPONSE' | 'UNKNOWN' | 'ABORTED',
```

- [ ] **Step 1.6: Update `ProviderPlugin.create()` return type**

In `packages/core/src/interfaces/provider-plugin.ts`, add import and change return type:

```typescript
import type { ILLMExecutor } from './llm-executor'

// ... keep all existing types unchanged ...

export interface ProviderPlugin {
  readonly manifest: ProviderManifest
  create(ctx: ProviderCreateContext): ILLMExecutor // changed from ITranslationService
}
```

- [ ] **Step 1.7: Run typecheck to verify**

```bash
cd packages/core && bun run typecheck
```

Expected: errors in provider packages (expected — they haven't been updated yet). Core itself must be clean.

- [ ] **Step 1.8: Commit**

```bash
git add packages/core/src/interfaces/llm-executor.ts \
        packages/core/src/interfaces/llm-executor.test.ts \
        packages/core/src/interfaces/provider-plugin.ts \
        packages/core/src/index.ts
git commit -m "feat(core): add ILLMExecutor interface and PromptPair type"
```

---

## Chunk 2: Schemas — @chatwork-bot/translation-prompt

### Task 2: Create Zod schemas

**Files:**

- Create: `packages/translation-prompt/src/schemas/analysis.schema.ts`
- Create: `packages/translation-prompt/src/schemas/review.schema.ts`
- Create: `packages/translation-prompt/src/schemas/pipeline-trace.schema.ts`
- Create: `packages/translation-prompt/src/schemas/analysis.schema.test.ts`
- Create: `packages/translation-prompt/src/schemas/review.schema.test.ts`

- [ ] **Step 2.1: Write tests for analysis schema**

```typescript
// packages/translation-prompt/src/schemas/analysis.schema.test.ts
import { describe, it, expect } from 'bun:test'
import { AnalysisSchema, SkoposSchema } from './analysis.schema'

describe('SkoposSchema', () => {
  it('parses valid skopos', () => {
    const result = SkoposSchema.parse({
      purpose: 'informational',
      audience: 'Vietnamese tech team',
      strategy: 'instrumental',
      register: 'semi-formal',
    })
    expect(result.strategy).toBe('instrumental')
  })

  it('rejects unknown strategy', () => {
    expect(() =>
      SkoposSchema.parse({
        purpose: 'informational',
        audience: 'team',
        strategy: 'unknown',
        register: 'formal',
      }),
    ).toThrow()
  })
})

describe('AnalysisSchema', () => {
  const validAnalysis = {
    skopos: {
      purpose: 'technical',
      audience: 'developers',
      strategy: 'instrumental',
      register: 'semi-formal',
    },
    extratextual: {
      sender: 'PM',
      intention: 'request confirmation',
      audience: 'engineer',
      medium: 'chat',
      temporalContext: 'end of sprint',
    },
    intratextual: {
      subjectMatter: 'release schedule',
      contentSummary: 'asking about deploy timing',
      presuppositions: 'reader knows the project',
      textStructure: 'single paragraph request',
      lexisNotes: 'formal Japanese business register',
      nonVerbalElements: 'none',
    },
    crossCutting: {
      textFunction: 'directive',
      registerTone: 'polite formal',
      expectedEffect: 'reader provides confirmation',
    },
  }

  it('parses a complete valid analysis', () => {
    const result = AnalysisSchema.parse(validAnalysis)
    expect(result.skopos.strategy).toBe('instrumental')
    expect(result.extratextual.sender).toBe('PM')
    expect(result.intratextual.subjectMatter).toBe('release schedule')
    expect(result.crossCutting.textFunction).toBe('directive')
  })

  it('rejects missing extratextual', () => {
    const { extratextual: _, ...without } = validAnalysis
    expect(() => AnalysisSchema.parse(without)).toThrow()
  })
})
```

- [ ] **Step 2.2: Write tests for review schema**

```typescript
// packages/translation-prompt/src/schemas/review.schema.test.ts
import { describe, it, expect } from 'bun:test'
import { ReviewSchema, MQMLiteSchema, TranslationDraftSchema } from './review.schema'

describe('MQMLiteSchema', () => {
  it('parses valid scores', () => {
    const result = MQMLiteSchema.parse({
      naturalFlow: 3,
      culturalFidelity: 2,
      readerExperience: 2,
      semanticAccuracy: 2,
      targetConventions: 1,
    })
    expect(result.naturalFlow).toBe(3)
  })

  it('rejects naturalFlow > 3', () => {
    expect(() =>
      MQMLiteSchema.parse({
        naturalFlow: 4,
        culturalFidelity: 2,
        readerExperience: 2,
        semanticAccuracy: 2,
        targetConventions: 1,
      }),
    ).toThrow()
  })
})

describe('ReviewSchema', () => {
  const validReview = {
    scores: {
      naturalFlow: 2,
      culturalFidelity: 2,
      readerExperience: 1,
      semanticAccuracy: 2,
      targetConventions: 1,
    },
    totalScore: 8,
    passed: false,
    critique: 'Flow is slightly stiff in sentence 2.',
    refinedTranslation: 'Kính gửi anh/chị, tôi xin phép xác nhận lịch release.',
    personaFeedback: {
      freshReader: 'Reads naturally but ending feels formal.',
      linguist: 'Register correctly mapped from sonkeigo.',
      editor: 'Opening phrase can be shortened.',
    },
  }

  it('parses valid review', () => {
    const result = ReviewSchema.parse(validReview)
    expect(result.passed).toBe(false)
    expect(result.totalScore).toBe(8)
  })

  it('accepts passed=true when totalScore is 9', () => {
    const passing = {
      ...validReview,
      scores: {
        naturalFlow: 3,
        culturalFidelity: 2,
        readerExperience: 2,
        semanticAccuracy: 1,
        targetConventions: 1,
      },
      totalScore: 9,
      passed: true,
    }
    expect(ReviewSchema.parse(passing).passed).toBe(true)
  })
})

describe('TranslationDraftSchema', () => {
  it('parses valid draft', () => {
    const result = TranslationDraftSchema.parse({
      sourceLang: 'Japanese',
      translated: 'Xin chào',
    })
    expect(result.sourceLang).toBe('Japanese')
  })

  it('rejects empty translated', () => {
    expect(() => TranslationDraftSchema.parse({ sourceLang: 'Japanese', translated: '' })).toThrow()
  })
})
```

- [ ] **Step 2.3: Run tests to verify they fail**

```bash
cd packages/translation-prompt && bun test src/schemas/
```

Expected: Cannot find module errors

- [ ] **Step 2.4: Create `analysis.schema.ts`**

```typescript
// packages/translation-prompt/src/schemas/analysis.schema.ts
import { z } from 'zod'

export const SkoposSchema = z.object({
  purpose: z.enum(['informational', 'persuasive', 'emotional', 'technical', 'casual']),
  audience: z.string().min(1),
  strategy: z.enum(['instrumental', 'documentary']),
  register: z.enum(['formal', 'semi-formal', 'casual', 'intimate']),
})

export const ExtratextualSchema = z.object({
  sender: z.string(),
  intention: z.string(),
  audience: z.string(),
  medium: z.string(),
  temporalContext: z.string(),
})

export const IntratextualSchema = z.object({
  subjectMatter: z.string(),
  contentSummary: z.string(),
  presuppositions: z.string(),
  textStructure: z.string(),
  lexisNotes: z.string(),
  nonVerbalElements: z.string(),
})

export const CrossCuttingSchema = z.object({
  textFunction: z.string(),
  registerTone: z.string(),
  expectedEffect: z.string(),
})

export const AnalysisSchema = z.object({
  skopos: SkoposSchema,
  extratextual: ExtratextualSchema,
  intratextual: IntratextualSchema,
  crossCutting: CrossCuttingSchema,
})

export type Skopos = z.infer<typeof SkoposSchema>
export type AnalysisResult = z.infer<typeof AnalysisSchema>
```

- [ ] **Step 2.5: Create `review.schema.ts`**

```typescript
// packages/translation-prompt/src/schemas/review.schema.ts
import { z } from 'zod'

export const MQMLiteSchema = z.object({
  naturalFlow: z.number().int().min(0).max(3), // 3pts — reads naturally in Vietnamese
  culturalFidelity: z.number().int().min(0).max(2), // 2pts — cultural context preserved
  readerExperience: z.number().int().min(0).max(2), // 2pts — Vietnamese reader experience
  semanticAccuracy: z.number().int().min(0).max(2), // 2pts — no meaning lost/added
  targetConventions: z.number().int().min(0).max(1), // 1pt  — target language conventions
})

export const ReviewSchema = z.object({
  scores: MQMLiteSchema,
  totalScore: z.number().int().min(0).max(10),
  passed: z.boolean(),
  critique: z.string().min(1),
  refinedTranslation: z.string().min(1),
  personaFeedback: z.object({
    freshReader: z.string(),
    linguist: z.string(),
    editor: z.string(),
  }),
})

export const TranslationDraftSchema = z.object({
  sourceLang: z.string().min(1),
  translated: z.string().min(1),
})

export type MQMLite = z.infer<typeof MQMLiteSchema>
export type ReviewResult = z.infer<typeof ReviewSchema>
export type TranslationDraft = z.infer<typeof TranslationDraftSchema>
```

- [ ] **Step 2.6: Create `pipeline-trace.schema.ts`**

```typescript
// packages/translation-prompt/src/schemas/pipeline-trace.schema.ts
import { z } from 'zod'
import { AnalysisSchema } from './analysis.schema'
import { ReviewSchema } from './review.schema'

export const PipelineTraceSchema = z.object({
  analysis: AnalysisSchema,
  rounds: z.array(ReviewSchema).max(5),
  finalScore: z.number().min(0).max(10),
  totalRounds: z.number().int().min(0),
  escalated: z.boolean(),
  durationMs: z.number().int().min(0),
})

export type PipelineTrace = z.infer<typeof PipelineTraceSchema>
```

- [ ] **Step 2.7: Run tests to verify they pass**

```bash
cd packages/translation-prompt && bun test src/schemas/
```

Expected: all pass

- [ ] **Step 2.8: Commit**

```bash
git add packages/translation-prompt/src/schemas/
git commit -m "feat(translation-prompt): add Zod schemas for analysis, review, pipeline trace"
```

---

## Chunk 3: Sections + Prompt Builders — @chatwork-bot/translation-prompt

### Task 3: Create `sections/` directory and migrate existing content

**Files:**

- Create: `packages/translation-prompt/src/sections/core.ts`
- Create: `packages/translation-prompt/src/sections/language-layers.ts`
- Create: `packages/translation-prompt/src/sections/humanizer.ts`
- Create: `packages/translation-prompt/src/sections/constraints.ts`

These are pure string migrations from the existing `translation-prompt.ts`. No tests needed for static strings — they are tested indirectly through the prompt builder tests.

- [ ] **Step 3.1: Create `sections/core.ts`**

```typescript
// packages/translation-prompt/src/sections/core.ts

export const PERSONA = `You are an elite professional translator with over 20 years of specialized experience in Japanese-to-Vietnamese and multilingual corporate communication. You possess deep expertise in:
- Japanese linguistics including all three levels of keigo (敬語)
- Vietnamese modern business writing and idiomatic expression
- Cross-cultural corporate communication in East Asian contexts
- IT, technology, and business terminology

Your translations are indistinguishable from text written by a native Vietnamese professional in a modern tech company. You reconstruct meaning in its new cultural-linguistic context — you do not merely convert words.`

export const CORE_DOCTRINE = `## Core Translation Doctrine

1. Natural Vietnamese First
Every sentence must read as if written originally by a Vietnamese professional. Never mirror source sentence structure. If Vietnamese grammar demands a different order, use it.

2. Modern Professional Tone
Write as educated Vietnamese office workers communicate: polished and respectful, but not stiff or bureaucratic. Use contemporary Vietnamese, not textbook or archaic forms.

3. Cultural Fidelity
Preserve the communicative intent and interpersonal register (superior/peer/subordinate) of the original. Capture implied courtesy and culturally encoded meaning — do not flatten nuance.

4. Preserve Meaning Precisely
Do not add, remove, soften, or amplify meaning. Direct → direct. Apologetic → apologetic. Urgent → urgent.`
```

- [ ] **Step 3.2: Create `sections/language-layers.ts`**

```typescript
// packages/translation-prompt/src/sections/language-layers.ts

export const JAPANESE_RULES = `## Japanese-Specific Rules

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
- よろしくお願いいたします → "Trân trọng cảm ơn" or "Mong nhận được sự hợp tác"`
```

- [ ] **Step 3.3: Create `sections/humanizer.ts`**

```typescript
// packages/translation-prompt/src/sections/humanizer.ts

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
```

- [ ] **Step 3.4: Create `sections/constraints.ts`**

```typescript
// packages/translation-prompt/src/sections/constraints.ts

export const CONSTRAINTS = `## Hard Constraints
- Do NOT add translator notes, commentary, or explanations inside the translation
- Do NOT translate internationally recognized English IT/business terms
- Do NOT add formality that was not present in the original
- Do NOT reduce formality that WAS present in the original
- Do NOT summarize, paraphrase beyond natural adaptation, or omit any content
- Do NOT strip or modify Chatwork markup tags ([info][/info], [code][/code], [qt][/qt], [To:xxx]) — translate only the text content inside them
- Do NOT prefix the JSON response with any text — output JSON immediately`
```

### Task 4: Create `sections/analysis.ts` — Phase 0+1 prompt builder

**Files:**

- Create: `packages/translation-prompt/src/sections/analysis.ts`
- Create: `packages/translation-prompt/src/sections/analysis.test.ts`

- [ ] **Step 4.1: Write failing test**

```typescript
// packages/translation-prompt/src/sections/analysis.test.ts
import { describe, it, expect } from 'bun:test'
import { buildAnalysisPrompts } from './analysis'

describe('buildAnalysisPrompts', () => {
  it('returns a PromptPair with system and user fields', () => {
    const prompts = buildAnalysisPrompts('Hello world')
    expect(typeof prompts.system).toBe('string')
    expect(typeof prompts.user).toBe('string')
  })

  it('embeds the source text in the user prompt', () => {
    const text = 'こんにちは、お世話になっております。'
    const prompts = buildAnalysisPrompts(text)
    expect(prompts.user).toContain(text)
  })

  it('system prompt contains all 5 extratextual dimension names', () => {
    const prompts = buildAnalysisPrompts('test')
    expect(prompts.system).toContain('sender')
    expect(prompts.system).toContain('intention')
    expect(prompts.system).toContain('audience')
    expect(prompts.system).toContain('medium')
    expect(prompts.system).toContain('temporalContext')
  })

  it('system prompt contains all 6 intratextual dimension names', () => {
    const prompts = buildAnalysisPrompts('test')
    expect(prompts.system).toContain('subjectMatter')
    expect(prompts.system).toContain('contentSummary')
    expect(prompts.system).toContain('presuppositions')
    expect(prompts.system).toContain('textStructure')
    expect(prompts.system).toContain('lexisNotes')
    expect(prompts.system).toContain('nonVerbalElements')
  })

  it('system prompt contains all 3 cross-cutting dimension names', () => {
    const prompts = buildAnalysisPrompts('test')
    expect(prompts.system).toContain('textFunction')
    expect(prompts.system).toContain('registerTone')
    expect(prompts.system).toContain('expectedEffect')
  })

  it('system prompt describes all 4 skopos fields', () => {
    const prompts = buildAnalysisPrompts('test')
    expect(prompts.system).toContain('instrumental')
    expect(prompts.system).toContain('documentary')
    expect(prompts.system).toContain('formal')
  })

  it('user prompt instructs to output JSON only', () => {
    const prompts = buildAnalysisPrompts('test')
    expect(prompts.user.toLowerCase()).toContain('json')
  })
})
```

- [ ] **Step 4.2: Run test to verify it fails**

```bash
cd packages/translation-prompt && bun test src/sections/analysis.test.ts
```

Expected: Cannot find module

- [ ] **Step 4.3: Create `sections/analysis.ts`**

```typescript
// packages/translation-prompt/src/sections/analysis.ts
import type { PromptPair } from '@chatwork-bot/core'

const ANALYSIS_SYSTEM = `You are a professional translation analyst specializing in Skopos Theory and source-text analysis for Japanese-to-Vietnamese translation.

Your task: analyze the given text across 14 dimensions grouped into 3 categories, plus determine the Skopos (translation purpose/strategy).

## Required JSON Output Schema

Output a single JSON object with exactly these fields:

{
  "skopos": {
    "purpose": "<one of: informational | persuasive | emotional | technical | casual>",
    "audience": "<description of intended Vietnamese reader>",
    "strategy": "<one of: instrumental | documentary>",
    "register": "<one of: formal | semi-formal | casual | intimate>"
  },
  "extratextual": {
    "sender": "<who wrote this — role/relationship>",
    "intention": "<what the sender wants to achieve>",
    "audience": "<who the intended recipient is>",
    "medium": "<communication channel: chat, email, etc.>",
    "temporalContext": "<time/place/situation context>"
  },
  "intratextual": {
    "subjectMatter": "<main topic of the text>",
    "contentSummary": "<brief summary of what is communicated>",
    "presuppositions": "<what shared knowledge the text assumes>",
    "textStructure": "<macro-structure: paragraph, list, single sentence, etc.>",
    "lexisNotes": "<notable vocabulary, jargon, or register markers>",
    "nonVerbalElements": "<emoticons, punctuation patterns, formatting, or 'none'>"
  },
  "crossCutting": {
    "textFunction": "<primary function: directive | expressive | informative | phatic | operative>",
    "registerTone": "<tone description: polite-formal, casual-friendly, urgent, apologetic, etc.>",
    "expectedEffect": "<what the text should achieve in the Vietnamese reader>"
  }
}

## Strategy Guide
- instrumental: translate to serve the Vietnamese reader's needs (default — most business/tech messages)
- documentary: preserve source-culture flavor (quotes, cultural references, literary texts)

Output JSON only. No markdown. No explanation.`

export function buildAnalysisPrompts(text: string): PromptPair {
  return {
    system: ANALYSIS_SYSTEM,
    user: `Analyze this text for translation planning:\n\n${text}`,
  }
}
```

- [ ] **Step 4.4: Run test to verify it passes**

```bash
cd packages/translation-prompt && bun test src/sections/analysis.test.ts
```

Expected: all pass

### Task 5: Create `sections/review.ts` — Phase 3 prompt builder

**Files:**

- Create: `packages/translation-prompt/src/sections/review.ts`
- Create: `packages/translation-prompt/src/sections/review.test.ts`

- [ ] **Step 5.1: Write failing test**

```typescript
// packages/translation-prompt/src/sections/review.test.ts
import { describe, it, expect } from 'bun:test'
import { buildReviewPrompts } from './review'
import type { AnalysisResult } from '~/schemas/analysis.schema'

const fakeAnalysis: AnalysisResult = {
  skopos: {
    purpose: 'informational',
    audience: 'Vietnamese engineer',
    strategy: 'instrumental',
    register: 'semi-formal',
  },
  extratextual: {
    sender: 'PM',
    intention: 'request status',
    audience: 'developer',
    medium: 'chat',
    temporalContext: 'end of day',
  },
  intratextual: {
    subjectMatter: 'deployment',
    contentSummary: 'asking deploy status',
    presuppositions: 'reader knows the project',
    textStructure: 'single paragraph',
    lexisNotes: 'standard business Japanese',
    nonVerbalElements: 'none',
  },
  crossCutting: {
    textFunction: 'directive',
    registerTone: 'polite formal',
    expectedEffect: 'reader provides status update',
  },
}

describe('buildReviewPrompts', () => {
  it('returns PromptPair with system and user fields', () => {
    const prompts = buildReviewPrompts('original text', fakeAnalysis, 'draft vi', 1)
    expect(typeof prompts.system).toBe('string')
    expect(typeof prompts.user).toBe('string')
  })

  it('user prompt contains the original text', () => {
    const prompts = buildReviewPrompts('original text', fakeAnalysis, 'draft vi', 1)
    expect(prompts.user).toContain('original text')
  })

  it('user prompt contains the current draft', () => {
    const prompts = buildReviewPrompts('original text', fakeAnalysis, 'bản dịch hiện tại', 1)
    expect(prompts.user).toContain('bản dịch hiện tại')
  })

  it('system prompt includes all 3 persona names', () => {
    const prompts = buildReviewPrompts('test', fakeAnalysis, 'draft', 1)
    expect(prompts.system).toContain('Fresh Reader')
    expect(prompts.system).toContain('Linguist')
    expect(prompts.system).toContain('Tuổi Trẻ')
  })

  it('system prompt includes all 5 MQM-Lite axes', () => {
    const prompts = buildReviewPrompts('test', fakeAnalysis, 'draft', 1)
    expect(prompts.system).toContain('naturalFlow')
    expect(prompts.system).toContain('culturalFidelity')
    expect(prompts.system).toContain('readerExperience')
    expect(prompts.system).toContain('semanticAccuracy')
    expect(prompts.system).toContain('targetConventions')
  })

  it('includes round number in user prompt', () => {
    const prompts = buildReviewPrompts('test', fakeAnalysis, 'draft', 3)
    expect(prompts.user).toContain('3')
  })

  it('includes escalated note when escalated=true', () => {
    const prompts = buildReviewPrompts('test', fakeAnalysis, 'draft', 4, true)
    expect(prompts.system).toMatch(/escalat/i)
  })
})
```

- [ ] **Step 5.2: Run test to verify it fails**

```bash
cd packages/translation-prompt && bun test src/sections/review.test.ts
```

Expected: Cannot find module

- [ ] **Step 5.3: Create `sections/review.ts`**

```typescript
// packages/translation-prompt/src/sections/review.ts
import type { PromptPair } from '@chatwork-bot/core'
import type { AnalysisResult } from '~/schemas/analysis.schema'

function buildReviewSystem(escalated = false): string {
  const escalationNote = escalated
    ? '\n\n## ESCALATION MODE\nPrevious rounds were stuck. Skopos strategy has been switched. Apply stricter critique and force meaningful changes in the refinement.'
    : ''

  return `You are a translation quality reviewer. Evaluate the Vietnamese draft using 3 distinct critical personas simultaneously, then produce a refined translation and MQM-Lite scores.

## The 3 Reviewer Personas

**Persona A — Fresh Reader**
A Vietnamese professional in their 30s at a tech company. Has never seen the original text. Only reads the Vietnamese draft. Asks: "Does this sound like a real Vietnamese professional wrote it? Or does it feel translated?"

**Persona B — Linguist**
A Vietnamese linguist specializing in Japanese-Vietnamese translation. Compares original to draft word by word. Checks register accuracy, cultural fidelity, and semantic completeness.

**Persona C — Tuổi Trẻ Editor**
A senior editor from Tuổi Trẻ newspaper. Ruthlessly cuts machine-translation patterns. Flags: Hán-Việt overuse, passive where active is more natural, AI clichés ("không chỉ... mà còn..."), stilted connectives.

## Adversarial Critique Rule
BEFORE scoring, each persona MUST find at least one specific thing to criticize — even if the draft is excellent. Forced adversarial critique prevents self-bias.

## MQM-Lite Scoring (10 points total)

Score each axis as an integer:
- naturalFlow: 0-3 (3=reads exactly like native Vietnamese professional prose)
- culturalFidelity: 0-2 (2=cultural context and register fully preserved)
- readerExperience: 0-2 (2=Vietnamese reader can fully grasp intent without original)
- semanticAccuracy: 0-2 (2=zero meaning added, removed, or distorted)
- targetConventions: 0-1 (1=IT terms in English, markup preserved, no translator notes)

Scoring calibration:
- 10/10: publishable without any edits
- 9/10: one minor polish needed
- 8/10: noticeable improvement needed
- ≤7/10: significant revision needed

## Required JSON Output

{
  "scores": {
    "naturalFlow": <0-3>,
    "culturalFidelity": <0-2>,
    "readerExperience": <0-2>,
    "semanticAccuracy": <0-2>,
    "targetConventions": <0-1>
  },
  "totalScore": <sum of scores, 0-10>,
  "passed": <true if totalScore >= 9, false otherwise>,
  "critique": "<consolidated critique from all 3 personas — specific, actionable>",
  "refinedTranslation": "<improved Vietnamese translation applying all critique>",
  "personaFeedback": {
    "freshReader": "<Fresh Reader's specific critique>",
    "linguist": "<Linguist's specific critique>",
    "editor": "<Tuổi Trẻ Editor's specific critique>"
  }
}

Output JSON only. No markdown. No explanation.${escalationNote}`
}

export function buildReviewPrompts(
  originalText: string,
  analysis: AnalysisResult,
  currentDraft: string,
  round: number,
  escalated = false,
): PromptPair {
  return {
    system: buildReviewSystem(escalated),
    user: `## Round ${round} Review

## Skopos Context
- Strategy: ${analysis.skopos.strategy}
- Register: ${analysis.skopos.register}
- Audience: ${analysis.skopos.audience}
- Expected effect: ${analysis.crossCutting.expectedEffect}

## Original Text
${originalText}

## Current Vietnamese Draft
${currentDraft}

Apply all 3 personas, produce adversarial critique, then output the refined translation and MQM-Lite scores as JSON.`,
  }
}
```

- [ ] **Step 5.4: Run test to verify it passes**

```bash
cd packages/translation-prompt && bun test src/sections/review.test.ts
```

Expected: all pass

### Task 6: Rewrite `translation-prompt.ts` public API

**Files:**

- Modify: `packages/translation-prompt/src/translation-prompt.ts`
- Modify: `packages/translation-prompt/src/translation-prompt.test.ts`
- Modify: `packages/translation-prompt/src/index.ts`

- [ ] **Step 6.1: Write updated tests first**

Replace `packages/translation-prompt/src/translation-prompt.test.ts` entirely:

```typescript
// packages/translation-prompt/src/translation-prompt.test.ts
import { describe, it, expect } from 'bun:test'
import {
  buildAnalysisPrompts,
  buildTranslationPrompts,
  buildReviewPrompts,
  TranslationDraftSchema,
} from './translation-prompt'
import type { AnalysisResult } from './schemas/analysis.schema'

const fakeAnalysis: AnalysisResult = {
  skopos: {
    purpose: 'informational',
    audience: 'Vietnamese engineer',
    strategy: 'instrumental',
    register: 'semi-formal',
  },
  extratextual: {
    sender: 'PM',
    intention: 'request deploy status',
    audience: 'engineer',
    medium: 'chat',
    temporalContext: 'end of sprint',
  },
  intratextual: {
    subjectMatter: 'deployment',
    contentSummary: 'asking for deploy timing confirmation',
    presuppositions: 'reader knows the project timeline',
    textStructure: 'single paragraph',
    lexisNotes: 'business Japanese sonkeigo register',
    nonVerbalElements: 'none',
  },
  crossCutting: {
    textFunction: 'directive',
    registerTone: 'polite-formal',
    expectedEffect: 'reader confirms deploy schedule',
  },
}

describe('buildAnalysisPrompts', () => {
  it('returns PromptPair', () => {
    const result = buildAnalysisPrompts('テスト')
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
  })

  it('embeds source text in user prompt', () => {
    const text = 'お世話になっております。'
    const result = buildAnalysisPrompts(text)
    expect(result.user).toContain(text)
  })
})

describe('buildTranslationPrompts', () => {
  it('returns PromptPair', () => {
    const result = buildTranslationPrompts('テスト', fakeAnalysis)
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
  })

  it('embeds source text in user prompt', () => {
    const text = 'リリースの件でご確認をお願いしたく'
    const result = buildTranslationPrompts(text, fakeAnalysis)
    expect(result.user).toContain(text)
  })

  it('embeds skopos strategy in user prompt', () => {
    const result = buildTranslationPrompts('test', fakeAnalysis)
    expect(result.user).toContain('instrumental')
  })

  it('system prompt mentions Vietnamese as target language', () => {
    const result = buildTranslationPrompts('test', fakeAnalysis)
    expect(result.system.toLowerCase()).toContain('vietnamese')
  })
})

describe('buildReviewPrompts', () => {
  it('returns PromptPair with round number', () => {
    const result = buildReviewPrompts('original', fakeAnalysis, 'draft vi', 1)
    expect(result.user).toContain('1')
  })
})

describe('TranslationDraftSchema', () => {
  it('parses valid draft', () => {
    const result = TranslationDraftSchema.parse({ sourceLang: 'Japanese', translated: 'Xin chào' })
    expect(result.sourceLang).toBe('Japanese')
  })

  it('rejects empty translated', () => {
    expect(() => TranslationDraftSchema.parse({ sourceLang: 'Japanese', translated: '' })).toThrow()
  })
})
```

- [ ] **Step 6.2: Run test to verify it fails**

```bash
cd packages/translation-prompt && bun test src/translation-prompt.test.ts
```

Expected: fails — `buildTranslationPrompts` not exported yet

- [ ] **Step 6.3: Rewrite `translation-prompt.ts`**

```typescript
// packages/translation-prompt/src/translation-prompt.ts
import type { PromptPair } from '@chatwork-bot/core'
import { PERSONA, CORE_DOCTRINE } from '~/sections/core'
import { JAPANESE_RULES } from '~/sections/language-layers'
import { HUMANIZER, STRUCTURAL } from '~/sections/humanizer'
import { CONSTRAINTS } from '~/sections/constraints'
import { buildAnalysisPrompts as _buildAnalysisPrompts } from '~/sections/analysis'
import { buildReviewPrompts as _buildReviewPrompts } from '~/sections/review'
import type { AnalysisResult } from '~/schemas/analysis.schema'

export { TranslationDraftSchema } from '~/schemas/review.schema'
export type { TranslationDraft } from '~/schemas/review.schema'
export { AnalysisSchema } from '~/schemas/analysis.schema'
export type { AnalysisResult } from '~/schemas/analysis.schema'
export { ReviewSchema } from '~/schemas/review.schema'
export type { ReviewResult } from '~/schemas/review.schema'
export { PipelineTraceSchema } from '~/schemas/pipeline-trace.schema'
export type { PipelineTrace } from '~/schemas/pipeline-trace.schema'

const TRANSLATION_SYSTEM = [
  PERSONA,
  CORE_DOCTRINE,
  JAPANESE_RULES,
  HUMANIZER,
  STRUCTURAL,
  CONSTRAINTS,
].join('\n\n')

/**
 * Phase 0+1: Skopos inference + 14D source analysis.
 * Returns prompts for the LLM to produce an AnalysisResult JSON.
 */
export function buildAnalysisPrompts(text: string): PromptPair {
  return _buildAnalysisPrompts(text)
}

/**
 * Phase 2: Translation informed by analysis context.
 * Returns prompts for the LLM to produce a TranslationDraft JSON.
 */
export function buildTranslationPrompts(text: string, analysis: AnalysisResult): PromptPair {
  const analysisContext = `## Translation Context (from source analysis)
- Skopos strategy: ${analysis.skopos.strategy}
- Register: ${analysis.skopos.register}
- Audience: ${analysis.skopos.audience}
- Text function: ${analysis.crossCutting.textFunction}
- Tone: ${analysis.crossCutting.registerTone}
- Subject: ${analysis.intratextual.subjectMatter}
- Key notes: ${analysis.intratextual.lexisNotes}

Apply this context to produce a translation that serves the Vietnamese reader (${analysis.skopos.strategy} strategy).`

  return {
    system: TRANSLATION_SYSTEM,
    user: `${analysisContext}

Translate the following text into natural Vietnamese.
Respond ONLY with valid JSON:
{"sourceLang": "<full English language name>", "translated": "<Vietnamese translation>"}

Text:
${text}`,
  }
}

/**
 * Phase 3: 3-Persona MQM-Lite review.
 * Returns prompts for the LLM to produce a ReviewResult JSON.
 */
export function buildReviewPrompts(
  text: string,
  analysis: AnalysisResult,
  currentDraft: string,
  round: number,
  escalated = false,
): PromptPair {
  return _buildReviewPrompts(text, analysis, currentDraft, round, escalated)
}
```

- [ ] **Step 6.4: Update `packages/translation-prompt/src/index.ts`**

```typescript
// packages/translation-prompt/src/index.ts
export {
  buildAnalysisPrompts,
  buildTranslationPrompts,
  buildReviewPrompts,
  TranslationDraftSchema,
  AnalysisSchema,
  ReviewSchema,
  PipelineTraceSchema,
} from './translation-prompt'
export type {
  TranslationDraft,
  AnalysisResult,
  ReviewResult,
  PipelineTrace,
} from './translation-prompt'
```

- [ ] **Step 6.5: Run all translation-prompt tests**

```bash
cd packages/translation-prompt && bun test
```

Expected: all pass

- [ ] **Step 6.6: Commit**

```bash
git add packages/translation-prompt/src/
git commit -m "feat(translation-prompt): refactor into sections/, add 14D analysis + review prompt builders"
```

---

## Chunk 4: TranslationPipeline — @chatwork-bot/translator

### Task 7: Implement `TranslationPipeline`

**Files:**

- Create: `packages/translator/src/pipeline/pipeline.ts`
- Create: `packages/translator/src/pipeline/pipeline.test.ts`

- [ ] **Step 7.1: Write failing tests (fixture-based, no LLM calls)**

```typescript
// packages/translator/src/pipeline/pipeline.test.ts
import { describe, it, expect, mock, beforeEach } from 'bun:test'
import type { ILLMExecutor, PromptPair, ISchema } from '@chatwork-bot/core'
import { TranslationPipeline } from './pipeline'
import type { AnalysisResult } from '@chatwork-bot/translation-prompt'
import type { ReviewResult } from '@chatwork-bot/translation-prompt'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const fakeAnalysis: AnalysisResult = {
  skopos: {
    purpose: 'informational',
    audience: 'Vietnamese engineer',
    strategy: 'instrumental',
    register: 'semi-formal',
  },
  extratextual: {
    sender: 'PM',
    intention: 'request confirmation',
    audience: 'developer',
    medium: 'chat',
    temporalContext: 'end of sprint',
  },
  intratextual: {
    subjectMatter: 'release schedule',
    contentSummary: 'asking deploy timing',
    presuppositions: 'reader knows the project',
    textStructure: 'single paragraph',
    lexisNotes: 'business Japanese',
    nonVerbalElements: 'none',
  },
  crossCutting: {
    textFunction: 'directive',
    registerTone: 'polite-formal',
    expectedEffect: 'reader confirms',
  },
}

const fakeDraft = { sourceLang: 'Japanese', translated: 'Bản dịch ban đầu.' }

const makeReview = (totalScore: number): ReviewResult => ({
  scores: {
    naturalFlow: Math.min(3, totalScore - 6) as 0 | 1 | 2 | 3,
    culturalFidelity: 2,
    readerExperience: 1,
    semanticAccuracy: 1,
    targetConventions: 1,
  },
  totalScore,
  passed: totalScore >= 9,
  critique: totalScore < 9 ? 'Needs improvement.' : 'Good.',
  refinedTranslation: `Bản dịch refined (score ${totalScore}).`,
  personaFeedback: {
    freshReader: 'OK',
    linguist: 'OK',
    editor: 'OK',
  },
})

// ── Mock executor factory ─────────────────────────────────────────────────────

function makeMockExecutor(responses: unknown[]): ILLMExecutor {
  let callCount = 0
  return {
    execute: mock(async <T>(_prompts: PromptPair, schema: ISchema<T>) => {
      const response = responses[callCount++]
      return schema.parse(response) as T
    }),
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('TranslationPipeline', () => {
  describe('happy path — passes round 1', () => {
    it('returns result and trace with 1 round', async () => {
      const passingReview = makeReview(9)
      const executor = makeMockExecutor([fakeAnalysis, fakeDraft, passingReview])
      const pipeline = new TranslationPipeline(executor)
      const { result, trace } = await pipeline.run('こんにちは')

      expect(result.translatedText).toBe(passingReview.refinedTranslation)
      expect(result.sourceLang).toBe('Japanese')
      expect(result.targetLang).toBe('Vietnamese')
      expect(trace.rounds).toHaveLength(1)
      expect(trace.finalScore).toBe(9)
      expect(trace.escalated).toBe(false)
    })
  })

  describe('multi-round — passes at round 2', () => {
    it('returns result and trace with 2 rounds', async () => {
      const failReview = makeReview(8)
      const passReview = makeReview(9)
      const executor = makeMockExecutor([fakeAnalysis, fakeDraft, failReview, passReview])
      const pipeline = new TranslationPipeline(executor)
      const { trace } = await pipeline.run('Hello')

      expect(trace.rounds).toHaveLength(2)
      expect(trace.finalScore).toBe(9)
      expect(trace.escalated).toBe(false)
    })
  })

  describe('escalation — stuck after 3 rounds', () => {
    it('marks escalated=true and continues for up to 2 more rounds', async () => {
      const failReview = makeReview(8)
      // 3 fails → escalation → 1 more fail → 1 pass
      const passReview = makeReview(9)
      const executor = makeMockExecutor([
        fakeAnalysis,
        fakeDraft,
        failReview,
        failReview,
        failReview, // round 3 = stuck → escalation
        fakeDraft, // Phase 2 rebuilt with switched Skopos
        passReview, // round 4
      ])
      const pipeline = new TranslationPipeline(executor)
      const { trace } = await pipeline.run('test')

      expect(trace.escalated).toBe(true)
    })
  })

  describe('max rounds — returns best result', () => {
    it('returns best round when all 5 rounds fail', async () => {
      const reviews = [
        makeReview(7),
        makeReview(8), // best
        makeReview(7),
        makeReview(6),
        makeReview(6),
      ]
      const executor = makeMockExecutor([
        fakeAnalysis,
        fakeDraft,
        reviews[0]!,
        reviews[1]!,
        reviews[2]!, // round 3 = stuck → escalation
        fakeDraft, // Phase 2 rebuilt
        reviews[3]!,
        reviews[4]!,
      ])
      const pipeline = new TranslationPipeline(executor)
      const { result, trace } = await pipeline.run('test')

      expect(trace.totalRounds).toBeLessThanOrEqual(5)
      expect(result.translatedText).toBe(reviews[1]!.refinedTranslation) // best was round 2
    })
  })

  describe('short-text fast path', () => {
    it('skips analysis for text shorter than 5 chars', async () => {
      const executor = makeMockExecutor([fakeDraft]) // only Phase 2 called
      const pipeline = new TranslationPipeline(executor)
      const { result, trace } = await pipeline.run('ok')

      expect(result.sourceLang).toBe('Japanese')
      expect(trace.rounds).toHaveLength(0)
    })
  })

  describe('abort signal', () => {
    it('throws TranslationError with ABORTED code when signal is already aborted', async () => {
      const controller = new AbortController()
      controller.abort()
      const executor = makeMockExecutor([fakeAnalysis, fakeDraft])
      const pipeline = new TranslationPipeline(executor)

      try {
        await pipeline.run('test', { signal: controller.signal })
        expect.unreachable('should have thrown')
      } catch (error) {
        const { TranslationError } = await import('@chatwork-bot/core')
        expect(error).toBeInstanceOf(TranslationError)
        expect((error as InstanceType<typeof TranslationError>).code).toBe('ABORTED')
      }
    })
  })
})
```

- [ ] **Step 7.2: Run test to verify it fails**

```bash
cd packages/translator && bun test src/pipeline/pipeline.test.ts
```

Expected: Cannot find module `./pipeline`

- [ ] **Step 7.3: Create `pipeline.ts`**

```typescript
// packages/translator/src/pipeline/pipeline.ts
import type { ILLMExecutor } from '@chatwork-bot/core'
import { TranslationError } from '@chatwork-bot/core'
import type { TranslationResult } from '@chatwork-bot/core'
import {
  buildAnalysisPrompts,
  buildTranslationPrompts,
  buildReviewPrompts,
  AnalysisSchema,
  TranslationDraftSchema,
  ReviewSchema,
  PipelineTraceSchema,
} from '@chatwork-bot/translation-prompt'
import type { AnalysisResult, ReviewResult, PipelineTrace } from '@chatwork-bot/translation-prompt'

export interface PipelineRunOptions {
  signal?: AbortSignal
  timeoutMs?: number
}

export interface PipelineRunResult {
  result: TranslationResult
  trace: PipelineTrace
}

const MAX_ROUNDS = 5
const ESCALATION_ROUND = 3
const SHORT_TEXT_THRESHOLD = 5 // grapheme count
const DEFAULT_TIMEOUT_MS = 120_000

export class TranslationPipeline {
  constructor(
    private readonly executor: ILLMExecutor,
    private readonly opts: { timeoutMs?: number } = {},
  ) {}

  async run(text: string, options: PipelineRunOptions = {}): Promise<PipelineRunResult> {
    const startMs = Date.now()
    const signal = this.buildSignal(options)

    this.checkAbort(signal)

    const isShortText = [...text].length < SHORT_TEXT_THRESHOLD

    // ── Phase 0+1: Analysis (skip for short text) ──────────────────────────
    let analysis: AnalysisResult

    if (isShortText) {
      analysis = this.buildFastPathAnalysis()
    } else {
      this.checkAbort(signal)
      analysis = await this.executor.execute(buildAnalysisPrompts(text), AnalysisSchema, { signal })
    }

    // ── Phase 2: Translation ───────────────────────────────────────────────
    this.checkAbort(signal)
    const draft = await this.executor.execute(
      buildTranslationPrompts(text, analysis),
      TranslationDraftSchema,
      { signal },
    )

    // Fast path: return immediately for short text (no review loop)
    if (isShortText) {
      const result = this.buildTranslationResult(text, draft.translated, draft.sourceLang)
      const trace = PipelineTraceSchema.parse({
        analysis,
        rounds: [],
        finalScore: 10,
        totalRounds: 0,
        escalated: false,
        durationMs: Date.now() - startMs,
      })
      return { result, trace }
    }

    // ── Phase 3: Review loop ───────────────────────────────────────────────
    const rounds: ReviewResult[] = []
    let currentDraft = draft.translated
    let escalated = false
    // Initialize bestRound with Phase 2 draft so a total failure path never produces empty output
    let bestRound: ReviewResult = { ...makeNullReview(), refinedTranslation: draft.translated }

    for (let round = 1; round <= MAX_ROUNDS; round++) {
      this.checkAbort(signal)

      // Escalation: after ESCALATION_ROUND stuck rounds, switch Skopos + rebuild Phase 2
      if (round === ESCALATION_ROUND + 1 && !escalated && rounds.every((r) => !r.passed)) {
        escalated = true
        const switchedAnalysis = this.switchSkopos(analysis)
        this.checkAbort(signal)
        const rebuiltDraft = await this.executor.execute(
          buildTranslationPrompts(text, switchedAnalysis),
          TranslationDraftSchema,
          { signal },
        )
        currentDraft = rebuiltDraft.translated
        analysis = switchedAnalysis
      }

      const review = await this.executor.execute(
        buildReviewPrompts(text, analysis, currentDraft, round, escalated),
        ReviewSchema,
        { signal },
      )
      rounds.push(review)
      currentDraft = review.refinedTranslation

      if (review.totalScore > (bestRound.totalScore ?? 0)) {
        bestRound = review
      }

      if (review.passed) break
    }

    const winner = rounds.find((r) => r.passed) ?? bestRound
    const finalScore = winner.totalScore

    const result = this.buildTranslationResult(text, winner.refinedTranslation, draft.sourceLang)
    const trace = PipelineTraceSchema.parse({
      analysis,
      rounds,
      finalScore,
      totalRounds: rounds.length,
      escalated,
      durationMs: Date.now() - startMs,
    })

    return { result, trace }
  }

  private buildSignal(options: PipelineRunOptions): AbortSignal | undefined {
    const timeoutMs = options.timeoutMs ?? this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const timeoutController = new AbortController()
    setTimeout(() => timeoutController.abort(), timeoutMs)

    if (options.signal) {
      // Combine external signal + timeout signal
      options.signal.addEventListener('abort', () => timeoutController.abort())
      return timeoutController.signal
    }
    return timeoutController.signal
  }

  private checkAbort(signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw new TranslationError('Translation pipeline aborted', 'ABORTED')
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

  private buildFastPathAnalysis(): AnalysisResult {
    return AnalysisSchema.parse({
      skopos: {
        purpose: 'casual',
        audience: 'general',
        strategy: 'instrumental',
        register: 'casual',
      },
      extratextual: {
        sender: 'unknown',
        intention: 'quick message',
        audience: 'colleague',
        medium: 'chat',
        temporalContext: 'real-time chat',
      },
      intratextual: {
        subjectMatter: 'short message',
        contentSummary: 'brief casual communication',
        presuppositions: 'none',
        textStructure: 'single token',
        lexisNotes: 'minimal',
        nonVerbalElements: 'possible emoji',
      },
      crossCutting: {
        textFunction: 'phatic',
        registerTone: 'casual',
        expectedEffect: 'acknowledgment',
      },
    })
  }

  private switchSkopos(analysis: AnalysisResult): AnalysisResult {
    return {
      ...analysis,
      skopos: {
        ...analysis.skopos,
        strategy: analysis.skopos.strategy === 'instrumental' ? 'documentary' : 'instrumental',
      },
    }
  }
}

function makeNullReview(): ReviewResult {
  return {
    scores: {
      naturalFlow: 0,
      culturalFidelity: 0,
      readerExperience: 0,
      semanticAccuracy: 0,
      targetConventions: 0,
    },
    totalScore: 0,
    passed: false,
    critique: '',
    refinedTranslation: '',
    personaFeedback: { freshReader: '', linguist: '', editor: '' },
  }
}
```

- [ ] **Step 7.4: Run tests**

```bash
cd packages/translator && bun test src/pipeline/pipeline.test.ts
```

Expected: all pass

- [ ] **Step 7.5: Run typecheck**

```bash
cd packages/translator && bun run typecheck
```

Expected: errors about missing deps — add `@chatwork-bot/translation-prompt` to `packages/translator/package.json` if not present:

```bash
grep 'translation-prompt' packages/translator/package.json || \
  bun add '@chatwork-bot/translation-prompt@workspace:*' --cwd packages/translator
```

- [ ] **Step 7.6: Commit**

```bash
git add packages/translator/src/pipeline/ packages/translator/package.json
git commit -m "feat(translator): implement TranslationPipeline with 4-phase orchestration"
```

---

## Chunk 5: Provider Updates

### Task 8: Update Gemini provider

**Files:**

- Modify: `packages/provider-gemini/src/gemini-plugin.ts`
- Modify: `packages/provider-gemini/src/gemini-plugin.test.ts`

- [ ] **Step 8.1: Write updated failing test**

Replace `packages/provider-gemini/src/gemini-plugin.test.ts` with:

```typescript
// packages/provider-gemini/src/gemini-plugin.test.ts
import { beforeAll, describe, expect, it, mock } from 'bun:test'
import { z } from 'zod'
import type { geminiPlugin as geminiPluginType } from './gemini-plugin'

const generateTextMock = mock((_config: unknown) =>
  Promise.resolve({
    output: { sourceLang: 'English', translated: 'Xin chào thế giới' },
  }),
)

const outputObjectMock = mock((config: unknown) => config)
const googleMock = mock((_modelId: string) => ({ provider: 'google', modelId: _modelId }))

void mock.module('ai', () => ({
  generateText: generateTextMock,
  Output: { object: outputObjectMock },
}))

void mock.module('@ai-sdk/google', () => ({ google: googleMock }))

describe('geminiPlugin', () => {
  let geminiPlugin: typeof geminiPluginType

  beforeAll(async () => {
    const mod = await import('./gemini-plugin')
    geminiPlugin = mod.geminiPlugin
  })

  it('manifest id is gemini', () => {
    expect(geminiPlugin.manifest.id).toBe('gemini')
  })

  it('manifest defaultModel is gemini-2.5-pro', () => {
    expect(geminiPlugin.manifest.defaultModel).toBe('gemini-2.5-pro')
  })

  it('create() returns an ILLMExecutor', () => {
    const executor = geminiPlugin.create({ modelId: 'gemini-2.5-pro' })
    expect(typeof executor.execute).toBe('function')
  })

  it('execute() returns parsed schema result', async () => {
    generateTextMock.mockImplementationOnce(() => Promise.resolve({ output: { x: 42 } }))
    const executor = geminiPlugin.create({ modelId: 'gemini-2.5-pro' })
    const result = await executor.execute(
      { system: 'sys', user: 'usr' },
      z.object({ x: z.number() }),
    )
    expect(result.x).toBe(42)
  })

  it('passes the modelId through to google()', async () => {
    const executor = geminiPlugin.create({ modelId: 'gemini-2.0-flash' })
    await executor.execute(
      { system: 'sys', user: 'usr' },
      z.object({ x: z.number() }).passthrough(),
    )
    expect(googleMock.mock.calls.at(-1)?.[0]).toBe('gemini-2.0-flash')
  })

  it('wraps API errors in TranslationError', async () => {
    generateTextMock.mockImplementationOnce(() => Promise.reject(new Error('network error')))
    const { TranslationError } = await import('@chatwork-bot/core')
    const executor = geminiPlugin.create({ modelId: 'gemini-2.5-pro' })
    try {
      await executor.execute(
        { system: 'sys', user: 'usr' },
        z.object({ x: z.number() }).passthrough(),
      )
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(TranslationError)
    }
  })
})
```

- [ ] **Step 8.2: Run test to verify it fails**

```bash
cd packages/provider-gemini && bun test
```

Expected: fails — `execute` not a function

- [ ] **Step 8.3: Rewrite `gemini-plugin.ts`**

```typescript
// packages/provider-gemini/src/gemini-plugin.ts
import { generateText, Output } from 'ai'
import { google } from '@ai-sdk/google'
import type { ILLMExecutor, PromptPair, ISchema } from '@chatwork-bot/core'
import { TranslationError } from '@chatwork-bot/core'
import type { ProviderPlugin, ProviderCreateContext } from '@chatwork-bot/core'

export const GEMINI_MODEL_VALUES = [
  'gemini-3.1-pro-preview',
  'gemini-3.1-flash',
  'gemini-3.1-flash-lite',
  'gemini-3-pro-preview',
  'gemini-3-flash',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
] as const
export type GeminiModel = (typeof GEMINI_MODEL_VALUES)[number]
export const DEFAULT_GEMINI_MODEL: GeminiModel = 'gemini-2.5-pro'

class GeminiExecutor implements ILLMExecutor {
  constructor(private readonly modelId: string) {}

  async execute<T>(
    prompts: PromptPair,
    schema: ISchema<T>,
    options?: { signal?: AbortSignal },
  ): Promise<T> {
    try {
      const { output } = await generateText({
        model: google(this.modelId),
        output: Output.object({ schema: schema as Parameters<typeof Output.object>[0]['schema'] }),
        system: prompts.system,
        prompt: prompts.user,
        temperature: 0,
        maxOutputTokens: 2000,
        ...(options?.signal && { abortSignal: options.signal }),
      })
      return schema.parse(output)
    } catch (cause) {
      throw new TranslationError(
        `Gemini API call failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        'API_ERROR',
        cause,
      )
    }
  }
}

export const geminiPlugin: ProviderPlugin = {
  manifest: {
    id: 'gemini',
    supportedModels: GEMINI_MODEL_VALUES,
    defaultModel: DEFAULT_GEMINI_MODEL,
    capabilities: { streaming: false },
    requiredEnvKeys: ['GOOGLE_GENERATIVE_AI_API_KEY'],
  },
  create(ctx: ProviderCreateContext): ILLMExecutor {
    return new GeminiExecutor(ctx.modelId)
  },
}
```

- [ ] **Step 8.4: Run tests + typecheck**

```bash
cd packages/provider-gemini && bun test && bun run typecheck
```

Expected: all pass

### Task 9: Update OpenAI provider

**Files:**

- Modify: `packages/provider-openai/src/openai-plugin.ts`
- Create/modify: `packages/provider-openai/src/openai-plugin.test.ts`

- [ ] **Step 9.1: Write failing test for OpenAI executor**

```typescript
// packages/provider-openai/src/openai-plugin.test.ts
import { beforeAll, describe, expect, it, mock } from 'bun:test'
import { z } from 'zod'
import type { openaiPlugin as openaiPluginType } from './openai-plugin'

const generateTextMock = mock((_config: unknown) =>
  Promise.resolve({
    output: { sourceLang: 'English', translated: 'Xin chào thế giới' },
  }),
)

const outputObjectMock = mock((config: unknown) => config)
const openaiMock = mock((_modelId: string) => ({ provider: 'openai', modelId: _modelId }))

void mock.module('ai', () => ({
  generateText: generateTextMock,
  Output: { object: outputObjectMock },
}))

void mock.module('@ai-sdk/openai', () => ({ openai: openaiMock }))

describe('openaiPlugin', () => {
  let openaiPlugin: typeof openaiPluginType

  beforeAll(async () => {
    const mod = await import('./openai-plugin')
    openaiPlugin = mod.openaiPlugin
  })

  it('manifest id is openai', () => {
    expect(openaiPlugin.manifest.id).toBe('openai')
  })

  it('manifest defaultModel is gpt-5.4', () => {
    expect(openaiPlugin.manifest.defaultModel).toBe('gpt-5.4')
  })

  it('create() returns an ILLMExecutor', () => {
    const executor = openaiPlugin.create({ modelId: 'gpt-5.4' })
    expect(typeof executor.execute).toBe('function')
  })

  it('execute() returns parsed schema result', async () => {
    generateTextMock.mockImplementationOnce(() => Promise.resolve({ output: { x: 99 } }))
    const executor = openaiPlugin.create({ modelId: 'gpt-5.4' })
    const result = await executor.execute(
      { system: 'sys', user: 'usr' },
      z.object({ x: z.number() }),
    )
    expect(result.x).toBe(99)
  })

  it('passes the modelId through to openai()', async () => {
    const executor = openaiPlugin.create({ modelId: 'gpt-4o' })
    await executor.execute(
      { system: 'sys', user: 'usr' },
      z.object({ x: z.number() }).passthrough(),
    )
    expect(openaiMock.mock.calls.at(-1)?.[0]).toBe('gpt-4o')
  })

  it('wraps API errors in TranslationError', async () => {
    generateTextMock.mockImplementationOnce(() => Promise.reject(new Error('network error')))
    const { TranslationError } = await import('@chatwork-bot/core')
    const executor = openaiPlugin.create({ modelId: 'gpt-5.4' })
    try {
      await executor.execute(
        { system: 'sys', user: 'usr' },
        z.object({ x: z.number() }).passthrough(),
      )
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(TranslationError)
    }
  })
})
```

- [ ] **Step 9.2: Run test to verify it fails**

```bash
cd packages/provider-openai && bun test
```

Expected: fails — `execute` not a function

- [ ] **Step 9.3: Rewrite `openai-plugin.ts`** (same pattern as Gemini)

```typescript
// packages/provider-openai/src/openai-plugin.ts
import { generateText, Output } from 'ai'
import { openai } from '@ai-sdk/openai'
import type { ILLMExecutor, PromptPair, ISchema } from '@chatwork-bot/core'
import { TranslationError } from '@chatwork-bot/core'
import type { ProviderPlugin, ProviderCreateContext } from '@chatwork-bot/core'

export const OPENAI_MODEL_VALUES = [
  'gpt-5.4',
  'gpt-5.4-pro',
  'gpt-5.2',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-5.3-codex',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4o',
  'gpt-4o-mini',
] as const
export type OpenAIModel = (typeof OPENAI_MODEL_VALUES)[number]
export const DEFAULT_OPENAI_MODEL: OpenAIModel = 'gpt-5.4'

class OpenAIExecutor implements ILLMExecutor {
  constructor(private readonly modelId: string) {}

  async execute<T>(
    prompts: PromptPair,
    schema: ISchema<T>,
    options?: { signal?: AbortSignal },
  ): Promise<T> {
    try {
      const { output } = await generateText({
        model: openai(this.modelId),
        output: Output.object({ schema: schema as Parameters<typeof Output.object>[0]['schema'] }),
        system: prompts.system,
        prompt: prompts.user,
        temperature: 0,
        maxOutputTokens: 2000,
        ...(options?.signal && { abortSignal: options.signal }),
      })
      return schema.parse(output)
    } catch (cause) {
      throw new TranslationError(
        `OpenAI API call failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        'API_ERROR',
        cause,
      )
    }
  }
}

export const openaiPlugin: ProviderPlugin = {
  manifest: {
    id: 'openai',
    supportedModels: OPENAI_MODEL_VALUES,
    defaultModel: DEFAULT_OPENAI_MODEL,
    capabilities: { streaming: false },
    requiredEnvKeys: ['OPENAI_API_KEY'],
  },
  create(ctx: ProviderCreateContext): ILLMExecutor {
    return new OpenAIExecutor(ctx.modelId)
  },
}
```

- [ ] **Step 9.4: Run tests + typecheck**

```bash
cd packages/provider-openai && bun test && bun run typecheck
```

Expected: all pass

### Task 10: Update Cursor provider

**Files:**

- Modify: `packages/provider-cursor/src/cursor-translation.ts`
- `packages/provider-cursor/src/extract-json.ts` — unchanged

- [ ] **Step 10.1: Rewrite `cursor-translation.ts`**

Remove `JSON_FORMAT_INSTRUCTION` entirely. The `execute()` method uses `extractJsonFromText` + `schema.parse()` — no hardcoded field constraints.

```typescript
// packages/provider-cursor/src/cursor-translation.ts
import { generateText } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { ILLMExecutor, PromptPair, ISchema } from '@chatwork-bot/core'
import { TranslationError } from '@chatwork-bot/core'
import { extractJsonFromText } from './extract-json'

export class CursorExecutor implements ILLMExecutor {
  private readonly provider: ReturnType<typeof createOpenAICompatible>

  constructor(
    private readonly modelId: string,
    private readonly baseUrl: string,
  ) {
    this.provider = createOpenAICompatible({
      name: 'cursor',
      baseURL: baseUrl,
    })
  }

  async execute<T>(
    prompts: PromptPair,
    schema: ISchema<T>,
    options?: { signal?: AbortSignal },
  ): Promise<T> {
    let rawText: string
    try {
      const result = await generateText({
        model: this.provider(this.modelId),
        system: prompts.system,
        prompt: prompts.user,
        ...(options?.signal && { abortSignal: options.signal }),
      })
      rawText = result.text
    } catch (cause) {
      throw new TranslationError(
        `Cursor API call failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        'API_ERROR',
        cause,
      )
    }

    let json: unknown
    try {
      json = extractJsonFromText(rawText)
    } catch (cause) {
      throw new TranslationError(
        `No JSON in Cursor response: ${cause instanceof Error ? cause.message : String(cause)}`,
        'API_ERROR',
        cause,
      )
    }

    try {
      return schema.parse(json)
    } catch (cause) {
      throw new TranslationError(
        `Invalid Cursor response schema: ${cause instanceof Error ? cause.message : String(cause)}`,
        'INVALID_RESPONSE',
        cause,
      )
    }
  }
}
```

- [ ] **Step 10.2: Update `cursor-plugin.ts`**

```typescript
// packages/provider-cursor/src/cursor-plugin.ts
import type { ILLMExecutor } from '@chatwork-bot/core'
import type { ProviderPlugin, ProviderCreateContext } from '@chatwork-bot/core'
import { CursorExecutor } from './cursor-translation'

export const CURSOR_MODEL_VALUES = [
  'auto',
  'composer-1',
  'composer-1.5',
  'sonnet-4.5',
  'gemini-3-flash',
  'gemini-3-pro',
  'gemini-3.1-pro',
  'kimi-k2.5',
  'grok',
  'gpt-5.1-codex-mini',
  'sonnet-4.6',
  'opus-4.5',
  'opus-4.6',
  'gpt-5.2',
  'gpt-5.2-high',
  'gpt-5.2-codex',
  'gpt-5.2-codex-low',
  'gpt-5.2-codex-low-fast',
  'gpt-5.2-codex-fast',
  'gpt-5.2-codex-high',
  'gpt-5.2-codex-high-fast',
  'gpt-5.3-codex',
  'gpt-5.3-codex-low',
  'gpt-5.3-codex-low-fast',
  'gpt-5.3-codex-fast',
  'gpt-5.3-codex-high',
  'gpt-5.3-codex-high-fast',
  'gpt-5.3-codex-spark-preview',
  'gpt-5.4-medium',
  'gpt-5.4-medium-fast',
  'gpt-5.4-high',
  'gpt-5.4-high-fast',
  'gpt-5.1-high',
  'sonnet-4.5-thinking',
  'sonnet-4.6-thinking',
  'opus-4.5-thinking',
  'opus-4.6-thinking',
  'gpt-5.2-codex-xhigh',
  'gpt-5.2-codex-xhigh-fast',
  'gpt-5.3-codex-xhigh',
  'gpt-5.3-codex-xhigh-fast',
  'gpt-5.4-xhigh',
  'gpt-5.4-xhigh-fast',
  'gpt-5.1-codex-max',
  'gpt-5.1-codex-max-high',
] as const
export type CursorModel = (typeof CURSOR_MODEL_VALUES)[number]
export const DEFAULT_CURSOR_MODEL: CursorModel = 'sonnet-4.6'

export const cursorPlugin: ProviderPlugin = {
  manifest: {
    id: 'cursor',
    supportedModels: CURSOR_MODEL_VALUES,
    defaultModel: DEFAULT_CURSOR_MODEL,
    capabilities: { streaming: false },
    timeoutMs: 120_000,
    requiredEnvKeys: ['CURSOR_API_URL'],
  },
  create(ctx: ProviderCreateContext): ILLMExecutor {
    if (!ctx.baseUrl) {
      throw new Error(
        'cursor provider requires baseUrl in ProviderCreateContext (set CURSOR_API_URL)',
      )
    }
    return new CursorExecutor(ctx.modelId, ctx.baseUrl)
  },
}
```

- [ ] **Step 10.3: Run typecheck for cursor provider**

```bash
cd packages/provider-cursor && bun run typecheck
```

Expected: passes

- [ ] **Step 10.4: Commit all provider updates**

```bash
git add packages/provider-gemini/ packages/provider-openai/ packages/provider-cursor/
git commit -m "feat(providers): implement ILLMExecutor on Gemini, OpenAI, Cursor"
```

---

## Chunk 6: Handler + Output Wire-up

### Task 11: Update output types + handler

**Files:**

- Modify: `packages/translator/src/types/output.ts`
- Modify: `packages/translator/src/webhook/handler.ts`
- Modify: `packages/translator/src/webhook/handler.test.ts`

- [ ] **Step 11.1: Update `output.ts`**

```typescript
// packages/translator/src/types/output.ts
import type { ChatworkWebhookEvent, TranslationResult } from '@chatwork-bot/core'
import type { PipelineTrace } from '@chatwork-bot/translation-prompt'

export type OutputRecord = ChatworkWebhookEvent & {
  translation: TranslationResult
  pipeline?: PipelineTrace
}
```

- [ ] **Step 11.2: Write updated handler tests**

The handler test needs to mock `executor.execute()` instead of `service.translate()`. Replace `packages/translator/src/webhook/handler.test.ts`:

```typescript
// packages/translator/src/webhook/handler.test.ts
import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ChatworkWebhookEvent } from '@chatwork-bot/core'
import type { AnalysisResult, ReviewResult } from '@chatwork-bot/translation-prompt'
import type { handleTranslateRequest as HandleTranslateRequestType } from './handler'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const fakeAnalysis: AnalysisResult = {
  skopos: {
    purpose: 'informational',
    audience: 'developer',
    strategy: 'instrumental',
    register: 'semi-formal',
  },
  extratextual: {
    sender: 'PM',
    intention: 'request status',
    audience: 'developer',
    medium: 'chat',
    temporalContext: 'end of sprint',
  },
  intratextual: {
    subjectMatter: 'deployment',
    contentSummary: 'asking about deploy',
    presuppositions: 'reader knows project',
    textStructure: 'single paragraph',
    lexisNotes: 'business Japanese',
    nonVerbalElements: 'none',
  },
  crossCutting: {
    textFunction: 'directive',
    registerTone: 'polite-formal',
    expectedEffect: 'confirmation',
  },
}

const fakeDraft = { sourceLang: 'Japanese', translated: 'Bản dịch test.' }

const fakePassingReview: ReviewResult = {
  scores: {
    naturalFlow: 3,
    culturalFidelity: 2,
    readerExperience: 2,
    semanticAccuracy: 1,
    targetConventions: 1,
  },
  totalScore: 9,
  passed: true,
  critique: 'Good.',
  refinedTranslation: 'Đoạn A\n\nĐoạn B đã được làm mượt.',
  personaFeedback: { freshReader: 'OK', linguist: 'OK', editor: 'OK' },
}

// ── Mocks ────────────────────────────────────────────────────────────────────

let executorCallCount = 0
const executorResponses = [fakeAnalysis, fakeDraft, fakePassingReview]

const mockExecute = mock(async (_prompts: unknown, schema: { parse: (d: unknown) => unknown }) => {
  const response = executorResponses[executorCallCount++]
  return schema.parse(response)
})

const mockPluginCreate = mock((_ctx: unknown) => ({ execute: mockExecute }))
const mockGetProviderPlugin = mock((_id: string) => ({
  manifest: {
    id: 'openai',
    defaultModel: 'gpt-4o',
    supportedModels: ['gpt-4o'],
    capabilities: { streaming: false },
  },
  create: mockPluginCreate,
}))
const mockStripChatworkMarkup = mock((_text: string) => strippedText)
const mockIsChatworkMessageEvent = mock((_event: ChatworkWebhookEvent) => isMessageEvent)

let isMessageEvent = true
let strippedText = 'clean text'

const testOutputDir = mkdtempSync(join(tmpdir(), 'handler-test-'))
process.env['OUTPUT_BASE_DIR'] = testOutputDir

describe('handleTranslateRequest', () => {
  let handleTranslateRequest: typeof HandleTranslateRequestType

  beforeAll(async () => {
    const realCore = await import('@chatwork-bot/core')

    void mock.module('@chatwork-bot/core', () => ({
      ...realCore,
      isChatworkMessageEvent: mockIsChatworkMessageEvent,
      stripChatworkMarkup: mockStripChatworkMarkup,
      getProviderPlugin: mockGetProviderPlugin,
    }))

    void mock.module('@chatwork-bot/translation-prompt', () => ({
      buildAnalysisPrompts: mock(() => ({ system: 'sys', user: 'usr' })),
      buildTranslationPrompts: mock(() => ({ system: 'sys', user: 'usr' })),
      buildReviewPrompts: mock(() => ({ system: 'sys', user: 'usr' })),
      AnalysisSchema: { parse: (d: unknown) => d },
      TranslationDraftSchema: { parse: (d: unknown) => d },
      ReviewSchema: { parse: (d: unknown) => d },
      PipelineTraceSchema: {
        parse: mock(() => ({
          analysis: fakeAnalysis,
          rounds: [fakePassingReview],
          finalScore: 9,
          totalRounds: 1,
          escalated: false,
          durationMs: 100,
        })),
      },
    }))

    const mod = await import('./handler')
    handleTranslateRequest = mod.handleTranslateRequest
  })

  beforeEach(() => {
    isMessageEvent = true
    strippedText = 'clean text'
    executorCallCount = 0
    mockGetProviderPlugin.mockClear()
    mockExecute.mockClear()
  })

  afterAll(() => {
    rmSync(testOutputDir, { recursive: true, force: true })
  })

  it('translates message and writes output with pipeline trace', async () => {
    const event: ChatworkWebhookEvent = {
      webhook_setting_id: '35555',
      webhook_event_type: 'message_created',
      webhook_event_time: 1772633778,
      webhook_event: {
        message_id: '2081046619322847232',
        room_id: 424846369,
        account_id: 8315321,
        body: 'A\n\nB\nC',
        send_time: 1772633778,
        update_time: 0,
      },
    }

    await handleTranslateRequest(event)

    expect(mockGetProviderPlugin.mock.calls.length).toBe(1)
    expect(mockGetProviderPlugin.mock.calls[0]?.[0]).toBe('openai')
  })

  it('skips non-message events', async () => {
    isMessageEvent = false
    const event: ChatworkWebhookEvent = {
      webhook_setting_id: '35555',
      webhook_event_type: 'room_updated',
      webhook_event_time: 1772633778,
      webhook_event: {},
    }
    await handleTranslateRequest(event)
    expect(mockGetProviderPlugin.mock.calls.length).toBe(0)
  })

  it('skips when stripped message is empty', async () => {
    strippedText = ''
    const event: ChatworkWebhookEvent = {
      webhook_setting_id: '35555',
      webhook_event_type: 'message_created',
      webhook_event_time: 1772633778,
      webhook_event: {
        message_id: '2081046619322847232',
        room_id: 424846369,
        account_id: 8315321,
        body: '[info]internal[/info]',
        send_time: 1772633778,
        update_time: 0,
      },
    }
    await handleTranslateRequest(event)
    expect(mockGetProviderPlugin.mock.calls.length).toBe(0)
  })
})
```

- [ ] **Step 11.3: Run test to verify it fails (expected)**

```bash
cd packages/translator && bun test src/webhook/handler.test.ts
```

Expected: fails — handler still uses old translateWithPolicy

- [ ] **Step 11.4: Rewrite `handler.ts`**

```typescript
// packages/translator/src/webhook/handler.ts
import {
  isChatworkMessageEvent,
  stripChatworkMarkup,
  getProviderPlugin,
  TranslationError,
} from '@chatwork-bot/core'
import type { ChatworkWebhookEvent, ProviderCreateContext } from '@chatwork-bot/core'
import { env } from '~/env'
import { TranslationPipeline } from '~/pipeline/pipeline'
import { writeTranslationOutput } from '~/utils/output-writer'
import { logTranslationRequest } from '~/utils/request-log'
import { sendTranslatedMessage } from '~/services/chatwork-sender'

export async function handleTranslateRequest(event: ChatworkWebhookEvent): Promise<void> {
  if (!isChatworkMessageEvent(event)) {
    return
  }

  const { body } = event.webhook_event

  const cleanText = stripChatworkMarkup(body)
  if (!cleanText) {
    return
  }

  const plugin = getProviderPlugin(env.AI_PROVIDER)
  const modelId = env.AI_MODEL ?? plugin.manifest.defaultModel
  const ctx: ProviderCreateContext = { modelId }
  const baseUrl = process.env['CURSOR_API_URL']
  if (baseUrl) {
    ctx.baseUrl = baseUrl
  }
  const executor = plugin.create(ctx)
  const pipeline = new TranslationPipeline(executor, {
    timeoutMs: plugin.manifest.timeoutMs,
  })

  const requestId = crypto.randomUUID()
  const startMs = Date.now()

  try {
    const { result, trace } = await pipeline.run(cleanText)
    const latencyMs = Date.now() - startMs

    logTranslationRequest({
      requestId,
      provider: env.AI_PROVIDER,
      model: modelId,
      latencyMs,
      outcome: 'success',
      result,
    })

    const outputBaseDir = process.env['OUTPUT_BASE_DIR']
    await writeTranslationOutput(
      { ...event, translation: result, pipeline: trace },
      ...(outputBaseDir ? [outputBaseDir] : []),
    )

    await sendTranslatedMessage(event, result, {
      apiToken: env.CHATWORK_API_TOKEN,
      destinationRoomId: env.CHATWORK_DESTINATION_ROOM_ID,
    })
  } catch (error) {
    const latencyMs = Date.now() - startMs
    if (error instanceof TranslationError) {
      logTranslationRequest({
        requestId,
        provider: env.AI_PROVIDER,
        model: modelId,
        latencyMs,
        outcome: 'error',
        errorCode: error.code,
      })
      return
    }
    throw error
  }
}
```

- [ ] **Step 11.5: Run handler tests**

```bash
cd packages/translator && bun test src/webhook/handler.test.ts
```

Expected: all pass

- [ ] **Step 11.6: Run full test suite + typecheck + lint**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: all pass. Fix any remaining type errors before committing.

- [ ] **Step 11.7: Commit**

```bash
git add packages/translator/src/
git commit -m "feat(translator): wire TranslationPipeline into handler, add pipeline trace to output"
```

---

## Chunk 7: Final Verification

### Task 12: Definition of Done checklist

- [ ] **Step 12.1: Run full suite**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: 0 failures, 0 type errors, 0 lint warnings

- [ ] **Step 12.2: Verify output JSON has pipeline field**

Run the server locally and trigger a test translation. Check `output/<date>/<msg_id>.json` contains:

```json
{
  "translation": { ... },
  "pipeline": {
    "analysis": { "skopos": {...}, "extratextual": {...}, "intratextual": {...}, "crossCutting": {...} },
    "rounds": [...],
    "finalScore": 9,
    "totalRounds": 2,
    "escalated": false,
    "durationMs": 4230
  }
}
```

- [ ] **Step 12.3: Verify short-text fast path**

In `pipeline.test.ts`, confirm the short-text test passes (text `"ok"` returns `rounds=[]`).

- [ ] **Step 12.4: Verify all 3 providers typecheck correctly**

```bash
bun run --workspaces --if-present typecheck
```

Expected: all packages clean

- [ ] **Step 12.5: Final commit**

```bash
git add -A
git status  # verify nothing unexpected
git commit -m "feat(pipeline): enhanced 4-phase translation pipeline — big bang migration complete"
```

---

## Key Caveats for Implementer

1. **`~/` imports** — all intra-package imports must use `~/path`, not `../`. The ESLint `no-restricted-imports` rule enforces this.

2. **`bun:test` not vitest** — test imports: `import { describe, it, expect, mock } from 'bun:test'`. No `vi.fn()` — use `mock()` from bun:test.

3. **Zod v4 + `Output.object()`** — the `schema` cast `schema as Parameters<typeof Output.object>[0]['schema']` is needed because `ISchema<T>` is structurally compatible but TypeScript needs the hint for `@ai-sdk/google`/`@ai-sdk/openai`.

4. **Pipeline timeout** — `TranslationPipeline` creates its own `AbortController` for timeout. Do NOT wrap `pipeline.run()` in `translateWithPolicy` — the pipeline handles it internally.

5. **Provider tests after migration** — existing Gemini/OpenAI tests test `service.translate()`. After migration they test `executor.execute()`. The mock pattern stays the same (`generateTextMock`), only the assertion changes from `result.translatedText` to `result.x` (or whatever the schema says).

6. **`ILLMExecutor` lives in `interfaces/` not `types/`** — The design spec mentions `packages/core/src/types/llm-executor.ts` but this plan places it under `packages/core/src/interfaces/llm-executor.ts` to match the existing core convention (all interfaces live in `interfaces/`). This is intentional.

7. **`'ABORTED'` error code** — `TranslationError` in `@chatwork-bot/core` currently accepts `'API_ERROR' | 'QUOTA_EXCEEDED' | 'INVALID_RESPONSE' | 'UNKNOWN'`. You must add `'ABORTED'` to the union in `packages/core/src/interfaces/translation.ts` before the pipeline compiles.
