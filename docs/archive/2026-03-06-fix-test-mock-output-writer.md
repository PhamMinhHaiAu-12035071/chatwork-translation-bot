# Fix Test Mock Output Writer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure no test writes real JSON files to `output/` by adding proper mocks in `handler.test.ts` and `router.test.ts`.

**Architecture:** Tests at the handler layer mock `writeTranslationOutput` as a spy to prevent filesystem writes while still asserting the function was called with correct arguments. Tests at the router layer mock the entire handler module since the router only needs to verify HTTP contract.

**Tech Stack:** Bun test, `mock()` and `mock.module()` from `bun:test`, TypeScript

---

### Task 1: Delete test-generated JSON files from `output/`

**Files:**

- Delete: `output/2026-03-06/789012345.json`
- Delete: `output/2026-03-04/2081046619322847232.json` (if exists)

**Step 1: Check which files exist**

Run:

```bash
ls output/2026-03-06/ 2>/dev/null && ls output/2026-03-04/ 2>/dev/null
```

Expected: see `789012345.json` and possibly `2081046619322847232.json`

**Step 2: Delete them**

```bash
rm -f output/2026-03-06/789012345.json
rm -f output/2026-03-04/2081046619322847232.json
```

**Step 3: Verify `output/` is clean**

Run:

```bash
find output/ -name "*.json" 2>/dev/null
```

Expected: no output (or only real webhook files you intentionally kept)

**Step 4: Commit**

```bash
git add -A
git commit -m "chore(output): remove test-generated JSON files from output directory"
```

---

### Task 2: Add `writeTranslationOutput` mock in `handler.test.ts`

**Files:**

- Modify: `packages/translator/src/webhook/handler.test.ts`

**Context:** `handler.test.ts` imports `handleTranslateRequest` dynamically after mocking its dependencies in `beforeAll`. The mock for `output-writer` must be registered **before** the dynamic `import('./handler')` call because Bun's module mock system intercepts at import time.

**Step 1: Read the current test file**

Read `packages/translator/src/webhook/handler.test.ts` fully to understand the existing mock setup before editing.

**Step 2: Add the mock spy and module mock**

At the top of the file, add `mockWriteOutput` alongside the other mock declarations:

```typescript
const mockWriteOutput = mock(() => Promise.resolve())
```

In `beforeAll`, add the `mock.module` call **before** `mock.module('../env', ...)`:

```typescript
void mock.module('../utils/output-writer', () => ({
  writeTranslationOutput: mockWriteOutput,
}))
```

**Step 3: Add assertion in the translate test case**

In the test `'translates message and calls service with stripped text'`, after the existing `expect` calls, add:

```typescript
expect(mockWriteOutput).toHaveBeenCalledTimes(1)
expect(mockWriteOutput.mock.calls[0]?.[0]).toMatchObject({
  webhook_event: { message_id: '2081046619322847232' },
  translation: translationResult,
})
```

**Step 4: Run only this test to verify it passes**

Run:

```bash
bun test packages/translator/src/webhook/handler.test.ts
```

Expected: all tests pass, no file created in `output/`

**Step 5: Verify no new JSON files in `output/`**

Run:

```bash
find output/ -name "*.json" 2>/dev/null
```

Expected: no output

**Step 6: Commit**

```bash
git add packages/translator/src/webhook/handler.test.ts
git commit -m "test(translator): mock writeTranslationOutput in handler test to prevent real file writes"
```

---

### Task 3: Add handler mock in `router.test.ts`

**Files:**

- Modify: `packages/translator/src/webhook/router.test.ts`

**Context:** `router.test.ts` sends real HTTP requests through the Elysia router. The router calls `void handleTranslateRequest(...).catch(...)` (fire-and-forget), meaning the handler runs asynchronously _after_ the response is returned. This is why `output/2026-03-06/789012345.json` was created — the test got its 200 response and finished, but the handler kept running in the background. Mocking the entire handler module is the cleanest fix.

**Step 1: Read the current test file**

Read `packages/translator/src/webhook/router.test.ts` fully before editing.

**Step 2: Add the handler module mock in `beforeAll`**

Add this as the **first** `mock.module` call inside `beforeAll`, before any other mocks:

```typescript
void mock.module('./handler', () => ({
  handleTranslateRequest: mock(() => Promise.resolve()),
}))
```

**Why first?** Bun resolves mocks in registration order. Mocking `./handler` early ensures the router imports the mocked version when `import('./router')` is called.

**Step 3: Run only this test to verify it passes**

Run:

```bash
bun test packages/translator/src/webhook/router.test.ts
```

Expected: all 3 tests pass (200 with valid payload, 422 with missing event, fire-and-forget contract)

**Step 4: Verify no new JSON files in `output/`**

Run:

```bash
find output/ -name "*.json" 2>/dev/null
```

Expected: no output

**Step 5: Commit**

```bash
git add packages/translator/src/webhook/router.test.ts
git commit -m "test(translator): mock handleTranslateRequest in router test to prevent output file creation"
```

---

### Task 4: Run full test suite and verify

**Step 1: Run all tests**

Run:

```bash
bun test
```

Expected: all tests pass

**Step 2: Run typecheck and lint**

Run:

```bash
bun run typecheck && bun run lint
```

Expected: no errors

**Step 3: Final check — no test files in `output/`**

Run:

```bash
find output/ -name "*.json" 2>/dev/null
```

Expected: no output (or only real webhook files)

**Step 4: Commit if not already done**

If there are any remaining uncommitted changes:

```bash
git status
git add <files>
git commit -m "test(translator): ensure all tests mock output-writer, no files written to output/"
```

---

## Acceptance Criteria

- [ ] `bun test` passes with zero failures
- [ ] `output/` has no new files after `bun test`
- [ ] `handler.test.ts` mocks `writeTranslationOutput` and asserts it was called with correct args
- [ ] `router.test.ts` mocks `handleTranslateRequest` so no handler logic runs during routing tests
- [ ] `output-writer.test.ts` unchanged and still passes (uses `__test_output__` correctly)
- [ ] `output-writer.ts` production code unchanged

## Files Modified

| File                                              | Change                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| `packages/translator/src/webhook/handler.test.ts` | Add `mockWriteOutput` spy + `mock.module('../utils/output-writer')` + assertion |
| `packages/translator/src/webhook/router.test.ts`  | Add `mock.module('./handler')` in `beforeAll`                                   |
| `output/2026-03-06/789012345.json`                | Deleted                                                                         |
| `output/2026-03-04/2081046619322847232.json`      | Deleted (if exists)                                                             |
