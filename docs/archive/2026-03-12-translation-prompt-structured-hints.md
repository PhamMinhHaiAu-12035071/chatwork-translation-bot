# Translation Prompt Structured Hints Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add structured context and preservation hints to the translation prompt pipeline so Japanese -> Vietnamese output improves on keigo, email formulas, names, and preserve-sensitive fragments without sacrificing natural Vietnamese.

**Architecture:** Extend `AnalysisResult` with a compact `structuredHints` object, require the analysis prompt to emit it, and inject the same hints into both translation and review prompts. Update the pipeline's short-text fast path so short Japanese text and preserve-sensitive content still go through analysis.

**Tech Stack:** Bun, TypeScript strict ESM, Zod, Bun test, prompt-builder package `@chatwork-bot/translation-prompt`, orchestration package `@chatwork-bot/translator`

---

### Task 1: Add `structuredHints` to the analysis schema

**Files:**

- Create: `packages/translation-prompt/src/schemas/analysis.schema.test.ts`
- Modify: `packages/translation-prompt/src/schemas/analysis.schema.ts`

**Step 1: Write the failing schema tests**

Modify the existing `packages/translation-prompt/src/schemas/analysis.schema.test.ts` (do not create — the file already exists). Update the existing `validAnalysis` fixture to include `structuredHints` and add new coverage for:

- a valid `structuredHints` payload parses successfully
- invalid enum values fail
- required preservation booleans are enforced

Example skeleton:

```ts
import { describe, expect, it } from 'bun:test'
import { AnalysisSchema } from './analysis.schema'

const validAnalysis = {
  skopos: {
    purpose: 'informational',
    audience: 'business reader',
    strategy: 'instrumental',
    register: 'formal',
  },
  extratextual: {
    sender: 'unknown',
    intention: 'request',
    audience: 'colleague',
    medium: 'email',
    temporalContext: 'current',
  },
  intratextual: {
    subjectMatter: 'request',
    contentSummary: 'please confirm',
    presuppositions: 'shared work context',
    textStructure: 'single sentence',
    lexisNotes: 'keigo',
    nonVerbalElements: 'none',
  },
  crossCutting: {
    textFunction: 'directive',
    registerTone: 'polite',
    expectedEffect: 'recipient confirms',
  },
  structuredHints: {
    sourceProfile: {
      language: 'japanese',
      medium: 'email',
      domain: 'business',
      hasCode: false,
      hasUrl: false,
      hasJapaneseName: false,
      hasSpecialFormatting: false,
    },
    intentLabels: {
      phraseType: 'keigo_request',
      confidence: 'high',
    },
    renderingPolicy: {
      strategy: 'functional_vietnamese',
      targetStyle: 'natural_office_vi',
      preserveAmbiguity: false,
      allowNaturalAdaptation: true,
      avoidLiteralFormulaTranslation: true,
    },
    preservationRules: {
      preserveUrl: false,
      preserveCode: false,
      preserveUnits: false,
      preserveChatworkMarkup: false,
      preserveJapaneseNameScript: false,
      allowRomajiGloss: false,
      forbidGenderInference: true,
    },
    reviewFocus: ['formula function'],
  },
}

describe('AnalysisSchema', () => {
  it('parses structuredHints', () => {
    expect(AnalysisSchema.parse(validAnalysis).structuredHints.intentLabels.phraseType).toBe(
      'keigo_request',
    )
  })
})
```

**Step 2: Run the new test and confirm it fails**

Run:

```bash
bun test packages/translation-prompt/src/schemas/analysis.schema.test.ts
```

Expected: fail because `AnalysisSchema` does not yet include `structuredHints`.

**Step 3: Implement the schema changes**

Update `packages/translation-prompt/src/schemas/analysis.schema.ts`:

- add sub-schemas for `sourceProfile`, `intentLabels`, `renderingPolicy`, and `preservationRules`
- add `structuredHints` to `AnalysisSchema` as a **required** field (not optional)
- for `renderingPolicy.strategy`, use `z.enum(['functional_vietnamese'])` — not `z.string()` — to keep the type strict now and easy to extend for English phase 2
- keep exports type-safe with `export type`
- all existing `fakeAnalysis` fixtures in the following files must be updated to include `structuredHints` — each file defines its own local fixture, no shared fixture file:
  - `packages/translation-prompt/src/schemas/analysis.schema.test.ts`
  - `packages/translation-prompt/src/translation-prompt.test.ts`
  - `packages/translation-prompt/src/sections/review.test.ts`
  - `packages/translator/src/pipeline/pipeline.test.ts`
