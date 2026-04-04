# Test Co-location Rules

## Rule: Test files live next to their source file

```
packages/core/src/
├── utils/
│   ├── parse-command.ts
│   └── parse-command.test.ts ← same folder, not in __tests__/
└── services/
    ├── gemini-translation.ts
    └── gemini-translation.test.ts

packages/chatwork/src/services/
├── verify-webhook-signature.ts
└── verify-webhook-signature.test.ts ← co-located
```

**Never** create a `__tests__/` folder or a top-level `tests/` directory. All test files live
adjacent to the file they test.

## Rule: Test file naming

`<source-file-name>.test.ts` — always the same name, `.test.ts` suffix.

```
output-writer.ts → output-writer.test.ts ✓
outputWriter.test.ts ✗ (wrong casing)
output-writer.spec.ts ✗ (use .test.ts, not .spec.ts)
```

## Rule: Test runner

Use Bun's built-in test runner. Import from `bun:test`:

```typescript
import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'
```

Never use Vitest, Jest, or other test frameworks.

## Rule: Run a single test file during development

```bash
bun test packages/chatwork/src/services/verify-webhook-signature.test.ts
```

Run the full suite only before committing:

```bash
bun test
```

## Rule: Mocking HTTP (`fetch`) in chatwork package tests

Use `spyOn(globalThis, 'fetch')` from `bun:test`. Install a default spy in `beforeEach` that throws on unexpected real calls, then override per-test:

```typescript
import { beforeEach, afterEach, spyOn, mock } from 'bun:test'

let fetchSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(() => {
    throw new Error('Unexpected real HTTP call')
  })
})

afterEach(() => {
  fetchSpy.mockRestore()
})
```

This ensures tests never reach `api.chatwork.com`.

### Testing Pattern: Pure Functions in Mocks

When mocking modules that export pure utility functions, prefer re-exporting the real implementation over duplicating logic:

```typescript
// ✅ Good: Re-export pure functions
import { formatDate } from '@lib/utils'

void mock.module('@lib/utils', () => ({
  formatDate, // Pure function — use real implementation
  fetchData: mockFetch, // Impure function — mock the side effect
}))

// ❌ Bad: Duplicate pure function logic
void mock.module('@lib/utils', () => ({
  formatDate: (d: Date) => d.toISOString(), // Duplication!
  fetchData: mockFetch,
}))
```

**Rationale:**

- Eliminates code duplication (DRY)
- Tests use production code path (catches integration issues)
- Mock only the boundaries (I/O, side effects), not domain logic

## Rule: What to test

Prioritize:

1. Parsing logic (pure functions with many branches)
2. Webhook signature verification
3. Error paths and edge cases

Do NOT test:

- Simple constructors that just assign properties
- TypeScript types (the compiler handles this)
- Third-party library behavior
