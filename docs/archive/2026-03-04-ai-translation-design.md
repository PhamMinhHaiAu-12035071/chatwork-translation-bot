# AI Translation Feature — Design Document

**Date**: 2026-03-04
**Status**: Approved
**Scope**: 🟡 Standard — 17 files/dirs

---

## Overview

Integrate AI translation (Gemini / OpenAI) into the Chatwork Translation Bot monorepo.
When `webhook-logger` receives a Chatwork webhook event, it forwards the message to the `translator` service, which detects the source language and translates the text to Vietnamese. The result is saved as a JSON file — no Chatwork reply in this phase.

---

## Goals

- Detect source language automatically (any language → Vietnamese)
- Provider-agnostic via Factory + SOLID DIP
- Human-readable Vietnamese prose output
- Output persisted as JSON file per message
- Configurable provider via `AI_PROVIDER` env var

---

## Architecture

```
Chatwork
  │
  ▼
webhook-logger:3001  (POST /webhook)
  ├─ verify HMAC signature
  ├─ log event to console
  └─ POST http://translator:3000/internal/translate
       body: { event: ChatworkWebhookEvent }

translator:3000  (POST /internal/translate)
  ├─ strip Chatwork markup from message body
  ├─ TranslationServiceFactory.create(env.AI_PROVIDER)
  │     'gemini' → GeminiTranslationService (gemini-2.5-pro)
  │     'openai' → OpenAITranslationService (gpt-4o)
  └─ write output/{YYYY-MM-DD}/{messageId}.json
```

**No Chatwork API reply in this phase.** Output is file-based only.

---

## Package Rename

`packages/bot` → `packages/translator`
`@chatwork-bot/bot` → `@chatwork-bot/translator`
Path alias: `@bot/*` → `@translator/*`

Rationale: Clean Code naming — the package's responsibility is translation, not generic "bot" behavior.

---

## Interface Changes

```ts
// packages/core/src/interfaces/translation.ts — REWRITE

export interface TranslationResult {
  originalText: string
  translatedText: string
  sourceLang: string // auto-detected by AI (ISO 639-1 code)
  targetLang: 'vi' // always Vietnamese
  timestamp: string // ISO 8601
}

export interface ITranslationService {
  translate(text: string): Promise<TranslationResult>
}

export class TranslationError extends Error {
  constructor(
    message: string,
    public readonly code: 'API_ERROR' | 'QUOTA_EXCEEDED' | 'INVALID_RESPONSE' | 'UNKNOWN',
    public override readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'TranslationError'
  }
}
```

`targetLang` removed from `translate()` signature — always Vietnamese, no need for caller to specify.

---

## Service Layer (packages/core)

### Factory Pattern

```ts
// packages/core/src/services/translation-factory.ts

export type AIProvider = 'gemini' | 'openai'

export class TranslationServiceFactory {
  static create(provider: AIProvider, modelOverride?: string): ITranslationService {
    switch (provider) {
      case 'gemini':
        return new GeminiTranslationService(modelOverride ?? 'gemini-2.5-pro')
      case 'openai':
        return new OpenAITranslationService(modelOverride ?? 'gpt-4o')
      default:
        throw new Error(`Unknown AI provider: ${String(provider)}`)
    }
  }
}
```

### GeminiTranslationService

```ts
// packages/core/src/services/gemini-translation.ts
import { generateText } from 'ai'
import { google } from '@ai-sdk/google'

export class GeminiTranslationService implements ITranslationService {
  constructor(private readonly modelId: string) {}

  async translate(text: string): Promise<TranslationResult> {
    const { text: raw } = await generateText({
      model: google(this.modelId),
      prompt: buildTranslationPrompt(text),
    })
    return parseAIResponse(raw, text)
  }
}
```

### OpenAITranslationService

```ts
// packages/core/src/services/openai-translation.ts
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'

export class OpenAITranslationService implements ITranslationService {
  constructor(private readonly modelId: string) {}

  async translate(text: string): Promise<TranslationResult> {
    const { text: raw } = await generateText({
      model: openai(this.modelId),
      prompt: buildTranslationPrompt(text),
    })
    return parseAIResponse(raw, text)
  }
}
```

### Shared Prompt + Parser

```ts
// Shared within services (internal helper)
function buildTranslationPrompt(text: string): string {
  return `You are a professional translator.
Detect the source language of the following text.
Translate it into natural, human-readable Vietnamese prose — write as flowing sentences, not word-by-word.
Respond with ONLY valid JSON: {"sourceLang": "<ISO 639-1 code>", "translated": "<Vietnamese text>"}
Do not include explanation, markdown, or extra text.

Text: ${text}`
}

function parseAIResponse(raw: string, originalText: string): TranslationResult {
  const parsed = JSON.parse(raw.trim()) as { sourceLang: string; translated: string }
  return {
    originalText,
    translatedText: parsed.translated,
    sourceLang: parsed.sourceLang,
    targetLang: 'vi',
    timestamp: new Date().toISOString(),
  }
}
```