- also update `buildFastPathAnalysis()` in `packages/translator/src/pipeline/pipeline.ts` to include a `structuredHints` stub payload (all preserve flags false, `phraseType: 'general_statement'`, `confidence: 'high'`), so the required schema does not cause a Zod parse error at runtime for short-text fast-path calls

**Step 4: Run the targeted schema test**

Run:

```bash
bun test packages/translation-prompt/src/schemas/analysis.schema.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/translation-prompt/src/schemas/analysis.schema.ts packages/translation-prompt/src/schemas/analysis.schema.test.ts
git commit -m "feat(translation-prompt): add structured analysis hints schema"
```

### Task 2: Require `structuredHints` in the analysis prompt

**Files:**

- Modify: `packages/translation-prompt/src/sections/analysis.ts`
- Modify: `packages/translation-prompt/src/sections/analysis.test.ts`
- Modify: `packages/translation-prompt/src/translation-prompt.test.ts`

**Step 1: Write failing prompt-contract tests**

Add tests that assert:

- the analysis system prompt mentions `structuredHints`
- the analysis prompt documents formula classification
- the analysis prompt documents preservation-sensitive detection
- the analysis prompt instructs preserveAmbiguity handling

Examples:

```ts
it('system prompt requires structuredHints output', () => {
  const prompts = buildAnalysisPrompts('テスト')
  expect(prompts.system).toContain('structuredHints')
})

it('system prompt mentions preserve-sensitive fragments', () => {
  const prompts = buildAnalysisPrompts('https://api.example.com')
  expect(prompts.system).toMatch(/preserve|URL|code|unit/i)
})

it('system prompt instructs preserveAmbiguity rendering as slash-separated options', () => {
  const prompts = buildAnalysisPrompts('すみません')
  expect(prompts.system).toMatch(/preserveAmbiguity|slash-separated|ambiguous utterance/i)
})
```

**Step 2: Run the targeted tests and confirm they fail**

Run:

```bash
bun test packages/translation-prompt/src/sections/analysis.test.ts
bun test packages/translation-prompt/src/translation-prompt.test.ts
```

Expected: fail because the current prompt does not reference the new fields.

**Step 3: Update `analysis.ts`**

Change the analysis system prompt so it:

- includes the `structuredHints` JSON shape explicitly
- defines the allowed `phraseType` labels
- instructs the model to infer only from source-text evidence
- tells the model to mark preservation rules for URL, code, units, names, and markup
- when `preserveAmbiguity=true`, the downstream translation must render all meanings separated by `/` (e.g., `Xin lỗi / Xin phép`) rather than picking one

**Step 4: Re-run the targeted tests**

Run:

```bash
bun test packages/translation-prompt/src/sections/analysis.test.ts
bun test packages/translation-prompt/src/translation-prompt.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/translation-prompt/src/sections/analysis.ts packages/translation-prompt/src/sections/analysis.test.ts packages/translation-prompt/src/translation-prompt.test.ts
git commit -m "feat(translation-prompt): emit structured hints from analysis prompt"
```

### Task 3: Inject structured hints into translation and review prompts

**Files:**

- Modify: `packages/translation-prompt/src/translation-prompt.ts`
- Modify: `packages/translation-prompt/src/sections/review.ts`
- Modify: `packages/translation-prompt/src/translation-prompt.test.ts`
- Modify: `packages/translation-prompt/src/sections/review.test.ts`

**Step 1: Write failing prompt-builder tests**

Add tests that assert:

- translation prompts include a `Structured Hints` block
- translation prompts include preservation rules
- review prompts include structured hints and preservation-aware scoring instructions

Examples:

```ts
it('translation prompt includes structured hints block', () => {
  const result = buildTranslationPrompts('テスト', fakeAnalysis)
  expect(result.user).toContain('Structured Hints')
})

it('review prompt includes preservation rules', () => {
  const result = buildReviewPrompts('original', fakeAnalysis, 'draft', 1)
  expect(result.user).toContain('preserveJapaneseNameScript')
})
```

