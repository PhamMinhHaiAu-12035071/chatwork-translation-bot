# Translation Context & Keyword Protection Logging — TDD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three structured `observer.logEvent()` calls in the translate webhook handler so context and keyword protection produce a safe audit trail (counts, lengths, booleans only), with tests proving event names, field values, ordering, and “always emit” behavior for mask/restore.

**Architecture:** Extend the existing success path in `createHandleTranslateRequest` after `translation_pipeline_started`: log context (optional) **before** masking so chronological order matches the approved design; log mask metadata after `maskKeywords` on primary + segments; log restore metadata immediately after `restoreKeywords` and before `writeTranslationOutput`. Reuse `readJsonLogs()` / JSON `event` field patterns from `handler.test.ts`. If `Partial<TranslatorLogEntry>` rejects new keys at compile time, cast the extra object `as Partial<TranslatorLogEntry>` in `handler.ts` only (approved design §13.2 “handler-only” escape hatch) — **do not** change `observability.ts` unless the team relaxes the file-scope constraint.

**Tech Stack:** Bun · TypeScript strict · `bun:test` · existing module mocks in `handler.test.ts`

**Approved spec:** `docs/superpowers/specs/2026-04-01-translation-context-keyword-logging-design.md`

---

## File map

| File                                              | Role                                                                                                                    |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `packages/translator/src/webhook/handler.ts`      | Add three `observer.logEvent('info', …)` calls; optional `import type { TranslatorLogEntry }` for assertion-only typing |
| `packages/translator/src/webhook/handler.test.ts` | New/extended `it(...)` cases asserting JSON logs via `consoleLogLines` + `readJsonLogs()`                               |

**Out of scope (per task constraints):** `keyword-redactor.ts`, `pipeline.ts`, `observability.ts` (unless typecheck forces a follow-up PR).

---

## Event contract (from spec)

| Event                           | When                                                                                          | Always? | Safe fields                                                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `translation_context_applied`   | After pipeline start, **before** `maskKeywords`, when trimmed `roomConfig.context` length > 0 | No      | `roomContextApplied: true`, `roomContextLength` (grapheme count, same idea as `inputLength`)                                        |
| `translation_keywords_masked`   | Right after masking primary + segments, before `new TranslationPipeline()`                    | **Yes** | `configuredKeywordCount`, `primaryTextChangedByMask`, `translationInputSegmentCount`, `segmentsChangedByMaskCount`, `hasSystemHint` |
| `translation_keywords_restored` | Right after restore on primary + segments, **before** `writeTranslationOutput`                | **Yes** | `configuredKeywordCount`, `primaryTranslationChangedByRestore`, `segmentsChangedByRestoreCount`                                     |

**Security:** Never log keyword strings, context text, user/translated text, `systemHint` body, or `restoreMap`.

**Ordering vs existing events:** After `translation_pipeline_started`, new order is: `translation_context_applied` (optional) → `translation_keywords_masked` → … phases … → `translation_keywords_restored` → delivery/output logs.

---

## Task 1: Failing tests — context logging

**Files:**

- Modify: `packages/translator/src/webhook/handler.test.ts` (inside `describe('handleTranslateRequest', …)`)

- [ ] **Step 1: Add test — context present → event + metadata**

Add an `it` that updates the real `store` with `context` via `store.update(enabledRoomId, { context: 'Room type: Client briefing' })`, runs `handleTranslateRequest(makeCommand())`, then asserts a JSON log with `event === 'translation_context_applied'`, `roomContextApplied === true`, and `roomContextLength` equal to `Array.from('Room type: Client briefing'.trim()).length` (or `toBeGreaterThan(0)` plus exact length if you prefer strict equality).

```typescript
it('logs translation_context_applied when room has non-empty context', async () => {
  const traceId = 'trace-context-1'
  await store.update(enabledRoomId, {
    context: 'Room type: Client briefing',
  })

  await handleTranslateRequest(makeCommand(), { traceId })

  const entry = readJsonLogs().find((e) => e['event'] === 'translation_context_applied')
  expect(entry).toBeDefined()
  expect(entry).toMatchObject({
    level: 'info',
    service: 'translator',
    traceId,
    sourceMessageId: '2081046619322847232',
    roomId: 424846369,
    roomContextApplied: true,
    roomContextLength: Array.from('Room type: Client briefing').length,
  })
})
```

- [ ] **Step 2: Add test — no context → event absent**

