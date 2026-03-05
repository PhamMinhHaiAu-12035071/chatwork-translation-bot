# AI Type Organization Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move `AIProvider`, `GeminiModel`, `OpenAIModel` and related constants into `packages/core/src/types/ai.ts` following the `ai_rules/type-organization.md` convention, update all consumers, and rename test files to match naming convention.

**Architecture:** Create a new `types/ai.ts` file as the single source of truth for all AI-related type identifiers. Update services to use typed constructors, add overloaded factory signatures for type-safe call sites, sync `env.ts` Zod enum from the exported values array, and rename two test files that have ordering prefixes violating naming convention.

**Tech Stack:** TypeScript 5.4+ strict mode, Bun test runner, Zod for env validation, `bun run typecheck` via `tsc --noEmit`.

---

### Task 1: Create `packages/core/src/types/ai.ts`

**Files:**

- Create: `packages/core/src/types/ai.ts`

**Step 1: Create the file**

```typescript
// packages/core/src/types/ai.ts

export const AI_PROVIDER_VALUES = ['gemini', 'openai'] as const
export type AIProvider = (typeof AI_PROVIDER_VALUES)[number]

export type GeminiModel = 'gemini-2.5-pro' | 'gemini-2.0-flash'
export type OpenAIModel = 'gpt-4o' | 'gpt-4o-mini'

export const DEFAULT_GEMINI_MODEL: GeminiModel = 'gemini-2.5-pro'
export const DEFAULT_OPENAI_MODEL: OpenAIModel = 'gpt-4o'
```

**Step 2: Verify typecheck passes**

Run: `bun run typecheck`
Expected: `Done` for all three packages, no errors.

**Step 3: Commit**

```bash
git add packages/core/src/types/ai.ts
git commit -m "feat(core): add types/ai.ts with AIProvider, model types, and default constants"
```

---

### Task 2: Update `packages/core/src/index.ts` exports

**Files:**

- Modify: `packages/core/src/index.ts`

**Step 1: Update the Types section**

In `packages/core/src/index.ts`, find the line:

```typescript
export type { ParsedCommand, SupportedLang } from './types/command'
export { SUPPORTED_LANGUAGES, isSupportedLang } from './types/command'
```

Add after it:

```typescript
export type { AIProvider, GeminiModel, OpenAIModel } from './types/ai'
export { AI_PROVIDER_VALUES, DEFAULT_GEMINI_MODEL, DEFAULT_OPENAI_MODEL } from './types/ai'
```

Then in the Services section, remove:

```typescript
export type { AIProvider } from './services/translation-factory'
```

The Services section should now end with:

```typescript
export { MockTranslationService } from './services/mock-translation'
export { GeminiTranslationService } from './services/gemini-translation'
export { OpenAITranslationService } from './services/openai-translation'
export { TranslationServiceFactory } from './services/translation-factory'
```

**Step 2: Verify typecheck passes**

Run: `bun run typecheck`
Expected: `Done` for all three packages, no errors.

> Note: `translation-factory.ts` still exports `AIProvider` at this point — this is fine. We'll clean it up in Task 4.

**Step 3: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "refactor(core): re-export AIProvider and model types from types/ai instead of services"
```

---

### Task 3: Update `packages/core/src/services/gemini-translation.ts`

**Files:**

- Modify: `packages/core/src/services/gemini-translation.ts`

**Step 1: Add imports and update constructor**

Replace the current constructor line:

```typescript
constructor(private readonly modelId = 'gemini-2.5-pro') {}
```

With:

```typescript
constructor(private readonly modelId: GeminiModel = DEFAULT_GEMINI_MODEL) {}
```

And add imports at the top of the file (after existing imports):

```typescript
import type { GeminiModel } from '../types/ai'
import { DEFAULT_GEMINI_MODEL } from '../types/ai'
```

**Step 2: Verify typecheck passes**

Run: `bun run typecheck`
Expected: Done for all packages, no errors.

**Step 3: Run tests**

Run: `bun test packages/core/src/services/gemini-translation.test.ts`
Expected: all tests pass.

**Step 4: Commit**

```bash
git add packages/core/src/services/gemini-translation.ts
git commit -m "refactor(core): type GeminiTranslationService constructor with GeminiModel"
```

---

### Task 4: Update `packages/core/src/services/openai-translation.ts`

**Files:**

- Modify: `packages/core/src/services/openai-translation.ts`

**Step 1: Add imports and update constructor**

Replace the current constructor line:

```typescript
constructor(private readonly modelId = 'gpt-4o') {}
```

With:

```typescript
constructor(private readonly modelId: OpenAIModel = DEFAULT_OPENAI_MODEL) {}
```

And add imports at the top of the file (after existing imports):

```typescript
import type { OpenAIModel } from '../types/ai'
import { DEFAULT_OPENAI_MODEL } from '../types/ai'
```

**Step 2: Verify typecheck passes**

Run: `bun run typecheck`
Expected: Done for all packages, no errors.

**Step 3: Run tests**

Run: `bun test packages/core/src/services/openai-translation.test.ts`
Expected: all tests pass.

**Step 4: Commit**

```bash
git add packages/core/src/services/openai-translation.ts
git commit -m "refactor(core): type OpenAITranslationService constructor with OpenAIModel"
```

---

### Task 5: Update `packages/core/src/services/translation-factory.ts`

This is the core of the refactor: remove the inline `AIProvider` definition, add overloaded signatures so callers get per-provider type checking.

**Files:**

- Modify: `packages/core/src/services/translation-factory.ts`

**Step 1: Replace the entire file content**

```typescript
import type { ITranslationService } from '../interfaces/translation'
import type { AIProvider, GeminiModel, OpenAIModel } from '../types/ai'
import { DEFAULT_GEMINI_MODEL, DEFAULT_OPENAI_MODEL } from '../types/ai'
import { GeminiTranslationService } from './gemini-translation'
import { OpenAITranslationService } from './openai-translation'

