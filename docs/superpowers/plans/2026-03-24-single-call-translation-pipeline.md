# Single-Call Translation Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the 3–8 API-call translation pipeline into exactly 1 API call per trigger, with native thinking tokens where the model supports them (OpenAI `reasoningEffort`, Gemini `thinkingConfig`).

**Architecture:** A new `buildSingleCallPrompts(text)` function embeds all expert knowledge (persona, keigo mapping, humanizer rules, self-critique gate) into one system prompt. Provider executors self-detect whether their active model supports thinking and inject the appropriate `providerOptions` into `generateText`. The pipeline becomes a single executor call with no analysis/review loop.

**Tech Stack:** Bun v1.1+, TypeScript 5.4+ strict, Zod, `@ai-sdk/openai` v3.x (`generateText` + `Output.object`), `@ai-sdk/google` v3.x, Elysia

---

## File Map

### Created

| File                                                      | Responsibility                                           |
| --------------------------------------------------------- | -------------------------------------------------------- |
| `packages/translation-prompt/src/sections/single-call.ts` | Dense expert system prompt string for 1-call translation |

### Modified

| File                                                                   | Change                                                                                |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `packages/translation-prompt/src/translation-prompt.ts`                | Add `buildSingleCallPrompts`, remove old 3 functions + dead imports                   |
| `packages/translation-prompt/src/index.ts`                             | Export `buildSingleCallPrompts`; remove old exports                                   |
| `packages/translation-prompt/src/translation-prompt.test.ts`           | Rewrite to test `buildSingleCallPrompts`                                              |
| `packages/provider-openai/src/openai-plugin.ts`                        | Add private `resolveThinking()`, inject `providerOptions`                             |
| `packages/provider-openai/src/openai-plugin.test.ts`                   | Add `resolveThinking` unit tests                                                      |
| `packages/provider-gemini/src/gemini-plugin.ts`                        | Add private `resolveThinking()`, inject `providerOptions`                             |
| `packages/provider-gemini/src/gemini-plugin.test.ts`                   | Add `resolveThinking` unit tests                                                      |
| `packages/translator/src/types/observability.ts`                       | Remove `'analysis'` and `'review'` from `TranslatorPhase`                             |
| `packages/translator/src/env-schema.ts`                                | Remove `TRANSLATOR_ANALYSIS_BUDGET_MS`, `TRANSLATOR_REVIEW_BUDGET_MS`                 |
| `packages/translator/src/services/translator-observability-runtime.ts` | Drop `analysis`/`review` keys from `phaseBudgets`                                     |
| `packages/translator/src/pipeline/pipeline.ts`                         | Rewrite: 1 executor call, no review loop, no escalation                               |
| `packages/translator/src/pipeline/pipeline.test.ts`                    | Rewrite: 1 mock call, no multi-round                                                  |
| `packages/translator/src/types/output.ts`                              | Remove `pipeline?: PipelineTrace` field + import                                      |
| `packages/translator/src/webhook/handler.ts`                           | Remove trace, remove escalation callbacks                                             |
| `packages/translator/src/webhook/handler.test.ts`                      | Remove trace destructuring, remove dead env vars from mock                            |
| `packages/translator/src/services/phase-observer.test.ts`              | Drop `analysis`/`review` keys from all `phaseBudgets` literals                        |
| `packages/translator/src/env.test.ts`                                  | Remove dead env var assertions                                                        |
| `packages/translator/src/bootstrap/startup-banner.ts`                  | Add `thinking` column                                                                 |
| `packages/translator/src/bootstrap/startup-banner.test.ts`             | Update snapshot/assertions for new column                                             |
| `packages/translator/src/server.ts`                                    | Add inline `resolveThinkingSupport` helper; pass `thinking:` to `logStartupBanner`    |
| `packages/translation-prompt/src/schemas/review.schema.ts`             | Strip `ReviewSchema`/`ReviewResult`; keep `TranslationDraftSchema`/`TranslationDraft` |

### Deleted

| File                                                               | Reason                                                                |
| ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `packages/translation-prompt/src/sections/analysis.ts`             | Only used by removed `buildAnalysisPrompts`                           |
| `packages/translation-prompt/src/sections/review.ts`               | Only used by removed `buildReviewPrompts`                             |
| `packages/translation-prompt/src/sections/hints.ts`                | Only used by removed `buildTranslationPrompts` / `buildReviewPrompts` |
| `packages/translation-prompt/src/schemas/analysis.schema.ts`       | No longer exported                                                    |
| `packages/translation-prompt/src/schemas/analysis.schema.test.ts`  | Schema deleted                                                        |
| `packages/translation-prompt/src/schemas/review.schema.test.ts`    | Schema deleted (review half)                                          |
| `packages/translation-prompt/src/schemas/pipeline-trace.schema.ts` | Trace dropped entirely                                                |
| `packages/translation-prompt/src/sections/analysis.test.ts`        | Section deleted                                                       |
| `packages/translation-prompt/src/sections/review.test.ts`          | Section deleted                                                       |

---

## Task 1: New `buildSingleCallPrompts` — TDD

**Files:**

- Create: `packages/translation-prompt/src/sections/single-call.ts`
- Modify: `packages/translation-prompt/src/translation-prompt.ts`
- Modify: `packages/translation-prompt/src/translation-prompt.test.ts`

- [ ] **Step 1.1: Rewrite the test file first**

Replace the entire content of `packages/translation-prompt/src/translation-prompt.test.ts` with:

```typescript
import { describe, it, expect } from 'bun:test'
import { buildSingleCallPrompts, TranslationDraftSchema } from './translation-prompt'

describe('buildSingleCallPrompts', () => {
  it('returns PromptPair with system and user strings', () => {
    const result = buildSingleCallPrompts('テスト')
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
  })

  it('embeds source text in user prompt', () => {
    const text = 'お世話になっております。'
    const result = buildSingleCallPrompts(text)
    expect(result.user).toContain(text)
  })

  it('user prompt instructs JSON-only output', () => {
    const result = buildSingleCallPrompts('テスト')
    expect(result.user).toContain('JSON')
    expect(result.user).toContain('sourceLang')
    expect(result.user).toContain('translated')
  })

  it('system prompt contains expert persona', () => {
    const result = buildSingleCallPrompts('テスト')
    expect(result.system).toMatch(/20 years|elite.*translator|professional translator/i)
  })

  it('system prompt contains Vietnamese as target language', () => {
    const result = buildSingleCallPrompts('テスト')
    expect(result.system.toLowerCase()).toContain('vietnamese')
  })

  it('system prompt contains keigo register mapping', () => {
    const result = buildSingleCallPrompts('テスト')
    expect(result.system).toContain('Keigo')
    expect(result.system).toContain('敬語')
  })

  it('system prompt contains business formula rendering rules', () => {
    const result = buildSingleCallPrompts('お世話になっております')
    expect(result.system).toMatch(/functional Vietnamese|email formula|do not translate literally/i)
  })

  it('system prompt forbids gender inference from names', () => {
    const result = buildSingleCallPrompts('田中さん')
    expect(result.system).toMatch(/forbid.*gender|gender.*inference|do not.*anh.*chị|no.*gender/i)
  })

  it('system prompt contains humanizer anti-machine-translation rules', () => {
    const result = buildSingleCallPrompts('テスト')
    expect(result.system).toMatch(/không chỉ.*mà còn|machine.translation|DO NOT write/i)
  })

  it('system prompt contains hard constraints', () => {
    const result = buildSingleCallPrompts('テスト')
    expect(result.system).toMatch(/Hard Constraints|Do NOT add translator notes/i)
  })

  it('system prompt contains self-critique gate instruction', () => {
    const result = buildSingleCallPrompts('テスト')
    expect(result.system).toMatch(/natural flow|cultural fidelity|semantic accuracy/i)
  })

  it('system prompt contains IT/business terms to keep in English', () => {
    const result = buildSingleCallPrompts('テスト')
    expect(result.system).toMatch(/deploy|sprint|release/i)
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

- [ ] **Step 1.2: Run test to verify it fails**

```bash
bun test packages/translation-prompt/src/translation-prompt.test.ts
```

Expected: FAIL — `buildSingleCallPrompts is not exported`

- [ ] **Step 1.3: Create `packages/translation-prompt/src/sections/single-call.ts`**

This file assembles the dense system prompt from existing section modules:

```typescript
import { PERSONA, CORE_DOCTRINE } from '~/sections/core'
import { JAPANESE_RULES } from '~/sections/language-layers'
import { HUMANIZER, STRUCTURAL } from '~/sections/humanizer'
import { CONSTRAINTS } from '~/sections/constraints'

const INTERNAL_REASONING = `## Internal Reasoning Instruction (Do Not Output)

Before writing the translation, silently assess:
1. Source language — detect from script/vocabulary
2. Register/keigo level — map to the appropriate Vietnamese register
3. Communicative function — is this an email formula, apology, request, gratitude, maintenance notice, etc.?
4. Preservation flags — does text contain URLs, code, Chatwork markup, Japanese proper names, numeric units?
5. Rendering policy — literal mapping or functional communicative equivalent?

Then apply the self-critique gate before finalizing output:
- Natural flow: would a Vietnamese professional write this sentence exactly as written?
- Cultural fidelity: is the register/keigo mapping accurate and natural in Vietnamese?
- Semantic accuracy: nothing added, removed, softened, or amplified vs the source?

Only output the JSON after passing all three gates.`

export const SINGLE_CALL_SYSTEM = [
  PERSONA,
  CORE_DOCTRINE,
  JAPANESE_RULES,
  HUMANIZER,
  STRUCTURAL,
  CONSTRAINTS,
  INTERNAL_REASONING,
].join('\n\n')
```

- [ ] **Step 1.4: Add `buildSingleCallPrompts` to `translation-prompt.ts`**

Add the following import and function to `packages/translation-prompt/src/translation-prompt.ts` (keep old functions for now — they will be removed in Task 2):

```typescript
import { SINGLE_CALL_SYSTEM } from '~/sections/single-call'

/**
 * Single-call: expert prompt + self-critique gate in one shot.
 * Replaces the 3-phase buildAnalysisPrompts → buildTranslationPrompts → buildReviewPrompts pipeline.
 */
export function buildSingleCallPrompts(text: string): PromptPair {
  return {
    system: SINGLE_CALL_SYSTEM,
    user: `Translate the following text into natural Vietnamese.
Respond ONLY with valid JSON:
{"sourceLang": "<full English language name>", "translated": "<Vietnamese translation>"}

Text:
${text}`,
  }
}
```

Also add the export to `packages/translation-prompt/src/index.ts`:

```typescript
export { buildSingleCallPrompts } from './translation-prompt'
```

- [ ] **Step 1.5: Run test to verify it passes**

```bash
bun test packages/translation-prompt/src/translation-prompt.test.ts
```

Expected: All tests PASS

- [ ] **Step 1.6: Commit**

```bash
git add packages/translation-prompt/src/sections/single-call.ts \
        packages/translation-prompt/src/translation-prompt.ts \
        packages/translation-prompt/src/translation-prompt.test.ts \
        packages/translation-prompt/src/index.ts