**Step 2: Run the targeted tests and confirm they fail**

Run:

```bash
bun test packages/translation-prompt/src/translation-prompt.test.ts
bun test packages/translation-prompt/src/sections/review.test.ts
```

Expected: fail because the downstream prompts do not yet render hints.

**Step 3: Implement prompt injection**

Update `packages/translation-prompt/src/translation-prompt.ts` and `packages/translation-prompt/src/sections/review.ts` so they:

- render `analysis.structuredHints` into the user prompt
- expose preservation rules explicitly
- remind the model that `functional_vietnamese` outranks literal formula carryover
- keep the prompt compact and deterministic

While changing tests, expand `fakeAnalysis` fixtures to include `structuredHints`.

**Step 4: Re-run the targeted tests**

Run:

```bash
bun test packages/translation-prompt/src/translation-prompt.test.ts
bun test packages/translation-prompt/src/sections/review.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/translation-prompt/src/translation-prompt.ts packages/translation-prompt/src/sections/review.ts packages/translation-prompt/src/translation-prompt.test.ts packages/translation-prompt/src/sections/review.test.ts
git commit -m "feat(translation-prompt): pass structured hints to translation and review"
```

### Task 4: Refine Japanese language rules for formula handling and names

**Files:**

- Modify: `packages/translation-prompt/src/sections/language-layers.ts`
- Modify: `packages/translation-prompt/src/translation-prompt.test.ts`

**Step 1: Write failing tests for the policy text**

Add tests that assert the translation system prompt now includes explicit rules for:

- functional Vietnamese rendering of Japanese email formulas
- preserving Japanese names in original script
- allowing romaji gloss in parentheses without replacing the original
- forbidding gender inference

Example:

```ts
it('system prompt instructs formulaic Japanese to be rendered functionally', () => {
  const result = buildTranslationPrompts('お世話になっております', fakeAnalysis)
  expect(result.system).toMatch(/functional Vietnamese|email formula|do not translate literally/i)
})
```

**Step 2: Run the targeted test and confirm it fails**

Run:

```bash
bun test packages/translation-prompt/src/translation-prompt.test.ts
```

Expected: fail because current Japanese rules still over-simplify formula mapping.

**Step 3: Update `language-layers.ts`**

Remove **all** rigid word-to-word mappings and replace with policy-level instructions:

- formulaic Japanese in business email must be rendered by communicative function, not literal surface
- remove the explicit `よろしくお願いいたします` → `"Trân trọng cảm ơn" or "Mong nhận được sự hợp tác"` mapping entirely
- policy text must forbid auto-inserting `Trân trọng`, `cảm ơn`, or `xem xét` unless the source genuinely carries that meaning
- Japanese personal names must stay in original Japanese script; romaji gloss in parentheses is allowed **only** when `allowRomajiGloss=true` is set by analysis, never by default
- `forbidGenderInference=true` must be explicit: do not add `anh/chị` or gender-specific honorifics from a name alone

**Step 4: Re-run the targeted test**

Run:

```bash
bun test packages/translation-prompt/src/translation-prompt.test.ts
```

Expected: PASS.

**Step 5: Commit**

Note: `translation-prompt.test.ts` was already committed in Task 3. The commit here captures only the additive Task 4 tests on top of Task 3. The commit message reflects the language rule changes, not test-framework changes.

```bash
git add packages/translation-prompt/src/sections/language-layers.ts packages/translation-prompt/src/translation-prompt.test.ts
git commit -m "feat(translation-prompt): improve japanese formula and name rules"
```

### Task 5: Narrow the short-text fast path in the pipeline

**Files:**

- Modify: `packages/translator/src/pipeline/pipeline.ts`
- Modify: `packages/translator/src/pipeline/pipeline.test.ts`

**Step 1: Write failing pipeline tests**

Add tests for:

- short Japanese text still goes through analysis
- short preserve-sensitive text with URL/code markup does not use fast path
- low-risk short Latin text can still use fast path

Example sketch:

