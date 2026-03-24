# Design: Single-Call Translation Pipeline with Native Thinking

**Version:** 1.0
**Date:** 2026-03-24
**Prepared by (AI-assisted):** Claude Sonnet 4.6
**Status:** Approved — pending implementation

---

## 1. Objective

Reduce the translation pipeline from 3–8 API calls per trigger to exactly **1 API call**, while maintaining output quality (natural, expert-level Japanese→Vietnamese translation). Leverage native thinking/reasoning tokens where the model supports them so the model reasons internally without additional round-trips.

---

## 2. Problem Statement

### Current pipeline (multi-phase)

```
text
 → [Call 1] buildAnalysisPrompts   → AnalysisResult JSON (14D skopos analysis)
 → [Call 2] buildTranslationPrompts(text, analysis) → draft
 → [Call 3–7] buildReviewPrompts × up to 5 review rounds (MQM-Lite)
 → [Call N] Escalation: switchSkopos → rebuild draft → more review rounds
```

**Minimum 3 calls, worst-case 8+ calls.** Token cost per trigger: ~5k–20k tokens.

### Root cause

Analysis JSON was an explicit intermediate step to structure the LLM's reasoning. Review loop was a quality gate. Both are replaceable by native model reasoning (thinking tokens) combined with a single dense expert prompt.

### Research backing

- "Direct translation + self-refinement in 1 call achieves performance comparable to or exceeding multi-pass prompting" (2025, arxiv 2506.04521).
- Extended thinking/CoT tokens do not significantly improve MT quality beyond a well-crafted single prompt for frontier models (2025, arxiv 2510.11919).
- Quality comes from prompt context richness, not number of pipeline stages.

---

## 3. Scope

### In scope

- New `buildSingleCallPrompts(text: string): PromptPair` in `@chatwork-bot/translation-prompt`
- Provider-level thinking/reasoning integration (OpenAI `reasoningEffort`, Gemini `thinkingConfig`)
- Pipeline simplification: 1 executor call, no analysis/review/escalation phases
- Drop `PipelineTrace`, `AnalysisSchema`, `ReviewSchema` from codebase
- Simplify handler to remove trace from output record
- Update all tests

### Out of scope

- Streaming output
- Fine-tuning any model
- Multi-language pair support (still Japanese→Vietnamese + multilingual fallback as today)
- Dataset-runner structural changes (it only reads `translation` field, not `pipeline` trace)

---

## 4. Architecture

### After

```
text → buildSingleCallPrompts(text) → executor.execute() [+thinking if supported] → {sourceLang, translated}
```

Single phase: `translation`. No analysis, no review, no escalation.

### Data flow

```
WebhookHandler
  └─ TranslationPipeline.run(text)
        └─ executor.execute(buildSingleCallPrompts(text), TranslationDraftSchema)
              └─ Provider internally adds thinking providerOptions if modelId supports it
                    └─ LLM responds: {"sourceLang":"...", "translated":"..."}
```

---

## 5. `packages/translation-prompt` — changes

### New function: `buildSingleCallPrompts(text: string): PromptPair`

One function replaces three (`buildAnalysisPrompts`, `buildTranslationPrompts`, `buildReviewPrompts`).

**System prompt structure (~2800 tokens):**

1. **Expert persona** — 20+ years JP→VI translator, keigo specialist (from `core.ts`)
2. **Core doctrine** — Natural Vietnamese First, Modern Professional Tone, Cultural Fidelity, Preserve Meaning Precisely (from `core.ts`)
3. **Internal reasoning instruction** — Before writing the translation, the model must silently assess: source language detection, register/keigo level, communicative function (email formula / request / apology / etc.), preservation flags (URL, code, Chatwork markup, Japanese names), rendering policy (literal vs functional)
4. **Keigo register mapping table** (from `language-layers.ts`)
5. **Business formula rules** — render by communicative function, not literal surface (from `language-layers.ts`)
6. **IT/business terms to keep in English** (from `language-layers.ts`)
7. **Proper noun and name handling** (from `language-layers.ts`)
8. **Humanizer rules** — DO/DO NOT patterns, anti-machine-translation signals (from `humanizer.ts`)
9. **Structural/formatting doctrine** — Tier 1/2/3 line break rules (from `humanizer.ts`)
10. **Hard constraints** (from `constraints.ts`)
11. **Embedded self-critique gate** — Model must internally verify three quality lenses before finalizing output:
    - Natural flow: would a Vietnamese professional write this?
    - Cultural fidelity: is register/keigo mapping accurate?
    - Semantic accuracy: nothing added, removed, or distorted?

