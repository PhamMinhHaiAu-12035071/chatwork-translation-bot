# Design: Fix Tests Writing to output/ Directory

## Problem

`writeTranslationOutput()` was not mocked in `handler.test.ts` and `router.test.ts`.
As a result, tests were creating real JSON files in `output/` (production directory).

**Files created by tests (not real webhooks):**

- `output/2026-03-06/789012345.json` — created by `router.test.ts` (fire-and-forget async leak)
- `output/2026-03-04/2081046619322847232.json` — likely created by `handler.test.ts`

**Root cause in `handler.ts`:**

```typescript
await writeTranslationOutput({ ...event, translation: result })
```

This is called unconditionally. Neither `handler.test.ts` nor `router.test.ts` mocked this function.

## Decisions

| #   | Decision            | Choice                                                          |
| --- | ------------------- | --------------------------------------------------------------- |
| 1   | Barrier location    | Test layer (production code unchanged)                          |
| 2   | `handler.test.ts`   | Mock `writeTranslationOutput` + assert called with correct args |
| 3   | `router.test.ts`    | Mock entire `./handler` module                                  |
| 4   | Existing test files | Delete manually                                                 |
| 5   | New test cases      | None — only fix existing tests                                  |

## Design

### 1. `handler.test.ts`

Add a spy mock for `writeTranslationOutput` in `beforeAll`, alongside the existing mocks.
Assert it was called once with the correct event + translation payload in the "translates message" test case.

```typescript
const mockWriteOutput = mock(() => Promise.resolve())

// In beforeAll:
void mock.module('../utils/output-writer', () => ({
  writeTranslationOutput: mockWriteOutput,
}))

// In 'translates message...' test case, add:
expect(mockWriteOutput).toHaveBeenCalledTimes(1)
expect(mockWriteOutput.mock.calls[0]?.[0]).toMatchObject({
  webhook_event: { message_id: '2081046619322847232' },
  translation: translationResult,
})
```

**Why not mock the whole core module?**
`writeTranslationOutput` is a local utility, not from `@chatwork-bot/core`. It needs its own `mock.module`.

### 2. `router.test.ts`

Mock the entire `./handler` module so `handleTranslateRequest` is a no-op.
The router test only needs to verify HTTP contract (status codes, response body).

```typescript
// Add at the start of beforeAll, before other mocks:
void mock.module('./handler', () => ({
  handleTranslateRequest: mock(() => Promise.resolve()),
}))
```

**Why mock the whole handler instead of just output-writer?**

- Router is fire-and-forget — handler runs async after response is sent
- Mocking the handler (1 mock) is cleaner than mocking all handler dependencies (output-writer + translation service + chatwork sender + env)
- Proper layer isolation: router test should only test HTTP routing

### 3. Files to Delete

```
output/2026-03-06/789012345.json   (created by router.test.ts — "Hello World" test message)
output/2026-03-04/2081046619322847232.json  (verify + delete if from handler.test.ts)
```

### 4. Files NOT Changed

| File                    | Reason                                                 |
| ----------------------- | ------------------------------------------------------ |
| `output-writer.ts`      | Production code kept clean — no NODE_ENV guard needed  |
| `output-writer.test.ts` | Already correct — uses `__test_output__` dir + cleanup |

## Constraints

- Bun test with `mock.module()` requires mocks to be registered before `import()` of the module under test
- `handler.test.ts` uses `beforeAll` with dynamic `import('./handler')` — this pattern already supports inserting mock.module before the import
- `router.test.ts` same pattern — mock `./handler` before `import('./router')`

## Verification Commands

```bash
bun test packages/translator/src/webhook/handler.test.ts
bun test packages/translator/src/webhook/router.test.ts
bun test
ls output/   # should not have new test-generated files
```

## Acceptance Criteria

- [ ] `bun test` passes with no failures
- [ ] `output/` directory has no new files after running tests
- [ ] `handler.test.ts` asserts `writeTranslationOutput` called with correct args
- [ ] `router.test.ts` handler mock prevents any file system access
- [ ] `output-writer.test.ts` unchanged and still passes
