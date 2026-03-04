# generateObject() Refactor — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace `generateText()` + manual `parseAIResponse()` with `generateObject()` + Zod schema to eliminate ~150 lines of fragile JSON parsing logic from `packages/core`.

**Architecture:** Each AI translation service (`GeminiTranslationService`, `OpenAITranslationService`) calls `generateObject()` with a shared `TranslationSchema` Zod object. The AI SDK handles JSON mode / function calling internally — no manual parsing needed. The current retry-on-INVALID_RESPONSE logic is also removed (redundant with `generateObject()`).

**Tech Stack:** Bun, TypeScript strict, Vercel AI SDK v6 (`generateObject` from `ai`), Zod, Bun test runner.

---

## Pre-flight Checks

Confirm current tests pass before touching anything:

```bash
bun test packages/core
bun run typecheck
```

Expected: all tests PASS, 0 typecheck errors. If not, stop and resolve first.

---

## Task 1: Add `zod` to `packages/core` dependencies

**Files:**

- Modify: `packages/core/package.json`

> `zod` is currently only in `packages/translator`. Since `packages/core/src/services/translation-prompt.ts` will now `import { z } from 'zod'`, it must be an explicit dependency of core.

**Step 1: Install zod in core**

```bash
bun add zod --cwd packages/core
```

Expected: `packages/core/package.json` now has `"zod": "^3.x.x"` in `"dependencies"`.

**Step 2: Verify typecheck still passes**

```bash
bun run typecheck
```

Expected: no errors.

---

## Task 2: Refactor `translation-prompt.ts` (TDD)

**Files:**

- Modify: `packages/core/src/services/translation-prompt.test.ts`
- Modify: `packages/core/src/services/translation-prompt.ts`

> Current file has `buildTranslationPrompt()` (keep, simplify) + `parseAIResponse()` + 8 private helper functions (all delete). Add `TranslationSchema` Zod export.

### Step 1: Update the test file first

Replace the **entire** content of `packages/core/src/services/translation-prompt.test.ts`:

```ts
import { describe, expect, it } from 'bun:test'
import { buildTranslationPrompt, TranslationSchema } from './translation-prompt'

describe('buildTranslationPrompt', () => {
  it('includes the original text in the prompt', () => {
    const prompt = buildTranslationPrompt('Hello World')
    expect(prompt).toContain('Hello World')
  })

  it('mentions Vietnamese in the prompt', () => {
    const prompt = buildTranslationPrompt('any text')
    expect(prompt.toLowerCase()).toContain('vietnamese')
  })

  it('does not instruct AI to return JSON format', () => {
    const prompt = buildTranslationPrompt('text')
    expect(prompt).not.toContain('JSON')
    expect(prompt).not.toContain('sourceLang')
  })
})

describe('TranslationSchema', () => {
  it('accepts valid translation output', () => {
    const result = TranslationSchema.safeParse({ sourceLang: 'en', translated: 'Xin chào' })
    expect(result.success).toBe(true)
  })

  it('rejects empty translated text', () => {
    const result = TranslationSchema.safeParse({ sourceLang: 'en', translated: '' })
    expect(result.success).toBe(false)
  })

  it('accepts multi-part language codes like zh-CN', () => {
    const result = TranslationSchema.safeParse({ sourceLang: 'zh-CN', translated: '你好' })
    expect(result.success).toBe(true)
  })

  it('rejects missing sourceLang', () => {
    const result = TranslationSchema.safeParse({ translated: 'Xin chào' })
    expect(result.success).toBe(false)
  })
})
```

### Step 2: Run test to verify it fails

```bash
bun test packages/core/src/services/translation-prompt.test.ts
```

Expected: FAIL — `TranslationSchema` is not exported, `parseAIResponse` import removed.

### Step 3: Replace `translation-prompt.ts` with new implementation

Replace the **entire** content of `packages/core/src/services/translation-prompt.ts`:

```ts
import { z } from 'zod'

export const TranslationSchema = z.object({
  sourceLang: z.string().min(2).max(10), // ISO 639-1, e.g. 'en', 'ja', 'zh-CN'
  translated: z.string().min(1),
})

export type TranslationOutput = z.infer<typeof TranslationSchema>

export function buildTranslationPrompt(text: string): string {
  return `You are a professional translator.
Detect the source language and translate the following text into natural, human-readable Vietnamese prose.
Write as flowing sentences, not word-by-word.
Preserve the original meaning, tone, and nuance.

Text: ${text}`
}
```

### Step 4: Run test to verify it passes

```bash
bun test packages/core/src/services/translation-prompt.test.ts
```

Expected: all 7 tests PASS.

### Step 5: Commit

