# Refactor AI Parsing: `generateText()` → `generateObject()` — Design Document

**Date**: 2026-03-04
**Status**: Approved
**Scope**: 4 files in `packages/core/src/services/`

---

## Problem

`packages/core/src/services/translation-prompt.ts` contains ~150 lines of complex JSON parsing logic because `generateText()` always returns `{ text: string }` — a raw string regardless of what the prompt instructs. AI models may return JSON wrapped in markdown code blocks, include explanatory text, or deviate from the requested format. The current fallback chain (`extractFencedJson` → `extractFirstJsonObject` → `tryExtractFieldsWithoutJson`) is fragile and hard to test.

**Root cause**: Using the wrong AI SDK function for the job. `generateText()` is for free-form text. `generateObject()` is for structured output.

---

## Clarification: Two Distinct JSON Parsing Layers

There are **two separate** JSON parsing operations in this system, which should not be confused:

| Layer     | Location                           | What's parsed                                         | Complexity                   |
| --------- | ---------------------------------- | ----------------------------------------------------- | ---------------------------- |
| Layer 1–2 | `webhook-logger/routes/webhook.ts` | Chatwork webhook event JSON → `ChatworkWebhookEvent`  | Simple `JSON.parse(rawBody)` |
| Layer 3   | `translation-prompt.ts`            | AI model text response → `{ sourceLang, translated }` | Complex (pre-refactor)       |

The refactor targets **Layer 3 only**. Layer 1–2 are correct and untouched.

---

## Solution

Replace `generateText()` + manual `parseAIResponse()` with `generateObject()` + Zod schema. The AI SDK uses the model's native JSON mode / function calling to guarantee output always conforms to the schema — no manual parsing required.

### Approach Chosen: `generateObject()` with Zod schema

Both Gemini (gemini-2.5-pro) and OpenAI (gpt-4o) support structured outputs via `generateObject()`. Google's AI SDK has `structuredOutputs: true` by default.

---

## Architecture

### Before

```
translator
  → generateText({ prompt: buildTranslationPrompt(text) })
  → result.text  ← raw string, unpredictable format
  → parseAIResponse(raw, text)  ← ~150 lines of fallback parsing
  → TranslationResult
```

### After

```
translator
  → generateObject({ schema: TranslationSchema, prompt: buildTranslationPrompt(text) })
  → result.object  ← { sourceLang: string, translated: string }, type-safe, guaranteed
  → TranslationResult
```

---

## Files Changed

| File                                                    | Change                                                                                                                        |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/services/translation-prompt.ts`      | Remove `parseAIResponse()` + all 8 helper functions. Add `TranslationSchema` Zod export. Simplify `buildTranslationPrompt()`. |
| `packages/core/src/services/gemini-translation.ts`      | `generateText()` → `generateObject()` with `TranslationSchema`.                                                               |
| `packages/core/src/services/openai-translation.ts`      | Same as Gemini service.                                                                                                       |
| `packages/core/src/services/translation-prompt.test.ts` | Remove `parseAIResponse` tests. Add `TranslationSchema` Zod tests. Update prompt tests.                                       |

**Unchanged**: `translation-factory.ts`, `mock-translation.ts`, interfaces, `index.ts`, translator handler, webhook-logger, all other packages.

---

## New `translation-prompt.ts`

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

**Deleted exports**: `parseAIResponse` (and all private helpers).

---

## New Service Pattern (both Gemini and OpenAI)

```ts
import { generateObject } from 'ai'
import { google } from '@ai-sdk/google' // or: import { openai } from '@ai-sdk/openai'
import type { ITranslationService, TranslationResult } from '../interfaces/translation'
import { TranslationError } from '../interfaces/translation'
import { TranslationSchema, buildTranslationPrompt } from './translation-prompt'

export class GeminiTranslationService implements ITranslationService {
  constructor(private readonly modelId: string = 'gemini-2.5-pro') {}

  async translate(text: string): Promise<TranslationResult> {
    let object: { sourceLang: string; translated: string }
    try {
      const result = await generateObject({
        model: google(this.modelId),
        schema: TranslationSchema,
        prompt: buildTranslationPrompt(text),
      })
      object = result.object
    } catch (cause) {
      throw new TranslationError(
        `Gemini API call failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        'API_ERROR',
        cause,
      )
    }
    return {
      originalText: text,
      translatedText: object.translated,
      sourceLang: object.sourceLang,
      targetLang: 'vi',
      timestamp: new Date().toISOString(),
    }
  }
}
```

`OpenAITranslationService` is identical, replacing `google(this.modelId)` → `openai(this.modelId)` and default model `'gemini-2.5-pro'` → `'gpt-4o'`.

---

## Dependency

Add `zod` to `packages/core` (currently in `packages/translator` only):

```bash
bun add zod --cwd packages/core
```

---

## Testing Strategy

### `translation-prompt.test.ts`

**Remove**: All `parseAIResponse` tests (valid JSON, whitespace handling, invalid JSON, missing fields).

**Update**: `buildTranslationPrompt` tests — remove assertions about JSON format instructions, add assertion that prompt does NOT contain JSON format instructions (they're no longer needed).

**Add**: `TranslationSchema` Zod validation tests:

```ts
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
})
```

### `gemini-translation.test.ts` + `openai-translation.test.ts`

Mock `generateObject` instead of `generateText`:

```ts
mock.module('ai', () => ({
  generateObject: mock(async (_opts: unknown) => ({
    object: { sourceLang: 'en', translated: 'Xin chào thế giới' },
  })),
}))
```

---

## Error Handling

`TranslationError` interface and all error codes (`API_ERROR`, `QUOTA_EXCEEDED`, `INVALID_RESPONSE`, `UNKNOWN`) are **unchanged**. The `try/catch` in each service wraps `generateObject()` failure into `API_ERROR`. `INVALID_RESPONSE` is retained for future use (e.g., if schema validation fails unexpectedly at runtime).

---

## Tradeoffs

| Aspect                 | Before                    | After                        |
| ---------------------- | ------------------------- | ---------------------------- |
| Code complexity        | ~150 lines parsing logic  | ~0 lines parsing             |
| Type safety            | Manual assertion cast     | Zod-enforced at call site    |
| AI provider dependency | Any model (text output)   | Model must support JSON mode |
| Reliability            | Fragile regex fallbacks   | AI SDK guaranteed structure  |
| Test coverage          | Complex parser edge cases | Simple schema validation     |

---

## Verification Commands

```bash
bun test packages/core/src/services/translation-prompt.test.ts
bun test packages/core/src/services/gemini-translation.test.ts
bun test packages/core/src/services/openai-translation.test.ts
bun test packages/core
bun run typecheck
```