git commit -m "feat(translation-prompt): add buildSingleCallPrompts with embedded expert prompt"
```

---

## Task 2: Remove dead code from `translation-prompt` package

**Files:**

- Modify: `packages/translation-prompt/src/translation-prompt.ts` (remove old functions)
- Modify: `packages/translation-prompt/src/index.ts` (remove old exports)
- Delete: `packages/translation-prompt/src/sections/analysis.ts`
- Delete: `packages/translation-prompt/src/sections/analysis.test.ts`
- Delete: `packages/translation-prompt/src/sections/review.ts`
- Delete: `packages/translation-prompt/src/sections/review.test.ts`
- Delete: `packages/translation-prompt/src/sections/hints.ts`
- Delete: `packages/translation-prompt/src/schemas/analysis.schema.ts`
- Delete: `packages/translation-prompt/src/schemas/analysis.schema.test.ts`
- Delete: `packages/translation-prompt/src/schemas/review.schema.ts`
- Delete: `packages/translation-prompt/src/schemas/review.schema.test.ts`
- Delete: `packages/translation-prompt/src/schemas/pipeline-trace.schema.ts`

- [ ] **Step 2.1: Strip dead functions from `translation-prompt.ts`**

The final state of `packages/translation-prompt/src/translation-prompt.ts` after this step (replace the whole file):

```typescript
import { SINGLE_CALL_SYSTEM } from '~/sections/single-call'
import { TranslationDraftSchema } from '~/schemas/review.schema'

/** Prompt input pair for LLM execution. */
export interface PromptPair {
  system: string
  user: string
}

export { TranslationDraftSchema }
export type { TranslationDraft } from '~/schemas/review.schema'

/**
 * Single-call: expert prompt + self-critique gate in one shot.
 * Replaces the 3-phase analysis → translation → review pipeline.
 */
export function buildSingleCallPrompts(text: string): PromptPair {
  return {
    system: SINGLE_CALL_SYSTEM,
    user: `Translate the following text into natural Vietnamese.
Respond ONLY with valid JSON:
{"sourceLang": "<full English language name>", "translated": "<Vietnamese translation>"}

Text:
${text}`,
  }
}
```

Everything else in the file is deleted: all imports from `~/sections/analysis`, `~/sections/review`, `~/sections/hints`, all old function exports, all type/schema re-exports for `AnalysisResult`, `ReviewResult`, `PipelineTrace`, `AnalysisSchema`, `ReviewSchema`, `PipelineTraceSchema`.

> `TranslationDraftSchema` lives in `review.schema.ts` alongside `ReviewSchema`. Do NOT delete `review.schema.ts` — strip it in Step 2.3 instead.

- [ ] **Step 2.2: Clean `index.ts` exports**

`packages/translation-prompt/src/index.ts` should export only:

```typescript
export { buildSingleCallPrompts, TranslationDraftSchema } from './translation-prompt'
export type { TranslationDraft, PromptPair } from './translation-prompt'
```

- [ ] **Step 2.3: Strip `ReviewSchema`/`ReviewResult` from `review.schema.ts`**

In `packages/translation-prompt/src/schemas/review.schema.ts`, delete the `ReviewSchema` and `ReviewResult` export. Keep only `TranslationDraftSchema` and `TranslationDraft`.

- [ ] **Step 2.4: Delete dead section and schema files**

```bash
rm packages/translation-prompt/src/sections/analysis.ts
rm packages/translation-prompt/src/sections/analysis.test.ts
rm packages/translation-prompt/src/sections/review.ts
rm packages/translation-prompt/src/sections/review.test.ts
rm packages/translation-prompt/src/sections/hints.ts
rm packages/translation-prompt/src/schemas/analysis.schema.ts
rm packages/translation-prompt/src/schemas/analysis.schema.test.ts
rm packages/translation-prompt/src/schemas/review.schema.test.ts
rm packages/translation-prompt/src/schemas/pipeline-trace.schema.ts
```

- [ ] **Step 2.5: Run translation-prompt tests only (scoped — do NOT run full typecheck yet)**

```bash
bun test packages/translation-prompt
```

Expected: All translation-prompt tests PASS

> **Why no full typecheck here:** `packages/translator/src/pipeline/pipeline.ts` still imports
> the removed symbols (`buildAnalysisPrompts`, `AnalysisSchema`, etc.) until Task 6 rewrites it.
> Running `bun run typecheck` at this point would fail on the translator package.
> Full typecheck runs after Task 6 (Step 6.5).

- [ ] **Step 2.6: Commit**

```bash
git add -A packages/translation-prompt/
git commit -m "refactor(translation-prompt): remove multi-phase functions and dead schemas"
```

---

## Task 3: OpenAI `resolveThinking` — TDD

**Files:**

- Modify: `packages/provider-openai/src/openai-plugin.ts`
- Modify: `packages/provider-openai/src/openai-plugin.test.ts`

- [ ] **Step 3.1: Write failing tests**

Add to `packages/provider-openai/src/openai-plugin.test.ts`:

```typescript
import { describe, it, expect, mock } from 'bun:test'

// We test resolveThinking by instantiating OpenAIExecutor via duck-typing.
// Since the method is private, we test its observable effect:
// when a reasoning-capable modelId is used, generateText receives providerOptions.

