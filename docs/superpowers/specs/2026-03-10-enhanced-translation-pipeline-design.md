# Enhanced Translation Pipeline — Design Spec

**Date**: 2026-03-10
**Status**: Approved
**Approach**: Big Bang — no backward compatibility, no feature flag

---

## 1. Architecture Overview

### Problem

Current pipeline: single-prompt → translate → done. Output is grammatically correct but machine-like. No quality gate, no iterative refinement, no cultural context awareness.

### Goal

Research-backed 4-phase pipeline producing human-like Vietnamese translations that pass AI-detection filters, with full developer trace visibility.

### 4-Phase Flow

```
Input text
   │
   ▼
Phase 0: Skopos Inference
   │  Purpose/audience/strategy detection
   │  Output: SkoposContext { purpose, audience, strategy, register }
   ▼
Phase 1: 14D Source Analysis
   │  Extratextual (Group B) + Intratextual (Group A) + Cross-cutting (Group C)
   │  Output: AnalysisResult (14 dimensions)
   ▼
Phase 2: Informed Translation
   │  Translation uses Phase 0+1 context
   │  Output: TranslationDraft { translated, sourceLang }
   ▼
Phase 3: 3-Persona Review Loop
   │  Persona A (Fresh Reader) + B (Linguist) + C (Tuổi Trẻ Editor)
   │  MQM-Lite scoring (5 axes, 10/10 max)
   │  Dynamic: repeat until score ≥ 9 OR max 5 rounds
   │  Escalation after 3 stuck rounds: switch Skopos strategy
   ▼
Output: TranslationResult + PipelineTrace
```

### Theoretical Foundation

| Theory                                          | Application                                                                   |
| ----------------------------------------------- | ----------------------------------------------------------------------------- |
| **Skopos Theory** (Vermeer 1984)                | Purpose determines strategy; default = Instrumental (serve Vietnamese reader) |
| **Self-Refine** (CMU/UW 2023, arXiv:2303.17651) | Iterative feedback loop                                                       |
| **Multi-Agent Debate** (ICML 2024)              | 3 personas reduce self-bias vs single-reviewer                                |
| **MQM Framework** (EU-funded)                   | Industry-standard 8-dimension quality scoring → simplified to MQM-Lite 5 axes |

---

## 2. File Structure

### Big Bang Changes (replace all current files)

```
packages/translation-prompt/src/
├── index.ts                         ← re-export only
├── translation-prompt.ts            ← public API (3 new functions)
├── sections/
│   ├── core.ts                      ← PERSONA + CORE_DOCTRINE
│   ├── language-layers.ts           ← JP + EN cultural rules
│   ├── humanizer.ts                 ← 3-tier formatting doctrine
│   ├── constraints.ts               ← output constraints
│   ├── analysis.ts                  ← buildSkoposPrompt() + build14DPrompt()
│   └── review.ts                    ← buildReviewPrompt() with 3 Personas + MQM-Lite
├── schemas/
│   ├── analysis.schema.ts           ← SkoposSchema + AnalysisSchema
│   ├── review.schema.ts             ← ReviewSchema + MQMLiteSchema
│   └── pipeline-trace.schema.ts    ← PipelineTraceSchema

packages/translator/src/
├── pipeline/
│   └── pipeline.ts                  ← TranslationPipeline class (replaces all)
├── translation-handler.ts           ← calls pipeline.run() (updated)
└── ...

packages/core/src/
└── types/
    └── llm-executor.ts              ← ILLMExecutor interface (new)

packages/provider-gemini/src/
└── gemini-plugin.ts                 ← implements ILLMExecutor.execute<T>()

packages/provider-openai/src/
└── openai-plugin.ts                 ← implements ILLMExecutor.execute<T>()

packages/provider-cursor/src/
├── cursor-translation.ts            ← implements ILLMExecutor.execute<T>() (remove hardcoded JSON_FORMAT_INSTRUCTION)
└── extract-json.ts                  ← unchanged
```