```bash
git add packages/core/src/services/translation-prompt.ts packages/core/src/services/translation-prompt.test.ts packages/core/package.json bun.lock
git commit -m "refactor(core): replace parseAIResponse with TranslationSchema Zod in translation-prompt"
```

---

## Task 3: Refactor `GeminiTranslationService` (TDD)

**Files:**

- Modify: `packages/core/src/services/gemini-translation.test.ts`
- Modify: `packages/core/src/services/gemini-translation.ts`

> Current service: `generateText()` → `parseAIResponse()` with retry on `INVALID_RESPONSE`. New: `generateObject()` with `TranslationSchema`. No retry needed.

### Step 1: Update the test file first

Replace the **entire** content of `packages/core/src/services/gemini-translation.test.ts`:

```ts
import { beforeAll, describe, expect, it, mock } from 'bun:test'
import type { GeminiTranslationService as GeminiTranslationServiceType } from './gemini-translation'

// Mock BEFORE importing the module under test
void mock.module('ai', () => ({
  generateObject: mock(() =>
    Promise.resolve({
      object: { sourceLang: 'en', translated: 'Xin chào thế giới' },
    }),
  ),
}))

void mock.module('@ai-sdk/google', () => ({
  google: mock((_modelId: string) => ({ provider: 'google', modelId: _modelId })),
}))

describe('GeminiTranslationService', () => {
  let GeminiTranslationService: typeof GeminiTranslationServiceType

  beforeAll(async () => {
    const mod = await import('./gemini-translation')
    GeminiTranslationService = mod.GeminiTranslationService
  })

  it('translates text and returns TranslationResult', async () => {
    const service = new GeminiTranslationService()
    const result = await service.translate('Hello World')

    expect(result.originalText).toBe('Hello World')
    expect(result.translatedText).toBe('Xin chào thế giới')
    expect(result.sourceLang).toBe('en')
    expect(result.targetLang).toBe('vi')
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('uses default model gemini-2.5-pro when no modelId given', async () => {
    const { google } = await import('@ai-sdk/google')
    const service = new GeminiTranslationService()
    await service.translate('test')
    expect(google).toHaveBeenCalledWith('gemini-2.5-pro')
  })

  it('uses custom modelId when provided', async () => {
    const { google } = await import('@ai-sdk/google')
    const service = new GeminiTranslationService('gemini-2.0-flash')
    await service.translate('test')
    expect(google).toHaveBeenCalledWith('gemini-2.0-flash')
  })
})
```

### Step 2: Run test to verify it fails

```bash
bun test packages/core/src/services/gemini-translation.test.ts
```

Expected: FAIL — service still calls `generateText`, mock is `generateObject`.

### Step 3: Replace `gemini-translation.ts` with new implementation

Replace the **entire** content of `packages/core/src/services/gemini-translation.ts`:

```ts
import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import type { ITranslationService, TranslationResult } from '../interfaces/translation'
import { TranslationError } from '../interfaces/translation'
import { TranslationSchema, buildTranslationPrompt } from './translation-prompt'

export class GeminiTranslationService implements ITranslationService {
  constructor(private readonly modelId = 'gemini-2.5-pro') {}

  async translate(text: string): Promise<TranslationResult> {
    try {
      const { object } = await generateObject({
        model: google(this.modelId),
        schema: TranslationSchema,
        prompt: buildTranslationPrompt(text),
        temperature: 0,
        maxOutputTokens: 1200,
      })
      return {
        originalText: text,
        translatedText: object.translated,
        sourceLang: object.sourceLang,
        targetLang: 'vi',
        timestamp: new Date().toISOString(),
      }
    } catch (cause) {
      throw new TranslationError(
        `Gemini API call failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        'API_ERROR',
        cause,
      )
    }
  }
}
```

### Step 4: Run test to verify it passes

```bash
bun test packages/core/src/services/gemini-translation.test.ts
```

Expected: all 3 tests PASS.

### Step 5: Commit

```bash
git add packages/core/src/services/gemini-translation.ts packages/core/src/services/gemini-translation.test.ts
git commit -m "refactor(core): replace generateText+parseAIResponse with generateObject in GeminiTranslationService"
```

---

## Task 4: Refactor `OpenAITranslationService` (TDD)

**Files:**

- Modify: `packages/core/src/services/openai-translation.test.ts`
- Modify: `packages/core/src/services/openai-translation.ts`

### Step 1: Update the test file first

Replace the **entire** content of `packages/core/src/services/openai-translation.test.ts`:

```ts
import { beforeAll, describe, expect, it, mock } from 'bun:test'
import type { OpenAITranslationService as OpenAITranslationServiceType } from './openai-translation'

void mock.module('ai', () => ({
  generateObject: mock(() =>
    Promise.resolve({
      object: { sourceLang: 'ja', translated: 'おはようございます、世界！' },
    }),
  ),
}))