// Capture the last generateText call args
let lastGenerateTextCall: Record<string, unknown> = {}
mock.module('ai', () => ({
  generateText: async (args: Record<string, unknown>) => {
    lastGenerateTextCall = args
    return { output: { sourceLang: 'Japanese', translated: 'テスト' } }
  },
  Output: { object: (x: unknown) => x },
}))
mock.module('@ai-sdk/openai', () => ({
  openai: (id: string) => ({ modelId: id }),
}))

import { openaiPlugin } from './openai-plugin'

describe('OpenAI resolveThinking', () => {
  const schema = { parse: (x: unknown) => x }

  it('adds reasoningEffort for gpt-5.4', async () => {
    const executor = openaiPlugin.create({ modelId: 'gpt-5.4' })
    await executor.execute({ system: 's', user: 'u' }, schema as never)
    expect((lastGenerateTextCall.providerOptions as { openai?: unknown })?.openai).toEqual({
      reasoningEffort: 'medium',
    })
  })

  it('adds reasoningEffort for gpt-5-mini', async () => {
    const executor = openaiPlugin.create({ modelId: 'gpt-5-mini' })
    await executor.execute({ system: 's', user: 'u' }, schema as never)
    expect((lastGenerateTextCall.providerOptions as { openai?: unknown })?.openai).toEqual({
      reasoningEffort: 'medium',
    })
  })

  it('adds reasoningEffort for o4-mini', async () => {
    const executor = openaiPlugin.create({ modelId: 'o4-mini' })
    await executor.execute({ system: 's', user: 'u' }, schema as never)
    expect((lastGenerateTextCall.providerOptions as { openai?: unknown })?.openai).toEqual({
      reasoningEffort: 'medium',
    })
  })

  it('does NOT add providerOptions for gpt-4.1', async () => {
    const executor = openaiPlugin.create({ modelId: 'gpt-4.1' })
    await executor.execute({ system: 's', user: 'u' }, schema as never)
    expect(lastGenerateTextCall.providerOptions).toBeUndefined()
  })

  it('does NOT add providerOptions for gpt-4o', async () => {
    const executor = openaiPlugin.create({ modelId: 'gpt-4o' })
    await executor.execute({ system: 's', user: 'u' }, schema as never)
    expect(lastGenerateTextCall.providerOptions).toBeUndefined()
  })
})
```

- [ ] **Step 3.2: Run test to verify it fails**

```bash
bun test packages/provider-openai/src/openai-plugin.test.ts
```

Expected: FAIL (no `providerOptions` present yet)

- [ ] **Step 3.3: Add `resolveThinking` to `OpenAIExecutor`**

In `packages/provider-openai/src/openai-plugin.ts`, add to the `OpenAIExecutor` class:

```typescript
private resolveThinking(modelId: string): object | null {
  if (/^(gpt-5|o1|o3|o4)/.test(modelId)) {
    return { openai: { reasoningEffort: 'medium' } }
  }
  return null
}
```

And in `execute()`, spread `providerOptions` when non-null:

```typescript
const thinking = this.resolveThinking(this.modelId)
const { output } = await generateText({
  model: openai(this.modelId),
  system: prompts.system,
  prompt: prompts.user,
  output: Output.object({ schema: schema as any }),
  temperature: 0,
  maxOutputTokens: 4000,
  ...(thinking ? { providerOptions: thinking } : {}),
  ...(options?.signal && { abortSignal: options.signal }),
})
```

- [ ] **Step 3.4: Run test to verify it passes**

```bash
bun test packages/provider-openai/src/openai-plugin.test.ts
```

Expected: All tests PASS

- [ ] **Step 3.5: Commit**

```bash
git add packages/provider-openai/src/openai-plugin.ts \
        packages/provider-openai/src/openai-plugin.test.ts
git commit -m "feat(provider-openai): add resolveThinking for reasoning-capable models"
```

---

## Task 4: Gemini `resolveThinking` — TDD

**Files:**

- Modify: `packages/provider-gemini/src/gemini-plugin.ts`
- Modify: `packages/provider-gemini/src/gemini-plugin.test.ts`

- [ ] **Step 4.1: Write failing tests**

Add to `packages/provider-gemini/src/gemini-plugin.test.ts`:

```typescript
import { describe, it, expect, mock } from 'bun:test'

let lastGenerateTextCall: Record<string, unknown> = {}
mock.module('ai', () => ({
  generateText: async (args: Record<string, unknown>) => {
    lastGenerateTextCall = args
    return { output: { sourceLang: 'Japanese', translated: 'テスト' } }
  },
  Output: { object: (x: unknown) => x },
}))
mock.module('@ai-sdk/google', () => ({
  google: (id: string) => ({ modelId: id }),
}))

import { geminiPlugin } from './gemini-plugin'