```typescript
it('does not log translation_context_applied when context is null', async () => {
  await store.update(enabledRoomId, { context: null })

  await handleTranslateRequest(makeCommand())

  const entry = readJsonLogs().find((e) => e['event'] === 'translation_context_applied')
  expect(entry).toBeUndefined()
})
```

- [ ] **Step 3: Add test — whitespace-only context → event absent (spec: trimmed length > 0)**

```typescript
it('does not log translation_context_applied when context is whitespace only', async () => {
  await store.update(enabledRoomId, { context: '   \n\t  ' })

  await handleTranslateRequest(makeCommand())

  const entry = readJsonLogs().find((e) => e['event'] === 'translation_context_applied')
  expect(entry).toBeUndefined()
})
```

- [ ] **Step 4: Run tests — confirm RED**

Run:

```bash
cd /Users/phamau/Desktop/projects/research/chatwork-translation-bot && bun test packages/translator/src/webhook/handler.test.ts
```

Expected: new tests **fail** (events missing or wrong fields).

- [ ] **Step 5: Commit (tests only)**

```bash
git add packages/translator/src/webhook/handler.test.ts
git commit -m "test(translator): add failing tests for translation_context_applied logging"
```

---

## Task 2: Failing tests — keyword mask / restore logging

**Files:**

- Modify: `packages/translator/src/webhook/handler.test.ts`

- [ ] **Step 1: Add test — keywords match → mask + restore booleans and counts**

Reuse the existing keyword integration style (`store.update` + message containing the keyword). Use a **single-segment** command so `translationInputSegmentCount === 1` and segment counts are easy to assert.

```typescript
it('logs translation_keywords_masked and translation_keywords_restored when keywords match text', async () => {
  const traceId = 'trace-kw-1'
  await store.update(enabledRoomId, {
    protectedKeywords: [{ keyword: 'AcmeCorp', category: 'company' }],
  })

  await handleTranslateRequest(
    makeCommand({
      translatableText: 'Hello from AcmeCorp',
      translationInputs: ['Hello from AcmeCorp'],
    }),
    { traceId },
  )

  const logs = readJsonLogs()
  const masked = logs.find((e) => e['event'] === 'translation_keywords_masked')
  const restored = logs.find((e) => e['event'] === 'translation_keywords_restored')

  expect(masked).toMatchObject({
    level: 'info',
    traceId,
    configuredKeywordCount: 1,
    primaryTextChangedByMask: true,
    translationInputSegmentCount: 1,
    segmentsChangedByMaskCount: 1,
    hasSystemHint: true,
  })
  expect(restored).toMatchObject({
    level: 'info',
    traceId,
    configuredKeywordCount: 1,
    primaryTranslationChangedByRestore: true,
    segmentsChangedByRestoreCount: 1,
  })
})
```

Note: If `hasSystemHint` is `false` when the redactor still masks (unlikely for a match), adjust expectation to match actual `systemHint.length > 0` behavior — the assertion must reflect real `maskKeywords` output.

- [ ] **Step 2: Add test — keywords configured but no match → mask still emitted, flags false / zero segments**

```typescript
it('always logs translation_keywords_masked when keywords configured but text does not match', async () => {
  await store.update(enabledRoomId, {
    protectedKeywords: [{ keyword: 'UnusedBrand', category: 'company' }],
  })

  await handleTranslateRequest(makeCommand())

  const masked = readJsonLogs().find((e) => e['event'] === 'translation_keywords_masked')
  expect(masked).toBeDefined()
  expect(masked).toMatchObject({
    configuredKeywordCount: 1,
    primaryTextChangedByMask: false,
    translationInputSegmentCount: 3,
    segmentsChangedByMaskCount: 0,
    hasSystemHint: false,
  })
})
```

(Default `makeCommand()` uses three segments `['A','B','C']` — adjust `translationInputSegmentCount` if the fixture changes.)

- [ ] **Step 3: Add test — zero configured keywords → mask event still emitted**

```typescript
it('logs translation_keywords_masked with configuredKeywordCount 0 when no keywords configured', async () => {
  await store.update(enabledRoomId, { protectedKeywords: [] })

  await handleTranslateRequest(makeCommand())

  const masked = readJsonLogs().find((e) => e['event'] === 'translation_keywords_masked')
  expect(masked).toMatchObject({
    configuredKeywordCount: 0,
    primaryTextChangedByMask: false,
    hasSystemHint: false,
  })
})
```

If `protectedKeywords: []` is not a valid patch, use `protectedKeywords: undefined` by recreating room or omitting keywords on create — mirror how `roomConfig.protectedKeywords ?? []` behaves in the handler.