void mock.module('@ai-sdk/openai', () => ({
  openai: mock((_modelId: string) => ({ provider: 'openai', modelId: _modelId })),
}))

describe('OpenAITranslationService', () => {
  let OpenAITranslationService: typeof OpenAITranslationServiceType

  beforeAll(async () => {
    const mod = await import('./openai-translation')
    OpenAITranslationService = mod.OpenAITranslationService
  })

  it('translates text and returns TranslationResult', async () => {
    const service = new OpenAITranslationService()
    const result = await service.translate('おはようございます、世界！')

    expect(result.originalText).toBe('おはようございます、世界！')
    expect(result.sourceLang).toBe('ja')
    expect(result.targetLang).toBe('vi')
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('uses default model gpt-4o when no modelId given', async () => {
    const { openai } = await import('@ai-sdk/openai')
    const service = new OpenAITranslationService()
    await service.translate('test')
    expect(openai).toHaveBeenCalledWith('gpt-4o')
  })

  it('uses custom modelId when provided', async () => {
    const { openai } = await import('@ai-sdk/openai')
    const service = new OpenAITranslationService('gpt-4o-mini')
    await service.translate('test')
    expect(openai).toHaveBeenCalledWith('gpt-4o-mini')
  })
})
```

### Step 2: Run test to verify it fails

```bash
bun test packages/core/src/services/openai-translation.test.ts
```

Expected: FAIL — service still calls `generateText`.

### Step 3: Replace `openai-translation.ts` with new implementation

Replace the **entire** content of `packages/core/src/services/openai-translation.ts`:

```ts
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import type { ITranslationService, TranslationResult } from '../interfaces/translation'
import { TranslationError } from '../interfaces/translation'
import { TranslationSchema, buildTranslationPrompt } from './translation-prompt'

export class OpenAITranslationService implements ITranslationService {
  constructor(private readonly modelId = 'gpt-4o') {}

  async translate(text: string): Promise<TranslationResult> {
    try {
      const { object } = await generateObject({
        model: openai(this.modelId),
        schema: TranslationSchema,
        prompt: buildTranslationPrompt(text),
        temperature: 0,
        maxOutputTokens: 1200,
      })
      return {
        originalText: text,
        translatedText: object.translated,
        sourceLang: object.sourceLang,
        targetLang: 'vi',
        timestamp: new Date().toISOString(),
      }
    } catch (cause) {
      throw new TranslationError(
        `OpenAI API call failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        'API_ERROR',
        cause,
      )
    }
  }
}
```

### Step 4: Run test to verify it passes

```bash
bun test packages/core/src/services/openai-translation.test.ts
```

Expected: all 3 tests PASS.

### Step 5: Commit

```bash
git add packages/core/src/services/openai-translation.ts packages/core/src/services/openai-translation.test.ts
git commit -m "refactor(core): replace generateText+parseAIResponse with generateObject in OpenAITranslationService"
```

---

## Task 5: Final Verification

### Step 1: Run all core tests

```bash
bun test packages/core
```

Expected: all tests PASS. Count should be lower than before (removed ~7 parseAIResponse tests).

### Step 2: Run full test suite

```bash
bun test
```

Expected: all tests PASS. No regressions in other packages.

### Step 3: Run typecheck

```bash
bun run typecheck
```

Expected: 0 errors. Key checks:

- `GeminiTranslationService` and `OpenAITranslationService` no longer reference `parseAIResponse`
- `TranslationSchema` properly typed with Zod inference
- No `@ts-ignore` or type assertions needed

### Step 4: Run lint

```bash
bun run lint
```

Expected: 0 errors. If warnings, fix with `bun run lint:fix`.

### Step 5: Final commit (if any lint fixes)

```bash
git add -p  # stage only lint fixes if any
git commit -m "chore(core): apply lint fixes after generateObject refactor"
```

---

## Summary: What Changed

| File                         | Before                                                                | After                                                          |
| ---------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------- |
| `translation-prompt.ts`      | `buildTranslationPrompt` + `parseAIResponse` + 8 helpers (~170 lines) | `TranslationSchema` Zod + `buildTranslationPrompt` (~20 lines) |
| `gemini-translation.ts`      | `generateText` + retry logic + `parseAIResponse`                      | `generateObject` + single try/catch                            |
| `openai-translation.ts`      | Same as Gemini                                                        | Same pattern                                                   |
| `translation-prompt.test.ts` | 3 prompt tests + 7 parseAIResponse tests                              | 3 prompt tests + 4 schema tests                                |
| `gemini-translation.test.ts` | Mocks `generateText`                                                  | Mocks `generateObject`                                         |
| `openai-translation.test.ts` | Mocks `generateText`                                                  | Mocks `generateObject`                                         |

**Net result:** ~150 lines removed, 0 functionality lost, all tests pass.