describe('Gemini resolveThinking', () => {
  const schema = { parse: (x: unknown) => x }

  it('adds thinkingBudget for gemini-2.5-pro', async () => {
    const executor = geminiPlugin.create({ modelId: 'gemini-2.5-pro' })
    await executor.execute({ system: 's', user: 'u' }, schema as never)
    const po = lastGenerateTextCall.providerOptions as { google?: { thinkingConfig?: unknown } }
    expect(po?.google?.thinkingConfig).toEqual({ thinkingBudget: 8192 })
  })

  it('adds thinkingBudget for gemini-2.5-flash', async () => {
    const executor = geminiPlugin.create({ modelId: 'gemini-2.5-flash' })
    await executor.execute({ system: 's', user: 'u' }, schema as never)
    const po = lastGenerateTextCall.providerOptions as { google?: { thinkingConfig?: unknown } }
    expect(po?.google?.thinkingConfig).toEqual({ thinkingBudget: 8192 })
  })

  it('adds thinkingLevel for gemini-3-flash', async () => {
    const executor = geminiPlugin.create({ modelId: 'gemini-3-flash' })
    await executor.execute({ system: 's', user: 'u' }, schema as never)
    const po = lastGenerateTextCall.providerOptions as { google?: { thinkingConfig?: unknown } }
    expect(po?.google?.thinkingConfig).toEqual({ thinkingLevel: 'medium' })
  })

  it('adds thinkingLevel for gemini-3-pro-preview', async () => {
    const executor = geminiPlugin.create({ modelId: 'gemini-3-pro-preview' })
    await executor.execute({ system: 's', user: 'u' }, schema as never)
    const po = lastGenerateTextCall.providerOptions as { google?: { thinkingConfig?: unknown } }
    expect(po?.google?.thinkingConfig).toEqual({ thinkingLevel: 'medium' })
  })

  it('adds thinkingLevel for gemini-3.1-pro-preview', async () => {
    const executor = geminiPlugin.create({ modelId: 'gemini-3.1-pro-preview' })
    await executor.execute({ system: 's', user: 'u' }, schema as never)
    const po = lastGenerateTextCall.providerOptions as { google?: { thinkingConfig?: unknown } }
    expect(po?.google?.thinkingConfig).toEqual({ thinkingLevel: 'medium' })
  })

  it('does NOT add providerOptions for gemini-2.0-flash', async () => {
    const executor = geminiPlugin.create({ modelId: 'gemini-2.0-flash' })
    await executor.execute({ system: 's', user: 'u' }, schema as never)
    expect(lastGenerateTextCall.providerOptions).toBeUndefined()
  })
})
```

- [ ] **Step 4.2: Run test to verify it fails**

```bash
bun test packages/provider-gemini/src/gemini-plugin.test.ts
```

Expected: FAIL

- [ ] **Step 4.3: Add `resolveThinking` to `GeminiExecutor`**

In `packages/provider-gemini/src/gemini-plugin.ts`, add to the class:

```typescript
private resolveThinking(modelId: string): object | null {
  if (/^gemini-3[.-]/.test(modelId)) {
    return { google: { thinkingConfig: { thinkingLevel: 'medium' } } }
  }
  if (/^gemini-2\.5/.test(modelId)) {
    return { google: { thinkingConfig: { thinkingBudget: 8192 } } }
  }
  return null
}
```

And in `execute()`:

```typescript
const thinking = this.resolveThinking(this.modelId)
const { output } = await generateText({
  model: google(this.modelId),
  system: prompts.system,
  prompt: prompts.user,
  output: Output.object({ schema: outputSchema }),
  temperature: 0,
  maxOutputTokens: 4000,
  ...(thinking ? { providerOptions: thinking } : {}),
  ...(options?.signal && { abortSignal: options.signal }),
})
```

- [ ] **Step 4.4: Run test to verify it passes**

```bash
bun test packages/provider-gemini/src/gemini-plugin.test.ts
```

Expected: All tests PASS

- [ ] **Step 4.5: Commit**

```bash
git add packages/provider-gemini/src/gemini-plugin.ts \
        packages/provider-gemini/src/gemini-plugin.test.ts
git commit -m "feat(provider-gemini): add resolveThinking for Gemini 2.5/3.x models"
```

---

## Task 5: `TranslatorPhase` + env schema + phaseBudgets cleanup

**Files:**

- Modify: `packages/translator/src/types/observability.ts`
- Modify: `packages/translator/src/env-schema.ts`
- Modify: `packages/translator/src/services/translator-observability-runtime.ts`
- Modify: `packages/translator/src/env.test.ts`
- Modify: `packages/translator/src/services/phase-observer.test.ts`

- [ ] **Step 5.1: Remove `'analysis'` and `'review'` from `TranslatorPhase`**

In `packages/translator/src/types/observability.ts` line 1:

```typescript
// Before
export type TranslatorPhase = 'analysis' | 'translation' | 'review' | 'delivery' | 'ack_callback'

// After
export type TranslatorPhase = 'translation' | 'delivery' | 'ack_callback'
```

- [ ] **Step 5.2: Remove dead env vars from `env-schema.ts`**

In `packages/translator/src/env-schema.ts`, delete lines for `TRANSLATOR_ANALYSIS_BUDGET_MS` and `TRANSLATOR_REVIEW_BUDGET_MS`:

```typescript
// Remove these two lines:
TRANSLATOR_ANALYSIS_BUDGET_MS: z.coerce.number().int().positive().default(60_000),
TRANSLATOR_REVIEW_BUDGET_MS: z.coerce.number().int().positive().default(60_000),
```

- [ ] **Step 5.3: Drop `analysis`/`review` keys from `phaseBudgets`**

In `packages/translator/src/services/translator-observability-runtime.ts`:

```typescript
// Before
phaseBudgets: {
  analysis: env.TRANSLATOR_ANALYSIS_BUDGET_MS,
  translation: env.TRANSLATOR_TRANSLATION_BUDGET_MS,
  review: env.TRANSLATOR_REVIEW_BUDGET_MS,
  delivery: env.TRANSLATOR_DELIVERY_BUDGET_MS,
  ack_callback: env.TRANSLATOR_ACK_CALLBACK_BUDGET_MS,
},