### Removed Files (big bang)

- No `legacy-pipeline.ts`
- No `enhanced-pipeline.ts`
- No `TRANSLATION_PIPELINE` env flag

---

## 3. Schemas & Data Flow

### Core Schemas (Zod)

```typescript
// analysis.schema.ts
SkoposSchema = z.object({
  purpose: z.enum(['informational', 'persuasive', 'emotional', 'technical', 'casual']),
  audience: z.string(),
  strategy: z.enum(['instrumental', 'documentary']),
  register: z.enum(['formal', 'semi-formal', 'casual', 'intimate']),
})

AnalysisSchema = z.object({
  skopos: SkoposSchema,
  extratextual: z.object({
    /* Group B: 5 dims */
  }),
  intratextual: z.object({
    /* Group A: 6 dims */
  }),
  crossCutting: z.object({
    /* Group C: 3 dims */
  }),
})

// review.schema.ts
MQLiteSchema = z.object({
  naturalFlow: z.number().min(0).max(3), // 3pts
  culturalFidelity: z.number().min(0).max(2), // 2pts
  readerExperience: z.number().min(0).max(2), // 2pts
  semanticAccuracy: z.number().min(0).max(2), // 2pts
  targetConventions: z.number().min(0).max(1), // 1pt
})

ReviewSchema = z.object({
  scores: MQLiteSchema,
  totalScore: z.number().min(0).max(10), // sum of axes
  passed: z.boolean(), // totalScore >= 9
  critique: z.string(),
  refinedTranslation: z.string(),
  personaFeedback: z.object({
    freshReader: z.string(),
    linguist: z.string(),
    editor: z.string(),
  }),
})

// pipeline-trace.schema.ts
PipelineTraceSchema = z.object({
  analysis: AnalysisSchema,
  rounds: z.array(ReviewSchema).max(5),
  finalScore: z.number(),
  totalRounds: z.number(),
  escalated: z.boolean(),
  durationMs: z.number(),
})
```

### Output JSON (new format)

```json
{
  "webhook_setting_id": "35555",
  "webhook_event": { "body": "...", "message_id": "...", "...": "..." },
  "translation": {
    "cleanText": "...",
    "translatedText": "...",
    "sourceLang": "Japanese",
    "targetLang": "Vietnamese",
    "timestamp": "2026-03-10T..."
  },
  "pipeline": {
    "analysis": { "skopos": {...}, "extratextual": {...}, "intratextual": {...}, "crossCutting": {...} },
    "rounds": [
      { "scores": { "naturalFlow": 2, "culturalFidelity": 2, "readerExperience": 1, "semanticAccuracy": 2, "targetConventions": 1 }, "totalScore": 8, "passed": false, "critique": "...", "refinedTranslation": "...", "personaFeedback": {...} },
      { "scores": {...}, "totalScore": 9, "passed": true, "refinedTranslation": "..." }
    ],
    "finalScore": 9,
    "totalRounds": 2,
    "escalated": false,
    "durationMs": 4230
  }
}
```

Open/Closed Principle: `translation` field unchanged, `pipeline` field added alongside.

### ILLMExecutor Interface

```typescript
// packages/core/src/types/llm-executor.ts
export type PromptPair = { system: string; user: string }

export interface ILLMExecutor {
  execute<T>(
    prompts: PromptPair,
    schema: ZodSchema<T>,
    options?: { signal?: AbortSignal },
  ): Promise<T>
}
```

### Provider Coverage

| Provider   | `execute<T>()` implementation                                                              |
| ---------- | ------------------------------------------------------------------------------------------ |
| **Gemini** | `Output.object({ schema })` — schema passed dynamically                                    |
| **OpenAI** | `Output.object({ schema })` — identical to Gemini                                          |
| **Cursor** | Plain `generateText()` + `extractJsonFromText()` + `schema.parse()` — safe for nested JSON |