```ts
it('does not fast-path short japanese text', async () => {
  // Use the existing makeMockExecutor from pipeline.test.ts — follow its call pattern.
  // For Japanese text, the pipeline must call execute() with the analysis schema first,
  // meaning execute() is called >= 3 times (analysis + translation + review).
  // For low-risk Latin text, execute() is called 1 time (fast path).
  const japaneseExecutor = makeMockExecutor(/* analysis + translation + review responses */)
  await new TranslationPipeline(japaneseExecutor).run('すみません')
  expect(japaneseExecutor.callCount).toBeGreaterThanOrEqual(3)
})

it('fast-paths low-risk latin text', async () => {
  const latinExecutor = makeMockExecutor(/* single direct translation response */)
  await new TranslationPipeline(latinExecutor).run('ok')
  expect(latinExecutor.callCount).toBe(1)
})
```

Note: Check `pipeline.test.ts` for the exact `makeMockExecutor` signature and response shape before writing the concrete test. The above is a structural sketch, not copy-paste code.

**Step 2: Run the targeted test and confirm it fails**

Run:

```bash
bun test packages/translator/src/pipeline/pipeline.test.ts
```

Expected: fail because the current fast path uses grapheme count only.

**Step 3: Implement a content-aware fast-path guard**

Update `packages/translator/src/pipeline/pipeline.ts` to replace the current inline check with a helper such as `shouldUseFastPath(text)`:

- return `false` for any text containing Hiragana (`\u3040-\u309F`), Katakana (`\u30A0-\u30FF`), or Kanji (`\u4E00-\u9FFF`)
- return `false` for text containing URL-like markers (`https?://`)
- return `false` for text containing code-like syntax: backticks, `//`, `{`, `}`, or numeric+`/`+word patterns (e.g. `requests/giây`, `100 req/s`)
- return `false` for text containing Chatwork markup (e.g. `[To:`, `[info]`, `[code]`)
- return `true` only for short Latin-script text that contains none of the above

Keep the implementation small and explicit. Each condition should be a named regex constant for readability.

**Step 4: Re-run the targeted test**

Run:

```bash
bun test packages/translator/src/pipeline/pipeline.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/translator/src/pipeline/pipeline.ts packages/translator/src/pipeline/pipeline.test.ts
git commit -m "fix(translator): reduce risky short-text fast path cases"
```

### Task 6: Final verification and regression pass

**Files:**

- No file changes required unless a failing test reveals a missed contract

**Step 1: Run focused package tests**

Run:

```bash
bun test packages/translation-prompt/src/schemas/analysis.schema.test.ts
bun test packages/translation-prompt/src/sections/analysis.test.ts
bun test packages/translation-prompt/src/sections/review.test.ts
bun test packages/translation-prompt/src/translation-prompt.test.ts
bun test packages/translator/src/pipeline/pipeline.test.ts
```

Expected: all PASS.

**Step 2: Run package-level and repo-level verification**

Run:

```bash
bun test
bun run typecheck
bun run lint
```

Expected: all PASS with zero errors.

**Step 3: Manual QA checklist (not a CI gate — requires live LLM call)**

Run the dataset runner (`@chatwork-bot/dataset-runner`) or manual curl against representative strings to verify live model behavior. This is not part of `bun test`:

- `お世話になっております`
- `以上、よろしくお願いいたします`
- `ご確認のほどよろしくお願いいたします`
- `山田太郎さんに連絡してください`
- `100 requests/giây`
- `const x = 10; // 変数の宣言`
- `すみません` (should output `Xin lỗi / Xin phép` when ambiguous context)

Acceptance:

- formulaic expressions are handled functionally, no auto-inserted `Trân trọng`
- names preserve original Japanese script; romaji gloss only when `allowRomajiGloss=true`
- preserve-sensitive fragments stay intact (units, URLs, code)
- ambiguous utterances list multiple meanings with `/` separator
- wording remains natural in Vietnamese

**Step 4: Create consolidated PR**

```bash
git push origin feature/structured-hints
gh pr create --title "feat(translator): add structured hints for production-first translation" \
  --body "## Summary
- Add structuredHints to AnalysisResult schema (required)
- Require analysis prompt to emit structuredHints
- Inject hints into translation and review prompts
- Remove rigid keigo mappings, replace with functional policy
- Narrow short-text fast path to protect Japanese and preserve-sensitive content

## Test plan
- [ ] All unit tests pass: bun test
- [ ] Typecheck passes: bun run typecheck
- [ ] Lint passes: bun run lint
- [ ] Manual checklist in Task 6 Step 3 verified"
```