// After
phaseBudgets: {
  translation: env.TRANSLATOR_TRANSLATION_BUDGET_MS,
  delivery: env.TRANSLATOR_DELIVERY_BUDGET_MS,
  ack_callback: env.TRANSLATOR_ACK_CALLBACK_BUDGET_MS,
},
```

- [ ] **Step 5.4: Update `phase-observer.test.ts`**

Find all `phaseBudgets` literals in `packages/translator/src/services/phase-observer.test.ts` and remove the `analysis` and `review` keys. Example:

```typescript
// Before
phaseBudgets: { analysis: 5, translation: 5, review: 5, delivery: 5, ack_callback: 5 }

// After
phaseBudgets: { translation: 5, delivery: 5, ack_callback: 5 }
```

- [ ] **Step 5.5: Update `env.test.ts`**

In `packages/translator/src/env.test.ts`, remove the two assertions for the deleted env vars:

```typescript
// Before (lines 25–27)
expect(env.TRANSLATOR_PHASE_HEARTBEAT_MS).toBe(30_000)
expect(env.TRANSLATOR_ANALYSIS_BUDGET_MS).toBe(60_000)
expect(env.TRANSLATOR_TRANSLATION_BUDGET_MS).toBe(60_000)
expect(env.TRANSLATOR_REVIEW_BUDGET_MS).toBe(60_000)
expect(env.TRANSLATOR_DELIVERY_BUDGET_MS).toBe(45_000)

// After
expect(env.TRANSLATOR_PHASE_HEARTBEAT_MS).toBe(30_000)
expect(env.TRANSLATOR_TRANSLATION_BUDGET_MS).toBe(60_000)
expect(env.TRANSLATOR_DELIVERY_BUDGET_MS).toBe(45_000)
```

- [ ] **Step 5.6: Run typecheck**

```bash
bun run typecheck
```

Expected: PASS (no excess-property errors on `phaseBudgets`)

> **Note:** If typecheck fails here with errors about `buildAnalysisPrompts` or similar in `pipeline.ts`, that is expected — `pipeline.ts` still imports removed symbols until Task 6. Focus only on `phaseBudgets` type errors. Full typecheck runs after Task 6 (Step 6.5).

- [ ] **Step 5.7: Run tests**

```bash
bun test packages/translator/src/services/phase-observer.test.ts \
         packages/translator/src/env.test.ts
```

Expected: PASS

- [ ] **Step 5.8: Commit**

```bash
git add packages/translator/src/types/observability.ts \
        packages/translator/src/env-schema.ts \
        packages/translator/src/services/translator-observability-runtime.ts \
        packages/translator/src/services/phase-observer.test.ts \
        packages/translator/src/env.test.ts
git commit -m "refactor(translator): remove analysis/review from TranslatorPhase and env schema"
```

---

## Task 6: Rewrite pipeline — 1 call, no loop

**Files:**

- Modify: `packages/translator/src/pipeline/pipeline.ts`
- Modify: `packages/translator/src/pipeline/pipeline.test.ts`

- [ ] **Step 6.1: Rewrite `pipeline.test.ts` first**

Replace the content of `packages/translator/src/pipeline/pipeline.test.ts` with:

```typescript
import { describe, it, expect, mock } from 'bun:test'
import type { ILLMExecutor, PromptPair, ISchema } from '@chatwork-bot/core'
import { TranslationPipeline } from './pipeline'

function makeExecutor(result = { sourceLang: 'Japanese', translated: 'こんにちは→xin chào' }) {
  let callCount = 0
  const executor: ILLMExecutor = {
    async execute<T>(_prompts: PromptPair, _schema: ISchema<T>) {
      callCount++
      return result as unknown as T
    },
  }
  return { executor, getCallCount: () => callCount }
}

describe('TranslationPipeline', () => {
  it('calls executor exactly once for any text', async () => {
    const { executor, getCallCount } = makeExecutor()
    const pipeline = new TranslationPipeline(executor)
    await pipeline.run('お世話になっております。')
    expect(getCallCount()).toBe(1)
  })

  it('calls executor exactly once for short text', async () => {
    const { executor, getCallCount } = makeExecutor()
    const pipeline = new TranslationPipeline(executor)
    await pipeline.run('OK')
    expect(getCallCount()).toBe(1)
  })

  it('returns TranslationResult with translatedText from executor', async () => {
    const { executor } = makeExecutor({ sourceLang: 'Japanese', translated: 'Xin chào' })
    const pipeline = new TranslationPipeline(executor)
    const result = await pipeline.run('こんにちは')
    expect(result.translatedText).toBe('Xin chào')
    expect(result.sourceLang).toBe('Japanese')
    expect(result.targetLang).toBe('Vietnamese')
  })

  it('passes the source text to buildSingleCallPrompts (text appears in executor prompts)', async () => {
    let capturedPrompts: PromptPair | null = null
    const executor: ILLMExecutor = {
      async execute<T>(prompts: PromptPair, _schema: ISchema<T>) {
        capturedPrompts = prompts
        return { sourceLang: 'Japanese', translated: 'テスト' } as unknown as T
      },
    }
    const pipeline = new TranslationPipeline(executor)
    await pipeline.run('リリース予定について')
    expect(capturedPrompts?.user).toContain('リリース予定について')
  })

  it('throws TranslationError on abort', async () => {
    const controller = new AbortController()
    controller.abort()
    const { executor } = makeExecutor()
    const pipeline = new TranslationPipeline(executor)
    await expect(pipeline.run('テスト', { signal: controller.signal })).rejects.toMatchObject({
      code: 'ABORTED',
    })
  })
})
```

- [ ] **Step 6.2: Run test to verify it fails**

```bash
bun test packages/translator/src/pipeline/pipeline.test.ts
```

Expected: FAIL — current pipeline has multi-round behavior

- [ ] **Step 6.3: Rewrite `pipeline.ts`**

Replace entire content of `packages/translator/src/pipeline/pipeline.ts`:

```typescript
import type { ILLMExecutor } from '@chatwork-bot/core'
import { TranslationError } from '@chatwork-bot/core'
import type { TranslationResult } from '@chatwork-bot/core'
import { buildSingleCallPrompts, TranslationDraftSchema } from '@chatwork-bot/translation-prompt'
import { DEFAULT_TRANSLATOR_PIPELINE_TIMEOUT_MS } from '~/services/pipeline-timeout'