export const TranslationServiceFactory = {
  create(provider: 'gemini', modelOverride?: GeminiModel): ITranslationService
  create(provider: 'openai', modelOverride?: OpenAIModel): ITranslationService
  create(provider: AIProvider, modelOverride?: GeminiModel | OpenAIModel): ITranslationService {
    if (provider === 'gemini') {
      return new GeminiTranslationService(
        (modelOverride as GeminiModel | undefined) ?? DEFAULT_GEMINI_MODEL,
      )
    }
    return new OpenAITranslationService(
      (modelOverride as OpenAIModel | undefined) ?? DEFAULT_OPENAI_MODEL,
    )
  },
}
```

> **Why cast?** Overload signatures give callers perfect type safety (`create('gemini', 'gpt-4o')` is a compile error). Inside the implementation, TypeScript uses the union signature and cannot narrow `modelOverride` from the provider value — internal cast is the standard TypeScript overload implementation pattern.

**Step 2: Verify typecheck passes**

Run: `bun run typecheck`
Expected: Done for all packages, no errors.

**Step 3: Run factory tests**

Run: `bun test packages/core/src/services/translation-factory.test.ts`
Expected: all 4 tests pass.

**Step 4: Commit**

```bash
git add packages/core/src/services/translation-factory.ts
git commit -m "refactor(core): remove inline AIProvider, add overloaded factory signatures"
```

---

### Task 6: Update `packages/translator/src/env.ts`

**Files:**

- Modify: `packages/translator/src/env.ts`

**Step 1: Add import and swap enum**

Add at the top of the file (after `import { z } from 'zod'`):

```typescript
import { AI_PROVIDER_VALUES } from '@chatwork-bot/core'
```

Then replace:

```typescript
AI_PROVIDER: z.enum(['gemini', 'openai']),
```

With:

```typescript
AI_PROVIDER: z.enum(AI_PROVIDER_VALUES),
```

**Step 2: Verify typecheck passes**

Run: `bun run typecheck`
Expected: Done for all packages, no errors.

**Step 3: Run all tests**

Run: `bun test`
Expected: 64 pass, 0 fail.

**Step 4: Commit**

```bash
git add packages/translator/src/env.ts
git commit -m "refactor(translator): sync AI_PROVIDER enum from core AI_PROVIDER_VALUES"
```

---

### Task 7: Rename test files to match naming convention

**Files:**

- Rename: `packages/translator/src/webhook/01-handler.test.ts` → `handler.test.ts`
- Rename: `packages/translator/src/webhook/zzz-router.test.ts` → `router.test.ts`

**Step 1: Rename using git mv (preserves history)**

```bash
git mv packages/translator/src/webhook/01-handler.test.ts packages/translator/src/webhook/handler.test.ts
git mv packages/translator/src/webhook/zzz-router.test.ts packages/translator/src/webhook/router.test.ts
```

**Step 2: Run the renamed tests individually to verify they still work**

```bash
bun test packages/translator/src/webhook/handler.test.ts
bun test packages/translator/src/webhook/router.test.ts
```

Expected: all tests in each file pass.

**Step 3: Run full test suite**

Run: `bun test`
Expected: 64 pass, 0 fail. (Same count — just different file names.)

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor(translator): rename test files to follow naming convention"
```

---

### Task 8: Final verification

**Step 1: Full typecheck**

Run: `bun run typecheck`
Expected: Done for all three packages, no errors.

**Step 2: Full test suite**

Run: `bun test`
Expected: 64 pass, 0 fail.

**Step 3: Lint**

Run: `bun run lint`
Expected: no errors or warnings.

**Step 4: Verify type organization visually**

Confirm `packages/core/src/types/` contains:

- `chatwork.ts`
- `chatwork.test.ts`
- `command.ts`
- `ai.ts` ← new

Confirm `AIProvider` no longer defined in any `services/` file:

```bash
grep -r "export type AIProvider" packages/core/src/services/
```

Expected: no output.

---

## Summary of Changes

| File                                                 | Action                                             |
| ---------------------------------------------------- | -------------------------------------------------- |
| `packages/core/src/types/ai.ts`                      | Create — new type file                             |
| `packages/core/src/index.ts`                         | Update — swap AIProvider source, add model exports |
| `packages/core/src/services/gemini-translation.ts`   | Update — typed constructor                         |
| `packages/core/src/services/openai-translation.ts`   | Update — typed constructor                         |
| `packages/core/src/services/translation-factory.ts`  | Update — remove AIProvider, overloaded signatures  |
| `packages/translator/src/env.ts`                     | Update — use AI_PROVIDER_VALUES                    |
| `packages/translator/src/webhook/01-handler.test.ts` | Rename → `handler.test.ts`                         |
| `packages/translator/src/webhook/zzz-router.test.ts` | Rename → `router.test.ts`                          |
