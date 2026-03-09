# Translation Prompt Optimization Implementation Plan (Execution-Ready)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor `@chatwork-bot/translation-prompt` to a structured system + user prompt architecture that improves Japanese -> Vietnamese quality while preserving backward compatibility.

**Architecture:** Keep a single-file implementation in `translation-prompt.ts` using a `PromptSection` registry and three pure exported functions: `buildSystemPrompt`, `buildUserPrompt`, and backward-compatible `buildTranslationPrompt`. Keep schema and type exports unchanged.

**Tech Stack:** Bun, TypeScript strict mode, Zod, bun:test

---

## Execution Cadence (executing-plans checkpoints)

- **Batch 1 (Tasks 0-2):** preflight isolation, failing tests, prompt implementation
- **Checkpoint A:** report file diffs + `bun test packages/translation-prompt` output, then wait for feedback
- **Batch 2 (Tasks 3-5):** barrel export, full verification gates, commit handoff
- **Checkpoint B:** report `bun test`, `bun run typecheck`, `bun run lint`, then wait for feedback

---

## Critical Review Notes Applied

- The legacy test expects prompt text to include `detect`; `buildUserPrompt` must include explicit source-language detection wording.
- Test updates must modify the existing import line once; do not copy/paste duplicate import blocks from examples.
- Current workspace is on `main` with unrelated changes, so worktree isolation is mandatory before coding.

---

## Preflight (required before coding)

### Task 0: Isolate workspace and baseline check

**Why:** Current repository state is on `main` with unrelated local changes. Implementation must not happen directly on `main`.

**Files:** none

**Step 1: Create and switch to an isolated worktree branch**

Run:

```bash
git worktree add ../chatwork-translation-bot-prompt-opt -b feat/translation-prompt-optimization
```

Expected: New worktree created and branch `feat/translation-prompt-optimization` checked out.

**Step 2: Move into worktree**

Run:

```bash
cd ../chatwork-translation-bot-prompt-opt
```

Expected: All following commands run inside isolated worktree, not original `main` workspace.

**Step 3: Confirm clean branch**

Run:

```bash
git status --short --branch
```

Expected: Feature branch with clean state before making changes.

**Step 4: Run baseline package tests**

Run:

```bash
bun test packages/translation-prompt
```

Expected: Existing tests pass before refactor.

Checkpoint: Share baseline result before moving to Task 1.

---

## Implementation Tasks

### Task 1: Add failing tests for new prompt APIs (TDD)

**Files:**

- Modify: `packages/translation-prompt/src/translation-prompt.test.ts`

**Step 1: Update imports once (do not duplicate import block)**

Use a single import list:

```ts
import {
  TranslationSchema,
  buildTranslationPrompt,
  buildSystemPrompt,
  buildUserPrompt,
} from './translation-prompt'
```

Expected: No duplicate `describe/expect/it` or duplicate named imports.

**Step 2: Add `describe('buildSystemPrompt', ...)` suite**

Add tests for:

- non-empty output
- contains `translator`, `vietnamese`, `keigo`
- custom section array support
- deterministic output (pure function)

**Step 3: Add `describe('buildUserPrompt', ...)` suite**

Add tests for:

- includes source text
- JSON-only instruction
- required keys: `sourceLang`, `translated`
- includes anti-markdown instruction
- includes Japanese few-shot sample
- includes IT term examples (`deploy`, `staging`)
- deterministic output

**Step 4: Add backward-compat composition test to `buildTranslationPrompt` suite**

Add:

- composed output contains both `buildSystemPrompt()` and `buildUserPrompt(text)`
- keep legacy expectations (`text`, `vietnamese`, `detect`)

**Step 5: Run tests and confirm expected failure**

Run:

```bash
bun test packages/translation-prompt
```

Expected: Fails because `buildSystemPrompt` and `buildUserPrompt` do not exist yet.

Checkpoint: Share failing test output before Task 2.

---

### Task 2: Implement prompt section registry and pure builders

**Files:**

- Modify: `packages/translation-prompt/src/translation-prompt.ts`

**Step 1: Keep schema/type unchanged**

Do not modify:

- `TranslationSchema`
- `TranslationOutput`

**Step 2: Introduce section model and constants**

Add internal:

