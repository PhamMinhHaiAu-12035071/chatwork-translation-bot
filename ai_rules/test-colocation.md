# Test Co-location Rules

## Rule: Test files live next to their source file

```
packages/core/src/
├── chatwork/
│   ├── client.ts
│   └── client.test.ts ← same folder, not in __tests__/
├── utils/
│   ├── parse-command.ts
│   └── parse-command.test.ts
└── services/
    ├── gemini-translation.ts
    └── gemini-translation.test.ts
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
bun test packages/core/src/chatwork/client.test.ts
```

Run the full suite only before committing:

```bash
bun test
```

## Rule: What to test

Prioritize:

1. Parsing logic (pure functions with many branches)
2. Webhook signature verification
3. Error paths and edge cases

Do NOT test:

- Simple constructors that just assign properties
- TypeScript types (the compiler handles this)
- Third-party library behavior