---

## New Dependencies (packages/core)

```bash
bun add ai @ai-sdk/google @ai-sdk/openai
```

| Package          | Size    | Purpose            |
| ---------------- | ------- | ------------------ |
| `ai`             | 67.5 kB | Vercel AI SDK core |
| `@ai-sdk/google` | ~15 kB  | Gemini provider    |
| `@ai-sdk/openai` | ~15 kB  | OpenAI provider    |

---

## Translator Service (packages/translator)

### New env vars

```ts
// packages/translator/src/env.ts — additions
AI_PROVIDER: z.enum(['gemini', 'openai']),
AI_MODEL: z.string().optional(),          // overrides default model
GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
OPENAI_API_KEY: z.string().min(1).optional(),
```

Zod refinement: validate that the required API key is present for the chosen provider.

### Internal endpoint

```
POST /internal/translate
Body: { event: ChatworkWebhookEvent }
Response: 200 OK (immediate, async processing)
```

Handler flow:

1. Parse `ChatworkWebhookEvent` from body
2. Guard: if not a message event, return 200 immediately
3. Strip Chatwork markup from `webhook_event.body`
4. Skip if stripped text is empty
5. `TranslationServiceFactory.create(env.AI_PROVIDER, env.AI_MODEL)`
6. `service.translate(cleanText)`
7. Build output object + write to `output/{YYYY-MM-DD}/{roomId}-{messageId}.json`
8. Console log success. On error: console.error, silent fail.

---

## webhook-logger Changes

### New env var

```
TRANSLATOR_URL=http://localhost:3000  # URL of translator service
```

### Forward logic

After logging the event and returning 200 to Chatwork, fire-and-forget POST to translator:

```ts
// After: return new Response('OK', { status: 200 })
// Add fire-and-forget:
void fetch(`${env.TRANSLATOR_URL}/internal/translate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ event }),
}).catch((err) => console.error('[webhook] Failed to forward to translator:', err))
```

---

## Output File Format

```
output/
  2026-03-04/
    {roomId}-{messageId}.json
```

```json
{
  "originalText": "Hello, how are you today?",
  "translatedText": "Xin chào, hôm nay bạn có khỏe không?",
  "sourceLang": "en",
  "targetLang": "vi",
  "timestamp": "2026-03-04T10:30:00.000Z",
  "roomId": 123456789,
  "accountId": 987654321
}
```

`messageId` = `{timestamp_epoch}` derived from event or `Date.now()` if not available.

---

## Files Changed

| #   | File                                                | Change Type                        |
| --- | --------------------------------------------------- | ---------------------------------- |
| 1   | `packages/bot/`                                     | RENAME → `packages/translator/`    |
| 2   | `packages/translator/package.json`                  | Update name field                  |
| 3   | `tsconfig.base.json`                                | `@bot/*` → `@translator/*`         |
| 4   | Root `package.json`                                 | Update dev/build scripts           |
| 5   | `Dockerfile`                                        | Update 4 `packages/bot` references |
| 6   | `packages/core/src/interfaces/translation.ts`       | REWRITE                            |
| 7   | `packages/core/src/services/gemini-translation.ts`  | NEW                                |
| 8   | `packages/core/src/services/openai-translation.ts`  | NEW                                |
| 9   | `packages/core/src/services/translation-factory.ts` | NEW                                |
| 10  | `packages/core/src/index.ts`                        | Export new services                |
| 11  | `packages/translator/src/env.ts`                    | Add AI vars                        |
| 12  | `packages/translator/src/webhook/handler.ts`        | REWRITE                            |
| 13  | `packages/translator/src/webhook/router.ts`         | Add `/internal/translate`          |
| 14  | `packages/webhook-logger/src/routes/webhook.ts`     | Add forward logic                  |
| 15  | `packages/webhook-logger/src/env.ts`                | Add TRANSLATOR_URL                 |
| 16  | `.env.example`                                      | Document new vars                  |
| 17  | `.gitignore`                                        | Ignore `output/`                   |

---

## Default Models

| Provider | Default Model    | Rationale                                                    |
| -------- | ---------------- | ------------------------------------------------------------ |
| Gemini   | `gemini-2.5-pro` | Best accuracy, 2M context window, excels at nuanced language |
| OpenAI   | `gpt-4o`         | Flagship multimodal, strong translation quality              |

Both configurable via `AI_MODEL` env var.

---

## Error Handling

- **TranslationError**: log to console, silent fail (no Chatwork reply)
- **JSON parse failure** from AI: log malformed response, skip write
- **File write failure**: log error, do not retry
- **Forward HTTP failure** (webhook-logger → translator): log error, no retry

---

## Testing Notes

- `GeminiTranslationService` and `OpenAITranslationService` can be tested by injecting mock `generateText` via module mock
- `TranslationServiceFactory` unit test: verify correct class returned per provider
- Integration test: end-to-end with real API key in `.env.test`
- `MockTranslationService` in core retained for unit tests of handler logic