**User prompt:**

```
Translate the following text into natural Vietnamese.
Respond ONLY with valid JSON:
{"sourceLang": "<full English language name>", "translated": "<Vietnamese translation>"}

Text:
{text}
```

**Output schema:** unchanged — `TranslationDraftSchema` (`{sourceLang: string, translated: string}`).

### Removed exports

| Removed                                | Reason                               |
| -------------------------------------- | ------------------------------------ |
| `buildAnalysisPrompts`                 | Replaced by `buildSingleCallPrompts` |
| `buildTranslationPrompts`              | Replaced by `buildSingleCallPrompts` |
| `buildReviewPrompts`                   | Replaced by `buildSingleCallPrompts` |
| `AnalysisSchema`, `AnalysisResult`     | No intermediate analysis JSON        |
| `ReviewSchema`, `ReviewResult`         | No review loop                       |
| `PipelineTraceSchema`, `PipelineTrace` | Trace dropped                        |

### Kept exports

- `buildSingleCallPrompts` (new)
- `TranslationDraftSchema`, `TranslationDraft`
- `PromptPair`

---

## 6. Provider capability system

### Key finding

Current providers use `generateText` + `Output.object({ schema })` — this **is compatible** with OpenAI reasoning models (`reasoningEffort`). The incompatibility restriction applies only to `generateObject()`, which is not used here.

### Strategy: provider self-aware (no interface changes)

`ILLMExecutor.execute()` signature is **unchanged**. Each provider executor internally resolves whether the current `modelId` supports thinking and adds the appropriate `providerOptions` to `generateText`.

### OpenAI provider

```typescript
// Detect reasoning-capable models
private resolveThinking(modelId: string): object | null {
  if (/^(gpt-5|o1|o3|o4)/.test(modelId)) {
    return { openai: { reasoningEffort: 'medium' } }
  }
  return null
}

// In execute():
const thinking = this.resolveThinking(this.modelId)
await generateText({
  ...baseConfig,
  ...(thinking ? { providerOptions: thinking } : {}),
})
```

`reasoningEffort: 'medium'` — balances quality vs token cost. Can be elevated to `'high'` via env var `OPENAI_REASONING_EFFORT` if needed.

### Gemini provider

```typescript
private resolveThinking(modelId: string): object | null {
  // Gemini 3.x — thinkingLevel
  if (/^gemini-(3\.)/.test(modelId)) {
    return { google: { thinkingConfig: { thinkingLevel: 'medium' } } }
  }
  // Gemini 2.5.x — thinkingBudget
  if (/^gemini-2\.5/.test(modelId)) {
    return { google: { thinkingConfig: { thinkingBudget: 8192 } } }
  }
  return null
}
```

### Cursor provider

No thinking support. No changes.

### `result.reasoning`

Not captured. Thinking tokens are internal-only — they reason without appearing in the stored output.

### Startup banner

Add `thinking` column to provider table in startup banner to show whether current model supports thinking.

---

## 7. `packages/translator` — pipeline simplification

### `pipeline.ts` — before vs after

**Before:** ~370 lines — analysis phase, translation phase, review loop (MAX_ROUNDS=5), escalation logic, fast path, PipelineTrace assembly.

**After:** ~80 lines — single executor call, single phase, return `TranslationResult` directly.

**Removed:**

- `MAX_ROUNDS`, `ESCALATION_ROUND`, `SHORT_TEXT_THRESHOLD` constants
- `shouldUseFastPath()` (fast path = 1 call for all text, no distinction needed)
- Review loop `for (round = 1..MAX_ROUNDS)`
- Escalation: `switchSkopos()`, `onEscalationStarted`, `onEscalationCompleted`
- `buildFastPathAnalysis()`
- `makeNullReview()`
- `PipelineRunResult` type (or simplified to just `TranslationResult`)

**Phase observer:** Only `translation` phase remains. `PipelineRunOptions.phaseObserver` interface drops `onEscalationStarted` and `onEscalationCompleted`.

### `handler.ts` — changes

```typescript
// Before
const { result, trace } = await pipeline.run(cleanText, { phaseObserver: {...} })
const outputRecord = { command, translation: result, pipeline: trace, origin }

// After
const result = await pipeline.run(cleanText, { phaseObserver: {...} })
const outputRecord = { command, translation: result, origin }
```