**Cursor critical fix**: Remove hardcoded `JSON_FORMAT_INSTRUCTION` ("Exactly 2 fields: sourceLang and translated"). Each `buildXxxPrompt()` describes its own expected format inline. `extractJsonFromText()` already handles nested JSON via `indexOf('{')` to `lastIndexOf('}')`.

---

## 4. Testing Strategy + Edge Cases + Definition of Done

### Unit Tests

**`packages/translation-prompt/`**

| File                               | What to test                                                   |
| ---------------------------------- | -------------------------------------------------------------- |
| `sections/analysis.ts`             | `buildSkoposPrompt()` output contains all 14 dimensions        |
| `sections/review.ts`               | `buildReviewPrompt()` injects correct Persona A/B/C + MQM axes |
| `schemas/analysis.schema.ts`       | Zod parse valid shape + invalid shape rejection                |
| `schemas/review.schema.ts`         | `passed = totalScore >= 9`, score sum consistency              |
| `schemas/pipeline-trace.schema.ts` | `rounds.length <= 5`, `finalScore` consistent with last round  |

**`packages/translator/src/pipeline/`** (fixture pattern, no real LLM calls)

```typescript
// Fixture mock pattern
const mockExecutor: ILLMExecutor = {
  execute: vi
    .fn()
    .mockResolvedValueOnce(fakeAnalysis) // Phase 1
    .mockResolvedValueOnce(fakeTranslation) // Phase 2
    .mockResolvedValueOnce(fakeReview), // Phase 3 round 1
}
```

Test cases:

- Pass round 1 (score ≥ 9) → `rounds.length === 1`
- Stuck 3 rounds → escalation triggered (Skopos switch + Phase 2 rebuild)
- Max 5 rounds → return best result, no throw
- `AbortSignal` cancelled mid-pipeline → throw `TranslationError('ABORTED')`

**Provider adapters** — integration test `ILLMExecutor.execute<T>()` with minimal schema:

```typescript
it('gemini executes with dynamic schema', async () => {
  const result = await executor.execute(
    { system: 'return JSON', user: '{"x":1}' },
    z.object({ x: z.number() }),
  )
  expect(result.x).toBe(1)
})
```

### Edge Cases

| Edge Case                               | Handling                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| Text < 5 chars (`ok`, `👍`, emoji)      | Fast-path: skip 14D analysis, direct translate, `rounds=[]`                       |
| Text already Vietnamese                 | Phase 0 detect → return `translatedText = cleanText`, `sourceLang = "Vietnamese"` |
| LLM returns malformed AnalysisSchema    | Retry once → if fail: throw `TranslationError('INVALID_RESPONSE')`                |
| Phase 3 score stuck at 8 after 3 rounds | Escalation: switch Skopos Instrumental ↔ Documentary + rebuild Phase 2            |
| Rounds 4-5 still stuck                  | Return `bestRound` (highest score), `escalated: true` in trace                    |
| Cursor JSON parse fail                  | `extractJsonFromText()` → `TranslationError('API_ERROR')`                         |
| AbortSignal during review loop          | Check signal before each `executor.execute()` call                                |

### Definition of Done

```bash
bun test && bun run typecheck && bun run lint
```

- [ ] All unit tests pass, pipeline logic coverage ≥ 80%
- [ ] Zero TypeScript errors (strict mode)
- [ ] Zero ESLint warnings (including `no-restricted-imports`)
- [ ] Output JSON has `pipeline` field with `rounds`, `finalScore`, `totalRounds`, `escalated`
- [ ] All 3 providers pass integration test with `ILLMExecutor`
- [ ] Cursor: hardcoded `JSON_FORMAT_INSTRUCTION` removed, `execute()` accepts dynamic schema
- [ ] Short-text fast-path works (< 5 chars skips full pipeline)
- [ ] Escalation after round 3 logged in `PipelineTrace.escalated`