export interface PipelineRunOptions {
  signal?: AbortSignal
  timeoutMs?: number
  phaseObserver?: {
    onPhaseStarted?: (params: { phase: 'translation'; escalated: false }) => Promise<void> | void
    onPhaseCompleted?: (params: { phase: 'translation'; escalated: false }) => Promise<void> | void
    onPhaseFailed?: (params: {
      phase: 'translation'
      escalated: false
      error: unknown
    }) => Promise<void> | void
  }
}

export const DEFAULT_TIMEOUT_MS = DEFAULT_TRANSLATOR_PIPELINE_TIMEOUT_MS

export class TranslationPipeline {
  constructor(
    private readonly executor: ILLMExecutor,
    private readonly opts: { timeoutMs?: number } = {},
  ) {}

  async run(text: string, options: PipelineRunOptions = {}): Promise<TranslationResult> {
    const startMs = Date.now()
    const signal = this.buildSignal(options)

    this.checkAbort(signal)

    const phase = 'translation' as const
    const phaseParams = { phase, escalated: false as const }

    await options.phaseObserver?.onPhaseStarted?.(phaseParams)

    let draft: { sourceLang: string; translated: string }
    try {
      draft = await this.executor.execute(buildSingleCallPrompts(text), TranslationDraftSchema, {
        signal,
      })
      await options.phaseObserver?.onPhaseCompleted?.(phaseParams)
    } catch (error) {
      await options.phaseObserver?.onPhaseFailed?.({ ...phaseParams, error })
      throw error
    }

    void startMs // durationMs available if needed for future logging
    return {
      cleanText: text,
      translatedText: draft.translated,
      sourceLang: draft.sourceLang,
      targetLang: 'Vietnamese',
      timestamp: new Date().toISOString(),
    }
  }