Remove `onEscalationStarted` and `onEscalationCompleted` callbacks from phaseObserver.

`TranslatorPhase` type: remove `'analysis'` and `'review'` variants (keep `'translation'`, `'delivery'`, `'ack_callback'`).

### `output-writer.ts`

Remove `pipeline` field from output record type. Simplify output JSON schema.

---

## 8. Tests

| File                         | Action                                                                                 |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| `translation-prompt.test.ts` | Rewrite — test `buildSingleCallPrompts` output shape, system prompt contains key rules |
| `analysis.test.ts`           | Delete                                                                                 |
| `review.test.ts`             | Delete                                                                                 |
| `analysis.schema.test.ts`    | Delete                                                                                 |
| `review.schema.test.ts`      | Delete                                                                                 |
| `pipeline.test.ts`           | Rewrite — 1 executor mock call, no multi-round mocks                                   |
| `openai-plugin.test.ts`      | Add tests for `resolveThinking()` — reasoning models get providerOptions               |
| `gemini-plugin.test.ts`      | Add tests for `resolveThinking()` — 2.5 vs 3.x thinkingConfig                          |

---

## 9. Acceptance criteria

- [ ] `pipeline.run(text)` makes exactly 1 `executor.execute()` call for any input (short or long, simple or complex)
- [ ] `buildSingleCallPrompts(text)` returns a `PromptPair` with system prompt containing: persona, keigo table, formula rules, humanizer rules, hard constraints, self-critique gate
- [ ] OpenAI executor: `gpt-5.x` / `o1` / `o3` / `o4` model IDs → `providerOptions.openai.reasoningEffort` present in `generateText` call
- [ ] Gemini executor: `gemini-2.5.x` → `thinkingBudget: 8192`; `gemini-3.x` → `thinkingLevel: 'medium'`
- [ ] No `AnalysisSchema`, `ReviewSchema`, `PipelineTraceSchema` in any import
- [ ] `handler.ts` output record has no `pipeline` field
- [ ] `bun test && bun run typecheck && bun run lint` passes

---

## 10. Token cost estimate

| Scenario                | Before          | After                                |
| ----------------------- | --------------- | ------------------------------------ |
| Best case (3 calls)     | ~7,500 tokens   | ~3,700 tokens                        |
| Typical (4 calls)       | ~11,000 tokens  | ~3,700 tokens                        |
| Worst case (8 calls)    | ~20,000+ tokens | ~3,700 tokens                        |
| With thinking (gpt-5.4) | —               | ~3,700 + reasoning tokens (internal) |

**Reduction: 50–80% token cost per trigger.**

---

## 11. Risks and open questions

| Risk                                                                | Mitigation                                                                                                    |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Quality regression for complex keigo texts                          | Run dataset before/after comparison; rollback is a git revert                                                 |
| gpt-5.4 does not expose `reasoningEffort` via AI SDK                | `resolveThinking()` returns `null` gracefully → falls back to collapsed prompt without thinking; still 1 call |
| Gemini model version regex mismatch                                 | Unit tests cover known model ID patterns; fallback is `null` (no thinking)                                    |
| `Output.object` + `reasoningEffort` conflict in future SDK versions | Pinned via `bun.lock`; monitor AI SDK changelogs                                                              |

---

## 12. Explicit decisions made

| Decision                                               | Source                         | Notes                                                    |
| ------------------------------------------------------ | ------------------------------ | -------------------------------------------------------- |
| Collapsed prompt over multi-step pipeline              | User-confirmed                 | Research shows comparable quality                        |
| Native thinking over Chain-of-Draft                    | User-confirmed                 | CoD visible in output tokens; thinking is internal       |
| Provider self-aware (no ILLMExecutor interface change) | AI-recommended, user-confirmed | Cleanest encapsulation                                   |
| Drop PipelineTrace completely                          | User-confirmed                 | No consumers need analysis/review JSON                   |
| `reasoningEffort: 'medium'` default                    | AI-recommended                 | Balances quality vs cost; override via env if needed     |
| `thinkingBudget: 8192` for Gemini 2.5                  | AI-recommended                 | Mid-range; sufficient for short-medium business messages |

---

## 13. Out of scope / Future scope

- Per-request thinking budget override via webhook payload
- Streaming translation output
- Quality score reporting (replaced by direct output quality)
- Multi-provider routing (e.g., auto-select model by text complexity)