- [ ] **Step 4: Add test — chronological order context → mask → restore**

Requires context + keywords on the same room:

```typescript
it('orders translation_context_applied before translation_keywords_masked before translation_keywords_restored', async () => {
  await store.update(enabledRoomId, {
    context: 'Sales room',
    protectedKeywords: [{ keyword: 'X', category: 'company' }],
  })

  await handleTranslateRequest(
    makeCommand({
      translatableText: 'Mail from X',
      translationInputs: ['Mail from X'],
    }),
  )

  const logs = readJsonLogs()
  const idx = (name: string) => logs.findIndex((e) => e['event'] === name)
  const iCtx = idx('translation_context_applied')
  const iMask = idx('translation_keywords_masked')
  const iRestore = idx('translation_keywords_restored')

  expect(iCtx).toBeGreaterThanOrEqual(0)
  expect(iMask).toBeGreaterThanOrEqual(0)
  expect(iRestore).toBeGreaterThanOrEqual(0)
  expect(iCtx).toBeLessThan(iMask)
  expect(iMask).toBeLessThan(iRestore)
})
```

- [ ] **Step 5: Add test — pipeline fails after mask → restore event absent**

Force the mock executor to throw (e.g. `TranslationError` with `INVALID_RESPONSE`) after mask would have run:

```typescript
it('does not log translation_keywords_restored when pipeline fails before restore', async () => {
  await store.update(enabledRoomId, {
    protectedKeywords: [{ keyword: 'Y', category: 'company' }],
  })

  mockGetProviderPlugin.mockImplementationOnce(() =>
    createMockProvider(
      'openai',
      {
        execute<T>(_prompts: PromptPair, _schema: ISchema<T>): Promise<T> {
          return Promise.reject(new MockTranslationError('bad', 'INVALID_RESPONSE'))
        },
        describeExecution() {
          return {
            generation: {
              temperature: 0,
              maxOutputTokens: 4000,
              providerOptions: null,
              providerManaged: false,
            },
          }
        },
      },
      50,
    ),
  )

  await expect(
    handleTranslateRequest(
      makeCommand({
        translatableText: 'Hello Y',
        translationInputs: ['Hello Y'],
      }),
    ),
  ).rejects.toThrow()

  const logs = readJsonLogs()
  expect(logs.some((e) => e['event'] === 'translation_keywords_masked')).toBe(true)
  expect(logs.some((e) => e['event'] === 'translation_keywords_restored')).toBe(false)
})
```

Align error class with existing tests (`MockTranslationError`).

- [ ] **Step 6: Run tests — confirm RED**

```bash
bun test packages/translator/src/webhook/handler.test.ts
```

Expected: keyword-related tests **fail**.

- [ ] **Step 7: Commit (tests only)**

```bash
git add packages/translator/src/webhook/handler.test.ts
git commit -m "test(translator): add failing tests for keyword mask/restore logging"
```

---

## Task 3: Implementation — `handler.ts`

**Files:**

- Modify: `packages/translator/src/webhook/handler.ts`

- [ ] **Step 1: Import type for safe cast (if needed)**

At top (type-only):

```typescript
import type { TranslatorLogEntry } from '~/types/observability'
```

- [ ] **Step 2: Derive trimmed context once inside `try` (before masking)**

Immediately after `try {` (before `const keywords = …`), compute:

```typescript
const trimmedRoomContext = roomConfig.context?.trim()
const hasRoomContextForPipeline = trimmedRoomContext !== undefined && trimmedRoomContext.length > 0
```

Use `hasRoomContextForPipeline` for logging **and** for assigning `pipelineOpts.roomContext` (replacing bare `if (roomConfig.context)` so whitespace-only context is not injected — aligns log + behavior with spec).

- [ ] **Step 3: Log `translation_context_applied` before `maskKeywords`**

Still before masking:

```typescript
if (hasRoomContextForPipeline) {
  observer.logEvent('info', 'translation_context_applied', {
    roomContextApplied: true,
    roomContextLength: Array.from(trimmedRoomContext).length,
  } as Partial<TranslatorLogEntry>)
}
```

- [ ] **Step 4: After masking, compute comparison fields and log `translation_keywords_masked`**

After `maskedTranslationInputs` is built:

```typescript
const primaryTextChangedByMask = cleanText.normalize('NFC') !== maskedText
const segmentsChangedByMaskCount = command.translationInputs.filter(
  (seg, idx) => seg.normalize('NFC') !== maskedTranslationInputs[idx],
).length

observer.logEvent('info', 'translation_keywords_masked', {
  configuredKeywordCount: keywords.length,
  primaryTextChangedByMask,
  translationInputSegmentCount: command.translationInputs.length,
  segmentsChangedByMaskCount,
  hasSystemHint: systemHint.length > 0,
} as Partial<TranslatorLogEntry>)
```

If TypeScript complains that `maskedTranslationInputs[idx]` may be undefined, use a length guard or non-null assertion only when `idx` is in range (lengths should match `command.translationInputs`).

- [ ] **Step 5: Set `pipelineOpts.roomContext` from trimmed string**

Replace:

```typescript
if (roomConfig.context) {
  pipelineOpts.roomContext = roomConfig.context
}
```

with:

```typescript
if (hasRoomContextForPipeline) {
  pipelineOpts.roomContext = trimmedRoomContext
}
```

- [ ] **Step 6: After restore arrays are built, log `translation_keywords_restored` before `writeTranslationOutput`**

After `restoredTranslatedSegments` and `result` are defined:

```typescript
const primaryTranslationChangedByRestore =
  pipelineResult.translation.translatedText !== result.translatedText
const segmentsChangedByRestoreCount = pipelineResult.translatedSegments.filter(
  (seg, idx) => seg !== restoredTranslatedSegments[idx],
).length

observer.logEvent('info', 'translation_keywords_restored', {
  configuredKeywordCount: keywords.length,
  primaryTranslationChangedByRestore,
  segmentsChangedByRestoreCount,
} as Partial<TranslatorLogEntry>)
```

- [ ] **Step 7: Run handler tests**

```bash
bun test packages/translator/src/webhook/handler.test.ts
```

Expected: **PASS** for all tests in that file.

- [ ] **Step 8: Commit (implementation)**

```bash
git add packages/translator/src/webhook/handler.ts
git commit -m "feat(translator): log context application and keyword mask/restore metadata"
```

---

## Task 4: Verification (definition of done)

- [ ] **Step 1: Full translator tests**

```bash
bun test packages/translator
```

Expected: all passing.

- [ ] **Step 2: Monorepo typecheck**

```bash
bun run typecheck
```

Expected: exit 0. If new fields fail assignability without cast, ensure `as Partial<TranslatorLogEntry>` is applied on every new `logEvent` extras object.

- [ ] **Step 3: Lint**

```bash
bun run lint
```

Expected: exit 0.

- [ ] **Step 4: Manual security audit (no automated tool)**

Grep the handler for new log calls and confirm no variables holding user text, keywords, or context are passed into `logEvent`:

```bash
rg "logEvent\(" packages/translator/src/webhook/handler.ts
```

- [ ] **Step 5: Optional manual Docker log check (from spec §15 AC-10)**

Run a translation with room context + keywords in your docker compose setup and confirm three events appear in container logs with expected numeric/boolean fields only.

- [ ] **Step 6: Final commit** (only if you fixed something in verification)

Only if follow-up fixes were required:

```bash
git add -A
git commit -m "fix(translator): align context/keyword logging tests with pipeline behavior"
```

---

## Commit summary

| Point                    | Message (suggested)                                                           |
| ------------------------ | ----------------------------------------------------------------------------- |
| After Task 1             | `test(translator): add failing tests for translation_context_applied logging` |
| After Task 2             | `test(translator): add failing tests for keyword mask/restore logging`        |
| After Task 3             | `feat(translator): log context application and keyword mask/restore metadata` |
| After Task 4 (if needed) | `fix(translator): align context/keyword logging tests with pipeline behavior` |

---

## Self-review (plan vs spec)

1. **Spec coverage:** All three events, `observer.logEvent`, safe metadata only, always emit for mask/restore, optional context, ordering, edge cases (no keywords, no match, pipeline failure, no context), tests — each maps to Task 1–4.
2. **Placeholder scan:** No TBD/TODO; test and code bodies are concrete.
3. **Type consistency:** Field names match design §7 (`roomContextApplied`, `configuredKeywordCount`, etc.). `trimmedRoomContext` + `hasRoomContextForPipeline` keep injection and logging consistent.
4. **User vs spec:** User asked for “when roomConfig.context exists”; approved spec uses trimmed non-empty — plan follows **approved spec** and adds a whitespace test.

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-01-translation-context-keyword-logging.md`.**

**Execution options:**

1. **Subagent-driven (recommended)** — Fresh subagent per task, review between tasks.
2. **Inline execution** — Run tasks in one session with checkpoints (`executing-plans`).

Which approach do you want?
