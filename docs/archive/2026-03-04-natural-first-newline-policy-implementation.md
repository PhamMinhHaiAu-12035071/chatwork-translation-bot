# Natural-First Newline Policy — Implementation Plan

**Goal:** Remove `[[NL]]` placeholder handling and switch to a natural-first translation policy where newline fidelity is best effort (especially `\n\n`), while preserving the current output schema.

---

## Task 1: Update prompt contract

**File:** `packages/core/src/services/translation-prompt.ts`

Changes:

1. Remove `encodeNewlines` and `decodeNewlines` exports.
2. Update `buildTranslationPrompt` to:
   - Prioritize natural, human-readable Vietnamese prose.
   - Preserve paragraph breaks (blank lines) when natural.
   - Allow smoothing single line breaks for readability.
   - Remove all `[[NL]]` references.

Acceptance:

- File has no `[[NL]]` string.
- Prompt text reflects natural-first policy.

---

## Task 2: Remove newline post-processing in AI services

**Files:**

- `packages/core/src/services/openai-translation.ts`
- `packages/core/src/services/gemini-translation.ts`

Changes:

1. Remove imports for encode/decode helpers.
2. Pass raw `text` into `buildTranslationPrompt(text)`.
3. Return `translatedText: output.translated` directly.

Acceptance:

- No newline transform in either service.
- `cleanText` mapping remains unchanged.

---

## Task 3: Rewrite prompt tests for new policy

**File:** `packages/core/src/services/translation-prompt.test.ts`

Changes:

1. Remove encode/decode helper tests.
2. Add assertions that prompt:
   - Includes natural, human-readable intent.
   - Mentions preserving paragraph breaks as best-effort.
   - Allows smoothing single line breaks.
   - Does not mention `[[NL]]`.

Acceptance:

- Prompt test suite validates new contract only.

---

## Task 4: Add pass-through matrix tests for OpenAI/Gemini

**Files:**

- `packages/core/src/services/openai-translation.test.ts`
- `packages/core/src/services/gemini-translation.test.ts`

Changes:

1. Remove mocks that depend on `[[NL]]` decoding.
2. Add table-driven tests for translated output pass-through:
   - no newline
   - single `\n`
   - double `\n\n`
   - mixed `\n` + `\n\n`
   - leading/trailing newline
   - input/output containing literal `[[NL]]` as plain text
3. Keep existing model default/custom tests.

Acceptance:

- Tests verify `translatedText === model output` in all matrix cases.
- Tests confirm prompt receives raw input text.

---

## Task 5: Add handler regression tests

**File:** `packages/translator/src/webhook/handler.test.ts` (new)

Cases:

1. Message event: service output is written unchanged (no newline normalization).
2. Non-message event: translation flow is skipped.
3. Empty `stripChatworkMarkup` result: translation flow is skipped.

Acceptance:

- Handler behavior matches natural-first policy and skip conditions.

---

## Task 6: Update plan docs layout

Changes:

1. Keep archived placeholder docs under `docs/archive`.
2. Maintain active docs in `docs/plans` with natural-first policy docs.

Acceptance:

- `docs/plans` no longer contains active `[[NL]]` strategy docs.
- New docs reference superseded archived files.

---

## Verification commands

```bash
bun test packages/core/src/services
bun test packages/translator/src/webhook/handler.test.ts
bun test packages/translator/src/utils/output-writer.test.ts
bun run typecheck
bun run lint
```

If Bun is unavailable in local environment, run the same commands in CI or a machine with Bun installed.