  private buildSignal(options: PipelineRunOptions): AbortSignal {
    const timeoutMs = options.timeoutMs ?? this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const timeoutController = new AbortController()
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

    if (options.signal) {
      if (options.signal.aborted) {
        timeoutController.abort(this.toAbortReason(options.signal.reason))
      } else {
        options.signal.addEventListener(
          'abort',
          () => {
            timeoutController.abort(this.toAbortReason(options.signal?.reason))
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
}
```

- [ ] **Step 6.4: Run test to verify it passes**

```bash
bun test packages/translator/src/pipeline/pipeline.test.ts
```

Expected: All tests PASS

- [ ] **Step 6.5: Run full test suite**

```bash
bun test && bun run typecheck
```

Expected: PASS

- [ ] **Step 6.6: Commit**

```bash
git add packages/translator/src/pipeline/pipeline.ts \
        packages/translator/src/pipeline/pipeline.test.ts
git commit -m "refactor(translator): collapse pipeline to single executor call"
```

---

## Task 7: Handler + output type cleanup

**Files:**

- Modify: `packages/translator/src/types/output.ts`
- Modify: `packages/translator/src/webhook/handler.ts`
- Modify: `packages/translator/src/webhook/handler.test.ts`

- [ ] **Step 7.1: Clean up `output.ts`**

In `packages/translator/src/types/output.ts`:

- Remove the `import type { PipelineTrace } from '@chatwork-bot/translation-prompt'` line
- Remove the `pipeline?: PipelineTrace` field from `OutputRecord`

Result:

```typescript
import type { TranslationIngressCommand, TranslationResult } from '@chatwork-bot/core'

export interface OutputOrigin {
  type: 'manual' | 'automation'
  datasetFile?: string
  datasetItemId?: string
  datasetLineNumber?: number
}

export interface OutputDelivery {
  status: 'sent' | 'failed'
  destinationRoomId: number
  destinationMessageId?: string
  errorCode?: string
  errorMessage?: string
  sentAt: string
}

export interface OutputRecord {
  command: TranslationIngressCommand
  translation: TranslationResult
  origin?: OutputOrigin
  delivery?: OutputDelivery
}
```

- [ ] **Step 7.2: Update `handler.ts`**

In `packages/translator/src/webhook/handler.ts`, apply these targeted changes:

**Change 1** — line 109: unwrap pipeline result (no trace)

```typescript
// Before
const { result, trace } = await pipeline.run(cleanText, {
  phaseObserver: {
    onPhaseStarted: ({ phase, round }) => {
      observer.markPhaseStarted(phase, {
        ...(round !== undefined ? { phaseRound: round } : {}),
      })
    },

// After
const result = await pipeline.run(cleanText, {
  phaseObserver: {
    onPhaseStarted: ({ phase }) => {
      observer.markPhaseStarted(phase, {})
    },
```

**Change 2** — remove `onEscalationStarted` and `onEscalationCompleted` callbacks entirely (lines 122–133 in original):

```typescript
// Remove these two callbacks from the phaseObserver object:
onEscalationStarted: ({ round }) => {
  observer.logEvent('info', 'translation_escalation_started', {
    phase: 'review',
    phaseRound: round,
  })
},
onEscalationCompleted: ({ round }) => {
  observer.logEvent('info', 'translation_escalation_completed', {
    phase: 'review',
    phaseRound: round,
  })
},
```

**Change 3** — line 139: drop `pipeline: trace` from output record

```typescript
// Before
const outputRecord = { command, translation: result, pipeline: trace, origin }

// After
const outputRecord = { command, translation: result, origin }
```

- [ ] **Step 7.3: Update `handler.test.ts`**

In `packages/translator/src/webhook/handler.test.ts`:

- Change `{ result, trace }` mock return to just `result` (plain `TranslationResult` object, not wrapped)
- Remove `TRANSLATOR_ANALYSIS_BUDGET_MS` and `TRANSLATOR_REVIEW_BUDGET_MS` from the mock env object

- [ ] **Step 7.4: Run tests**

```bash
bun test packages/translator/src/webhook/handler.test.ts
bun run typecheck
```

Expected: PASS

- [ ] **Step 7.5: Commit**

```bash
git add packages/translator/src/types/output.ts \
        packages/translator/src/webhook/handler.ts \
        packages/translator/src/webhook/handler.test.ts
git commit -m "refactor(translator): remove PipelineTrace from output and handler"
```

---

## Task 8: Startup banner — add `thinking` column

**Files:**

- Modify: `packages/translator/src/bootstrap/startup-banner.ts`
- Modify: `packages/translator/src/bootstrap/startup-banner.test.ts`

- [ ] **Step 8.1: Update `BannerConfig` and `logStartupBanner`**

In `packages/translator/src/bootstrap/startup-banner.ts`:

1. Add `thinking: boolean` to `BannerConfig` interface
2. Update `rows` mapping to include a `thinking` field: `yes` / `no`
3. Add `thinking` column to the table (similar to existing columns)

```typescript
interface BannerConfig {
  provider: string
  model: string
  port: number
  nodeEnv: string
  effectiveTimeoutMs: number
  timeoutSource: PipelineTimeoutSource
  thinking: boolean // NEW: whether the active model supports thinking
}

// In rows mapping:
return {
  provider,
  models,
  default: p.manifest.defaultModel,
  timeout,
  thinking: isActive ? (config.thinking ? 'yes' : 'no') : '',
}
```

Add `thinking` to `col` width calculation and `row()` function.

- [ ] **Step 8.2: Update the caller — `server.ts`**

In `packages/translator/src/server.ts`, add a local helper and pass `thinking` to `logStartupBanner`. No provider file changes are needed here — the logic lives entirely in `server.ts`:

```typescript
function resolveThinkingSupport(provider: string, modelId: string): boolean {
  if (provider === 'openai') return /^(gpt-5|o1|o3|o4)/.test(modelId)
  if (provider === 'gemini') return /^gemini-3[.-]/.test(modelId) || /^gemini-2\.5/.test(modelId)
  return false
}
```

Pass `thinking: resolveThinkingSupport(env.AI_PROVIDER, modelId)` to `logStartupBanner`.

- [ ] **Step 8.3: Update `startup-banner.test.ts`**

Add or update the test to assert that the `thinking` column appears in the output when `thinking: true` is passed to `logStartupBanner`.

- [ ] **Step 8.4: Run tests**

```bash
bun test packages/translator/src/bootstrap/startup-banner.test.ts
bun run typecheck
```

Expected: PASS

- [ ] **Step 8.5: Commit**

```bash
git add packages/translator/src/bootstrap/startup-banner.ts \
        packages/translator/src/bootstrap/startup-banner.test.ts \
        packages/translator/src/server.ts
git commit -m "feat(translator): add thinking column to startup banner"
```

> Provider plugin files (`openai-plugin.ts`, `gemini-plugin.ts`) were already committed in Tasks 3 and 4. `resolveThinkingSupport` in `server.ts` is a local helper — no provider file changes needed here.

---

## Task 9: Full verification

- [ ] **Step 9.1: Run full suite**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: All PASS, zero errors, zero lint warnings

- [ ] **Step 9.2: Verify no dead imports remain**

```bash
bun run lint
```

Check that no files import `AnalysisSchema`, `ReviewSchema`, `PipelineTraceSchema`, `buildAnalysisPrompts`, `buildTranslationPrompts`, `buildReviewPrompts`.

- [ ] **Step 9.3: Verify executor call count (acceptance criteria)**

Review `pipeline.test.ts` — confirm the test `calls executor exactly once for any text` PASSES. This is the primary acceptance criterion.

- [ ] **Step 9.4: Final commit if any lint fixes were needed**

```bash
git add -A
git commit -m "chore(repo): final lint cleanup after single-call pipeline refactor"
```

---

## Acceptance Criteria Checklist

- [ ] `pipeline.run(text)` makes exactly 1 `executor.execute()` call — verified by test
- [ ] `buildSingleCallPrompts(text)` system prompt contains persona, keigo table, formula rules, humanizer rules, hard constraints, self-critique gate — verified by tests
- [ ] OpenAI: `gpt-5.x` / `o1` / `o3` / `o4` → `providerOptions.openai.reasoningEffort` — verified by tests
- [ ] Gemini: `gemini-2.5.x` → `thinkingBudget: 8192`; `gemini-3-flash`, `gemini-3-pro-preview`, `gemini-3.1-*` → `thinkingLevel: 'medium'` — verified by tests
- [ ] No `AnalysisSchema`, `ReviewSchema`, `PipelineTraceSchema` in any import — verified by lint
- [ ] `handler.ts` output record has no `pipeline` field — verified by typecheck
- [ ] `bun test && bun run typecheck && bun run lint` passes — verified in Task 9