- `interface PromptSection { id: string; content: string }`
- six section constants:
  - `SECTION_PERSONA`
  - `SECTION_CORE_DOCTRINE`
  - `SECTION_JAPANESE_RULES`
  - `SECTION_HUMANIZER`
  - `SECTION_STRUCTURAL`
  - `SECTION_CONSTRAINTS`
- `PROMPT_SECTIONS` registry in desired composition order

**Step 3: Add `buildSystemPrompt`**

Function signature:

```ts
export function buildSystemPrompt(sections: readonly PromptSection[] = PROMPT_SECTIONS): string
```

Behavior:

- joins section contents with `\n\n`
- pure function only

**Step 4: Add `buildUserPrompt(text)`**

Behavior:

- instruct JSON-only output
- include required JSON format
- include few-shot examples (Japanese keigo + English IT terms)
- include source text block
- explicitly mention source-language detection in user prompt text so legacy `detect` expectation remains robust

**Step 5: Refactor `buildTranslationPrompt(text)`**

Behavior:

- return `${buildSystemPrompt()}\n\n${buildUserPrompt(text)}`
- keep as backward-compatible API

**Step 6: Run package tests**

Run:

```bash
bun test packages/translation-prompt
```

Expected: All tests pass in package, including new suites.

Checkpoint: Share passing package tests before Task 3.

---

### Task 3: Export new APIs from barrel

**Files:**

- Modify: `packages/translation-prompt/src/index.ts`

**Step 1: Export new functions**

Set exports to:

```ts
export {
  TranslationSchema,
  buildTranslationPrompt,
  buildSystemPrompt,
  buildUserPrompt,
} from './translation-prompt'
export type { TranslationOutput } from './translation-prompt'
```

**Step 2: Re-run package tests**

Run:

```bash
bun test packages/translation-prompt
```

Expected: Pass, no regressions from barrel update.

Checkpoint: Share output before full verification.

---

### Task 4: Full verification gates

**Files:** none

**Step 1: Full tests**

Run:

```bash
bun test
```

Expected: All tests pass, or clearly report pre-existing unrelated failures.

**Step 2: Type check**

Run:

```bash
bun run typecheck
```

Expected: No new type errors.

**Step 3: Lint**

Run:

```bash
bun run lint
```

Expected: No new lint errors.

Checkpoint: Share all three outputs before commit preparation.

---

### Task 5: Commit and handoff

**Files:**

- `packages/translation-prompt/src/translation-prompt.ts`
- `packages/translation-prompt/src/translation-prompt.test.ts`
- `packages/translation-prompt/src/index.ts`
- optionally plan docs if intentionally included

**Step 1: Stage only intended files**

Run:

```bash
git add packages/translation-prompt/src/translation-prompt.ts
git add packages/translation-prompt/src/translation-prompt.test.ts
git add packages/translation-prompt/src/index.ts
```

Optional (only if desired):

```bash
git add docs/plans/2026-03-09-translation-prompt-optimization-design.md
git add docs/plans/2026-03-09-translation-prompt-optimization.md
git add docs/plans/2026-03-09-translation-prompt-optimization-implementation-plan.md
```

**Step 2: Commit**

Suggested message:

```bash
git commit -m "feat(translation-prompt): optimize prompt architecture with system/user builders"
```

**Step 3: Prepare for review**

Collect:

- `git diff --stat`
- key test/typecheck/lint outputs
- known risks and follow-up ideas

---

## Definition of Done

- `buildSystemPrompt` and `buildUserPrompt` implemented and exported
- `buildTranslationPrompt` remains backward compatible
- Existing schema/type API unchanged
- New test suites added and passing
- `bun test && bun run typecheck && bun run lint` completed without new issues
- Changes isolated to `translation-prompt` package (except optional plan docs)

---

## Risks and Mitigations

- Risk: Prompt string changes may break implicit provider assumptions.
  - Mitigation: keep output contract unchanged (`buildTranslationPrompt(text): string`).

- Risk: Legacy `detect` test becomes brittle if wording changes.
  - Mitigation: make detection instruction explicit in `buildUserPrompt`.

- Risk: Overly large prompt increases token usage.
  - Mitigation: keep section text concise; evaluate quality vs token cost after first run.

- Risk: Work accidentally mixed with unrelated local changes on `main`.
  - Mitigation: required worktree preflight in Task 0.
