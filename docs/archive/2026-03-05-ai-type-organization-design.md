# Design: AI Type Organization Refactor

**Date**: 2026-03-05
**Status**: Approved

## Problem

Three rule violations identified:

1. `AIProvider` type defined inside `services/translation-factory.ts` — violates `ai_rules/type-organization.md` which states `types/` holds domain value objects and external data shapes, not service internals.
2. Model strings `'gemini-2.5-pro'`, `'gemini-2.0-flash'`, `'gpt-4o'`, `'gpt-4o-mini'` are hardcoded across multiple files — no type safety, typos are silent.
3. Test files `01-handler.test.ts` and `zzz-router.test.ts` have ordering prefixes — violates `ai_rules/test-colocation.md` rule: test files must be named `<source>.test.ts`.

## Decisions

| Question             | Decision                                                          |
| -------------------- | ----------------------------------------------------------------- |
| File for AI types    | New `packages/core/src/types/ai.ts`                               |
| Model type form      | Union string literal (`type GeminiModel = 'a' \| 'b'`)            |
| Model list scope     | Only models currently in codebase (including test overrides)      |
| Default constants    | `DEFAULT_GEMINI_MODEL`, `DEFAULT_OPENAI_MODEL` in `types/ai.ts`   |
| Test rename          | Rename to `handler.test.ts` and `router.test.ts`                  |
| `env.ts` sync        | `z.enum(AI_PROVIDER_VALUES)` using exported array from `@core`    |
| Service constructors | Strict typed (`modelId: GeminiModel = DEFAULT_GEMINI_MODEL`)      |
| Factory signature    | Overloaded signatures (no internal cast exposed to callers)       |
| Public API exports   | All: `AIProvider`, `GeminiModel`, `OpenAIModel`, constants, array |
| `AI_MODEL` env var   | Keep `z.string().optional()` — too restrictive to enum-lock       |

## Design

### New file: `packages/core/src/types/ai.ts`

```typescript
export const AI_PROVIDER_VALUES = ['gemini', 'openai'] as const
export type AIProvider = (typeof AI_PROVIDER_VALUES)[number]

export type GeminiModel = 'gemini-2.5-pro' | 'gemini-2.0-flash'
export type OpenAIModel = 'gpt-4o' | 'gpt-4o-mini'

export const DEFAULT_GEMINI_MODEL: GeminiModel = 'gemini-2.5-pro'
export const DEFAULT_OPENAI_MODEL: OpenAIModel = 'gpt-4o'
```

### Updated: `packages/core/src/services/gemini-translation.ts`

```typescript
import type { GeminiModel } from '../types/ai'
import { DEFAULT_GEMINI_MODEL } from '../types/ai'

constructor(private readonly modelId: GeminiModel = DEFAULT_GEMINI_MODEL)
```

### Updated: `packages/core/src/services/openai-translation.ts`

```typescript
import type { OpenAIModel } from '../types/ai'
import { DEFAULT_OPENAI_MODEL } from '../types/ai'

constructor(private readonly modelId: OpenAIModel = DEFAULT_OPENAI_MODEL)
```

### Updated: `packages/core/src/services/translation-factory.ts`

Remove `export type AIProvider`. Replace with overloaded signatures:

```typescript
import type { AIProvider, GeminiModel, OpenAIModel } from '../types/ai'
import { DEFAULT_GEMINI_MODEL, DEFAULT_OPENAI_MODEL } from '../types/ai'

export const TranslationServiceFactory = {
  create(provider: 'gemini', modelOverride?: GeminiModel): ITranslationService
  create(provider: 'openai', modelOverride?: OpenAIModel): ITranslationService
  create(provider: AIProvider, modelOverride?: GeminiModel | OpenAIModel): ITranslationService {
    if (provider === 'gemini') {
      return new GeminiTranslationService(
        (modelOverride as GeminiModel | undefined) ?? DEFAULT_GEMINI_MODEL
      )
    }
    return new OpenAITranslationService(
      (modelOverride as OpenAIModel | undefined) ?? DEFAULT_OPENAI_MODEL
    )
  },
}
```

> Overloads ensure `create('gemini', 'gpt-4o')` is a compile error at call sites. Internal cast is the standard TypeScript overload implementation pattern.

### Updated: `packages/core/src/index.ts`

Remove:

```typescript
export type { AIProvider } from './services/translation-factory'
```

Add to Types section:

```typescript
export type { AIProvider, GeminiModel, OpenAIModel } from './types/ai'
export { AI_PROVIDER_VALUES, DEFAULT_GEMINI_MODEL, DEFAULT_OPENAI_MODEL } from './types/ai'
```

### Updated: `packages/translator/src/env.ts`

```typescript
import { AI_PROVIDER_VALUES } from '@chatwork-bot/core'
// ...
AI_PROVIDER: z.enum(AI_PROVIDER_VALUES),
```

### Renamed test files

```
packages/translator/src/webhook/01-handler.test.ts → handler.test.ts
packages/translator/src/webhook/zzz-router.test.ts → router.test.ts
```

## File Change Summary

| File                                                 | Action |
| ---------------------------------------------------- | ------ |
| `packages/core/src/types/ai.ts`                      | Create |
| `packages/core/src/services/translation-factory.ts`  | Update |
| `packages/core/src/services/gemini-translation.ts`   | Update |
| `packages/core/src/services/openai-translation.ts`   | Update |
| `packages/core/src/index.ts`                         | Update |
| `packages/translator/src/env.ts`                     | Update |
| `packages/translator/src/webhook/01-handler.test.ts` | Rename |
| `packages/translator/src/webhook/zzz-router.test.ts` | Rename |

## Verification

```bash
bun run typecheck   # All packages pass
bun test            # All tests pass (includes renamed test files)
bun run lint        # No new lint errors
```
