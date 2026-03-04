# AI Translation Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate AI translation (Gemini 2.5 Pro / GPT-4o) into the monorepo — webhook-logger forwards events to the translator service, which detects source language, translates to Vietnamese, and saves JSON output files.

**Architecture:** Factory pattern + provider-specific service classes (GeminiTranslationService, OpenAITranslationService) both implementing ITranslationService. webhook-logger POSTs events to translator's `/internal/translate` endpoint. Output saved to `output/{date}/{roomId}-{messageId}.json`.

**Tech Stack:** Bun, TypeScript strict, Vercel AI SDK (`ai` + `@ai-sdk/google` + `@ai-sdk/openai`), Zod, Bun test runner.

---

## Pre-flight Checks

Before starting, confirm the repo is in a clean state:

```bash
cd /path/to/chatwork-translation-bot
bun test          # should pass
bun run typecheck # should pass
git status        # should be clean
```

---

## Task 1: Rename `packages/bot` → `packages/translator`

**Files:**

- Rename dir: `packages/bot/` → `packages/translator/`
- Modify: `packages/translator/package.json`
- Modify: `packages/translator/tsconfig.json`
- Modify: `tsconfig.base.json`
- Modify: `package.json` (root)
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`

> No TDD here — this is a rename-only task. Verification is `bun run typecheck`.

**Step 1: Rename the directory**

```bash
mv packages/bot packages/translator
```

**Step 2: Update `packages/translator/package.json`**

Change `"name"` field only:

```json
{
  "name": "@chatwork-bot/translator",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "dev": "bun --hot src/index.ts",
    "start": "bun src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@chatwork-bot/core": "workspace:*",
    "zod": "^3.23.0"
  }
}
```

**Step 3: Update `packages/translator/tsconfig.json`**

Change `@bot/*` → `@translator/*`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "paths": {
      "@core/*": ["../core/src/*"],
      "@translator/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Update `tsconfig.base.json`**

Change `@bot/*` → `@translator/*`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "paths": {
      "@core/*": ["./packages/core/src/*"],
      "@translator/*": ["./packages/translator/src/*"]
    }
  },
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Step 5: Update root `package.json` scripts**

Replace every `packages/bot` with `packages/translator` in the `"scripts"` block:

```json
"scripts": {
  "dev": "bun run --cwd packages/translator src/index.ts",
  "build": "bun build packages/translator/src/index.ts --outfile dist/server.js --target bun --minify",
  "logger": "bun run --hot packages/webhook-logger/src/index.ts",
  "tunnel:logger": "bunx localtunnel --port 3001 --subdomain chatwork-logger",
  "typecheck": "tsc --noEmit -p tsconfig.base.json && tsc --noEmit -p packages/core/tsconfig.json && tsc --noEmit -p packages/translator/tsconfig.json && tsc --noEmit -p packages/webhook-logger/tsconfig.json",
  "lint": "eslint packages/*/src/**/*.ts",
  "lint:fix": "eslint packages/*/src/**/*.ts --fix",
  "format": "prettier --write \"packages/*/src/**/*.ts\"",
  "test": "bun test",
  "prepare": "husky"
}
```

**Step 6: Update `Dockerfile`**

Replace all 4 occurrences of `packages/bot` with `packages/translator`:

```dockerfile
# Stage 1: Builder
FROM oven/bun:1.1-alpine AS builder

WORKDIR /app

# Copy workspace config files
COPY package.json bun.lockb* ./
COPY tsconfig.base.json ./

# Copy packages
COPY packages/core/package.json ./packages/core/
COPY packages/translator/package.json ./packages/translator/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source files
COPY packages/core/src ./packages/core/src
COPY packages/translator/src ./packages/translator/src

# Build the translator
RUN bun build packages/translator/src/index.ts \
    --outfile dist/server.js \
    --target bun \
    --minify

# Stage 2: Runtime (distroless)
FROM oven/bun:1.1-distroless AS runtime

WORKDIR /app

COPY --from=builder /app/dist/server.js ./server.js

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "run", "server.js"]
```

**Step 7: Update `docker-compose.yml`**

Rename service `bot` → `translator`:

```yaml
version: '3.9'

services:
  translator:
    build:
      context: .
      dockerfile: Dockerfile
    env_file:
      - .env
    ports:
      - '3000:3000'
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'wget', '--no-verbose', '--tries=1', '--spider', 'http://localhost:3000/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

**Step 8: Reinstall workspace dependencies**

```bash
bun install
```

Expected: lockfile regenerated, no errors.

**Step 9: Verify typecheck still passes**

```bash
bun run typecheck
```

Expected: no errors. If there are `@bot/*` path errors, grep for any missed references:

```bash
grep -r "@chatwork-bot/bot\|@bot/" packages/ --include="*.ts"
```

---

## Task 2: Install Vercel AI SDK in `packages/core`

**Files:**

- Modify: `packages/core/package.json`
- Modify: `bun.lock` (auto-generated)

> No TDD — dependency installation. Verify with `bun run typecheck`.

**Step 1: Install dependencies scoped to core**

```bash
bun add ai @ai-sdk/google @ai-sdk/openai --cwd packages/core
```

Expected output: packages added to `packages/core/package.json` dependencies, `bun.lock` updated.

**Step 2: Verify install**

```bash
bun run typecheck
```

Expected: no errors.

---

## Task 3: Rewrite `ITranslationService` interface

**Files:**

- Modify: `packages/core/src/interfaces/translation.ts`
- Modify: `packages/core/src/services/mock-translation.ts`

> Key change: `translate(text)` replaces `translate(targetLang, text)`. `targetLang` is always `'vi'`.

**Step 1: Write the new interface**

Replace the entire content of `packages/core/src/interfaces/translation.ts`:

```ts
export interface TranslationResult {
  originalText: string
  translatedText: string
  sourceLang: string // auto-detected by AI, ISO 639-1 code (e.g. 'en', 'ja')
  targetLang: 'vi' // always Vietnamese
  timestamp: string // ISO 8601 (e.g. '2026-03-04T10:30:00.000Z')
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

**Step 2: Update `MockTranslationService` to match new interface**

Replace `packages/core/src/services/mock-translation.ts`:

```ts
import type { ITranslationService, TranslationResult } from '../interfaces/translation'

export class MockTranslationService implements ITranslationService {
  async translate(text: string): Promise<TranslationResult> {
    await Promise.resolve()
    return {
      originalText: text,
      translatedText: `[Mock→vi] ${text}`,
      sourceLang: 'auto',
      targetLang: 'vi',
      timestamp: new Date().toISOString(),
    }
  }
}
```

**Step 3: Verify typecheck**

```bash
bun run typecheck
```

Expected: no errors. The old `UNSUPPORTED_LANGUAGE` error code is removed; all call sites that used it will now show type errors — fix them by removing `isSupported` calls (this method no longer exists).

---

## Task 4: Export `stripChatworkMarkup` from core

**Files:**

- Modify: `packages/core/src/utils/parse-command.ts`
- Modify: `packages/core/src/index.ts`

> `stripChatworkMarkup` was private — make it exported so the translator handler can use it.

**Step 1: Export the function from `parse-command.ts`**

Change `function stripChatworkMarkup` to `export function stripChatworkMarkup` in `packages/core/src/utils/parse-command.ts`:

```ts
import type { ParsedCommand } from '../types/command'
import { isSupportedLang } from '../types/command'

// Strip Chatwork markup tags: [To:xxx], [rp aid=xxx to=xxx:xxx], etc.
export function stripChatworkMarkup(text: string): string {
  return text
    .replace(/\[To:\d+\]/g, '')
    .replace(/\[rp aid=\d+ to=\d+:\d+\]/g, '')
    .replace(/\[quote\][\s\S]*?\[\/quote\]/g, '')
    .replace(/\[info\][\s\S]*?\[\/info\]/g, '')
    .replace(/\[title\][\s\S]*?\[\/title\]/g, '')
    .replace(/\[code\][\s\S]*?\[\/code\]/g, '')
    .trim()
}

// Parse /translate [lang] [text] command
export function parseCommand(rawBody: string): ParsedCommand | null {
  const cleaned = stripChatworkMarkup(rawBody)

  // Match /translate <lang> <text>
  const match = /^\/translate\s+(\S+)\s+([\s\S]+)$/i.exec(cleaned)
  if (!match) return null

  const [, langRaw, text] = match

  if (!langRaw || !text) return null

  const lang = langRaw.toLowerCase()
  if (!isSupportedLang(lang)) return null

  return {
    targetLang: lang,
    text: text.trim(),
  }
}
```

**Step 2: Export from `packages/core/src/index.ts`**

Add `stripChatworkMarkup` to the utils export block:

```ts
// Utils
export { parseCommand, stripChatworkMarkup } from './utils/parse-command'
```

**Step 3: Verify existing parse-command tests still pass**

```bash
bun test packages/core/src/utils/parse-command.test.ts
```

Expected: all 11 tests PASS (no changes to behavior).

---

## Task 5: Create shared AI prompt helpers

**Files:**

- Create: `packages/core/src/services/translation-prompt.ts`

> `buildTranslationPrompt` and `parseAIResponse` are shared between Gemini and OpenAI services. Extracting them avoids duplication.

**Step 1: Write the failing test**

Create `packages/core/src/services/translation-prompt.test.ts`:

```ts
import { describe, expect, it } from 'bun:test'
import { buildTranslationPrompt, parseAIResponse } from './translation-prompt'

describe('buildTranslationPrompt', () => {
  it('includes the original text in the prompt', () => {
    const prompt = buildTranslationPrompt('Hello World')
    expect(prompt).toContain('Hello World')
  })

  it('mentions Vietnamese in the prompt', () => {
    const prompt = buildTranslationPrompt('any text')
    expect(prompt.toLowerCase()).toContain('vietnamese')
  })

  it('requests JSON output format', () => {
    const prompt = buildTranslationPrompt('text')
    expect(prompt).toContain('sourceLang')
    expect(prompt).toContain('translated')
  })
})

describe('parseAIResponse', () => {
  it('parses valid JSON response', () => {
    const raw = '{"sourceLang":"en","translated":"Xin chào thế giới"}'
    const result = parseAIResponse(raw, 'Hello World')
    expect(result.originalText).toBe('Hello World')
    expect(result.translatedText).toBe('Xin chào thế giới')
    expect(result.sourceLang).toBe('en')
    expect(result.targetLang).toBe('vi')
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('parses JSON with surrounding whitespace', () => {
    const raw = '  \n{"sourceLang":"ja","translated":"こんにちは"}\n  '
    const result = parseAIResponse(raw, 'こんにちは')
    expect(result.sourceLang).toBe('ja')
    expect(result.translatedText).toBe('こんにちは')
  })

  it('throws TranslationError on invalid JSON', () => {
    expect(() => parseAIResponse('not json', 'text')).toThrow()
  })

  it('throws TranslationError on missing fields', () => {
    const raw = '{"sourceLang":"en"}'
    expect(() => parseAIResponse(raw, 'text')).toThrow()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test packages/core/src/services/translation-prompt.test.ts
```

Expected: FAIL — `Cannot find module './translation-prompt'`

**Step 3: Create the implementation**

Create `packages/core/src/services/translation-prompt.ts`:

```ts
import { TranslationError } from '../interfaces/translation'
import type { TranslationResult } from '../interfaces/translation'

export function buildTranslationPrompt(text: string): string {
  return `You are a professional translator.
Detect the source language of the following text.
Translate it into natural, human-readable Vietnamese prose — write as flowing sentences, not word-by-word.
Preserve the original meaning, tone, and nuance.
Respond with ONLY valid JSON in this exact format: {"sourceLang": "<ISO 639-1 code>", "translated": "<Vietnamese text>"}
Do not include explanation, markdown code blocks, or any text outside the JSON object.

Text: ${text}`
}

export function parseAIResponse(raw: string, originalText: string): TranslationResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.trim())
  } catch (cause) {
    throw new TranslationError(
      `AI returned malformed JSON: ${raw.slice(0, 100)}`,
      'INVALID_RESPONSE',
      cause,
    )
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>)['sourceLang'] !== 'string' ||
    typeof (parsed as Record<string, unknown>)['translated'] !== 'string'
  ) {
    throw new TranslationError(
      'AI response missing required fields: sourceLang, translated',
      'INVALID_RESPONSE',
    )
  }

  const { sourceLang, translated } = parsed as { sourceLang: string; translated: string }

  return {
    originalText,
    translatedText: translated,
    sourceLang,
    targetLang: 'vi',
    timestamp: new Date().toISOString(),
  }
}
```

**Step 4: Run test to verify it passes**

```bash
bun test packages/core/src/services/translation-prompt.test.ts
```

Expected: all 6 tests PASS.

---

## Task 6: Create `GeminiTranslationService`

**Files:**

- Create: `packages/core/src/services/gemini-translation.ts`
- Create: `packages/core/src/services/gemini-translation.test.ts`

> Uses Vercel AI SDK `generateText` with `@ai-sdk/google`. Tests use Bun module mocking.

**Step 1: Write the failing test**

Create `packages/core/src/services/gemini-translation.test.ts`:

```ts
import { beforeAll, describe, expect, it, mock } from 'bun:test'

// Mock BEFORE importing the module under test
mock.module('ai', () => ({
  generateText: mock(async (_opts: unknown) => ({
    text: '{"sourceLang":"en","translated":"Xin chào thế giới"}',
  })),
}))

mock.module('@ai-sdk/google', () => ({
  google: mock((_modelId: string) => ({ provider: 'google', modelId: _modelId })),
}))

describe('GeminiTranslationService', () => {
  let GeminiTranslationService: typeof import('./gemini-translation').GeminiTranslationService

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

**Step 2: Run test to verify it fails**

```bash
bun test packages/core/src/services/gemini-translation.test.ts
```

Expected: FAIL — `Cannot find module './gemini-translation'`

**Step 3: Create the implementation**

Create `packages/core/src/services/gemini-translation.ts`:

```ts
import { generateText } from 'ai'
import { google } from '@ai-sdk/google'
import type { ITranslationService, TranslationResult } from '../interfaces/translation'
import { TranslationError } from '../interfaces/translation'
import { buildTranslationPrompt, parseAIResponse } from './translation-prompt'

export class GeminiTranslationService implements ITranslationService {
  constructor(private readonly modelId: string = 'gemini-2.5-pro') {}

  async translate(text: string): Promise<TranslationResult> {
    let raw: string
    try {
      const result = await generateText({
        model: google(this.modelId),
        prompt: buildTranslationPrompt(text),
      })
      raw = result.text
    } catch (cause) {
      throw new TranslationError(
        `Gemini API call failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        'API_ERROR',
        cause,
      )
    }

    return parseAIResponse(raw, text)
  }
}
```

**Step 4: Run test to verify it passes**

```bash
bun test packages/core/src/services/gemini-translation.test.ts
```

Expected: all 3 tests PASS.

---

## Task 7: Create `OpenAITranslationService`

**Files:**

- Create: `packages/core/src/services/openai-translation.ts`
- Create: `packages/core/src/services/openai-translation.test.ts`

**Step 1: Write the failing test**

Create `packages/core/src/services/openai-translation.test.ts`:

```ts
import { beforeAll, describe, expect, it, mock } from 'bun:test'

mock.module('ai', () => ({
  generateText: mock(async (_opts: unknown) => ({
    text: '{"sourceLang":"ja","translated":"おはようございます、世界！"}',
  })),
}))

mock.module('@ai-sdk/openai', () => ({
  openai: mock((_modelId: string) => ({ provider: 'openai', modelId: _modelId })),
}))

describe('OpenAITranslationService', () => {
  let OpenAITranslationService: typeof import('./openai-translation').OpenAITranslationService

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

**Step 2: Run test to verify it fails**

```bash
bun test packages/core/src/services/openai-translation.test.ts
```

Expected: FAIL — `Cannot find module './openai-translation'`

**Step 3: Create the implementation**

Create `packages/core/src/services/openai-translation.ts`:

```ts
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import type { ITranslationService, TranslationResult } from '../interfaces/translation'
import { TranslationError } from '../interfaces/translation'
import { buildTranslationPrompt, parseAIResponse } from './translation-prompt'

export class OpenAITranslationService implements ITranslationService {
  constructor(private readonly modelId: string = 'gpt-4o') {}

  async translate(text: string): Promise<TranslationResult> {
    let raw: string
    try {
      const result = await generateText({
        model: openai(this.modelId),
        prompt: buildTranslationPrompt(text),
      })
      raw = result.text
    } catch (cause) {
      throw new TranslationError(
        `OpenAI API call failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        'API_ERROR',
        cause,
      )
    }

    return parseAIResponse(raw, text)
  }
}
```

**Step 4: Run test to verify it passes**

```bash
bun test packages/core/src/services/openai-translation.test.ts
```

Expected: all 3 tests PASS.

---

## Task 8: Create `TranslationServiceFactory`

**Files:**

- Create: `packages/core/src/services/translation-factory.ts`
- Create: `packages/core/src/services/translation-factory.test.ts`

**Step 1: Write the failing test**

Create `packages/core/src/services/translation-factory.test.ts`:

```ts
import { describe, expect, it } from 'bun:test'
import { TranslationServiceFactory } from './translation-factory'
import { GeminiTranslationService } from './gemini-translation'
import { OpenAITranslationService } from './openai-translation'

describe('TranslationServiceFactory', () => {
  it('creates GeminiTranslationService for gemini provider', () => {
    const service = TranslationServiceFactory.create('gemini')
    expect(service).toBeInstanceOf(GeminiTranslationService)
  })

  it('creates OpenAITranslationService for openai provider', () => {
    const service = TranslationServiceFactory.create('openai')
    expect(service).toBeInstanceOf(OpenAITranslationService)
  })

  it('passes modelOverride to GeminiTranslationService', () => {
    const service = TranslationServiceFactory.create('gemini', 'gemini-2.0-flash')
    // Verify via type — internal modelId is private, but instance is correct type
    expect(service).toBeInstanceOf(GeminiTranslationService)
  })

  it('passes modelOverride to OpenAITranslationService', () => {
    const service = TranslationServiceFactory.create('openai', 'gpt-4o-mini')
    expect(service).toBeInstanceOf(OpenAITranslationService)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test packages/core/src/services/translation-factory.test.ts
```

Expected: FAIL — `Cannot find module './translation-factory'`

**Step 3: Create the implementation**

Create `packages/core/src/services/translation-factory.ts`:

```ts
import type { ITranslationService } from '../interfaces/translation'
import { GeminiTranslationService } from './gemini-translation'
import { OpenAITranslationService } from './openai-translation'

export type AIProvider = 'gemini' | 'openai'

export class TranslationServiceFactory {
  static create(provider: AIProvider, modelOverride?: string): ITranslationService {
    if (provider === 'gemini') {
      return new GeminiTranslationService(modelOverride ?? 'gemini-2.5-pro')
    }
    return new OpenAITranslationService(modelOverride ?? 'gpt-4o')
  }
}
```

**Step 4: Run test to verify it passes**

```bash
bun test packages/core/src/services/translation-factory.test.ts
```

Expected: all 4 tests PASS.

---

## Task 9: Update `packages/core/src/index.ts` exports

**Files:**

- Modify: `packages/core/src/index.ts`

**Step 1: Update the exports**

Replace the entire `packages/core/src/index.ts`:

```ts
// Types
export type {
  ChatworkWebhookEvent,
  ChatworkMessageEvent,
  ChatworkAccount,
  ChatworkRoom,
  ChatworkRoomDetail,
  ChatworkSendMessageResponse,
} from './types/chatwork'
export { isChatworkMessageEvent } from './types/chatwork'

export type { ParsedCommand, SupportedLang } from './types/command'
export { SUPPORTED_LANGUAGES, isSupportedLang } from './types/command'

// Interfaces
export type { ITranslationService, TranslationResult } from './interfaces/translation'
export { TranslationError } from './interfaces/translation'

// Services
export { MockTranslationService } from './services/mock-translation'
export { GeminiTranslationService } from './services/gemini-translation'
export { OpenAITranslationService } from './services/openai-translation'
export { TranslationServiceFactory } from './services/translation-factory'
export type { AIProvider } from './services/translation-factory'

// Chatwork client
export { ChatworkClient } from './chatwork/client'
export type { ChatworkClientConfig, SendMessageParams } from './chatwork/client'

// Webhook utilities
export { verifyWebhookSignature } from './webhook/verify'

// Utils
export { parseCommand, stripChatworkMarkup } from './utils/parse-command'
```

**Step 2: Run all core tests**

```bash
bun test packages/core
```

Expected: all tests PASS.

**Step 3: Run typecheck**

```bash
bun run typecheck
```

Expected: no errors.

---

## Task 10: Update `packages/translator/src/env.ts`

**Files:**

- Modify: `packages/translator/src/env.ts`

> Add `AI_PROVIDER`, `AI_MODEL`, `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENAI_API_KEY` with cross-field validation.

**Step 1: Rewrite the env schema**

Replace entire `packages/translator/src/env.ts`:

```ts
import { z } from 'zod'

const base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

const webhookSecretSchema = z
  .string()
  .trim()
  .min(1, 'CHATWORK_WEBHOOK_SECRET is required')
  .superRefine((value, ctx) => {
    if (!base64Pattern.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'CHATWORK_WEBHOOK_SECRET must be a valid Base64 webhook token from Chatwork Webhook settings',
      })
      return
    }

    try {
      const decoded = atob(value)
      if (decoded.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CHATWORK_WEBHOOK_SECRET cannot decode to an empty value',
        })
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CHATWORK_WEBHOOK_SECRET is not decodable Base64',
      })
    }
  })

const envSchema = z
  .object({
    CHATWORK_API_TOKEN: z.string().min(1, 'CHATWORK_API_TOKEN is required'),
    CHATWORK_WEBHOOK_SECRET: webhookSecretSchema,
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    AI_PROVIDER: z.enum(['gemini', 'openai']),
    AI_MODEL: z.string().min(1).optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
    OPENAI_API_KEY: z.string().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.AI_PROVIDER === 'gemini' && !data.GOOGLE_GENERATIVE_AI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'GOOGLE_GENERATIVE_AI_API_KEY is required when AI_PROVIDER=gemini',
        path: ['GOOGLE_GENERATIVE_AI_API_KEY'],
      })
    }
    if (data.AI_PROVIDER === 'openai' && !data.OPENAI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'OPENAI_API_KEY is required when AI_PROVIDER=openai',
        path: ['OPENAI_API_KEY'],
      })
    }
  })

function validateEnv() {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error('[env] Invalid environment variables:')
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`)
    }
    process.exit(1)
  }

  return result.data
}

export const env = validateEnv()

export type Env = z.infer<typeof envSchema>
```

**Step 2: Run typecheck**

```bash
bun run typecheck
```

Expected: no errors.

---

## Task 11: Create output writer utility

**Files:**

- Create: `packages/translator/src/utils/output-writer.ts`
- Create: `packages/translator/src/utils/output-writer.test.ts`

**Step 1: Write the failing test**

Create `packages/translator/src/utils/output-writer.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { writeTranslationOutput } from './output-writer'
import type { OutputRecord } from './output-writer'

const TEST_OUTPUT_DIR = join(process.cwd(), 'output-test')

const sampleRecord: OutputRecord = {
  originalText: 'Hello World',
  translatedText: 'Xin chào Thế giới',
  sourceLang: 'en',
  targetLang: 'vi',
  timestamp: '2026-03-04T10:30:00.000Z',
  roomId: 123456789,
  accountId: 987654321,
  messageId: 'msg001',
}

afterEach(async () => {
  await rm(TEST_OUTPUT_DIR, { recursive: true, force: true })
})

describe('writeTranslationOutput', () => {
  it('creates the output file at the correct path', async () => {
    await writeTranslationOutput(sampleRecord, TEST_OUTPUT_DIR)

    const file = Bun.file(join(TEST_OUTPUT_DIR, '2026-03-04', '123456789-msg001.json'))
    expect(await file.exists()).toBe(true)
  })

  it('writes correct JSON content', async () => {
    await writeTranslationOutput(sampleRecord, TEST_OUTPUT_DIR)

    const file = Bun.file(join(TEST_OUTPUT_DIR, '2026-03-04', '123456789-msg001.json'))
    const content = (await file.json()) as OutputRecord
    expect(content.originalText).toBe('Hello World')
    expect(content.translatedText).toBe('Xin chào Thế giới')
    expect(content.sourceLang).toBe('en')
    expect(content.targetLang).toBe('vi')
    expect(content.roomId).toBe(123456789)
    expect(content.messageId).toBe('msg001')
  })

  it('creates parent directories automatically', async () => {
    const record = { ...sampleRecord, timestamp: '2026-12-31T23:59:59.000Z', messageId: 'msg999' }
    await writeTranslationOutput(record, TEST_OUTPUT_DIR)

    const file = Bun.file(join(TEST_OUTPUT_DIR, '2026-12-31', '123456789-msg999.json'))
    expect(await file.exists()).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test packages/translator/src/utils/output-writer.test.ts
```

Expected: FAIL — `Cannot find module './output-writer'`

**Step 3: Create the implementation**

Create `packages/translator/src/utils/output-writer.ts`:

```ts
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export interface OutputRecord {
  originalText: string
  translatedText: string
  sourceLang: string
  targetLang: 'vi'
  timestamp: string // ISO 8601
  roomId: number
  accountId: number
  messageId: string
}

/**
 * Writes a translation result to output/{dateStr}/{roomId}-{messageId}.json.
 * @param record - The translation data to persist.
 * @param baseDir - Output base directory (defaults to `output/` in cwd). Overridable for tests.
 */
export async function writeTranslationOutput(
  record: OutputRecord,
  baseDir: string = join(process.cwd(), 'output'),
): Promise<void> {
  const dateStr = record.timestamp.slice(0, 10) // YYYY-MM-DD
  const dir = join(baseDir, dateStr)

  await mkdir(dir, { recursive: true })

  const filename = `${record.roomId}-${record.messageId}.json`
  const filepath = join(dir, filename)

  await Bun.write(filepath, JSON.stringify(record, null, 2))
  console.log(`[output] Saved: ${filepath}`)
}
```

**Step 4: Run test to verify it passes**

```bash
bun test packages/translator/src/utils/output-writer.test.ts
```

Expected: all 3 tests PASS.

---

## Task 12: Rewrite `packages/translator/src/webhook/handler.ts`

**Files:**

- Modify: `packages/translator/src/webhook/handler.ts`

> Old handler used `MockTranslationService` + `parseCommand` + Chatwork reply.
> New handler: strip markup → AI translate → write output file. No Chatwork reply.

**Step 1: Replace the entire handler**

```ts
import {
  isChatworkMessageEvent,
  stripChatworkMarkup,
  TranslationServiceFactory,
  TranslationError,
} from '@chatwork-bot/core'
import type { ChatworkWebhookEvent } from '@chatwork-bot/core'
import { env } from '../env'
import { writeTranslationOutput } from '../utils/output-writer'

export async function handleTranslateRequest(event: ChatworkWebhookEvent): Promise<void> {
  if (!isChatworkMessageEvent(event)) {
    console.log('[handler] Skipping non-message event:', event.webhook_event_type)
    return
  }

  const {
    room_id: roomId,
    account_id: accountId,
    body,
    message_id: messageId,
  } = event.webhook_event

  const cleanText = stripChatworkMarkup(body)
  if (!cleanText) {
    console.log('[handler] Skipping empty message after markup strip')
    return
  }

  try {
    const service = TranslationServiceFactory.create(env.AI_PROVIDER, env.AI_MODEL)
    const result = await service.translate(cleanText)

    await writeTranslationOutput({
      originalText: result.originalText,
      translatedText: result.translatedText,
      sourceLang: result.sourceLang,
      targetLang: result.targetLang,
      timestamp: result.timestamp,
      roomId,
      accountId,
      messageId,
    })

    console.log(
      `[handler] Translated: ${result.sourceLang} → vi | room:${roomId} | msg:${messageId}`,
    )
  } catch (error) {
    if (error instanceof TranslationError) {
      console.error(`[handler] TranslationError [${error.code}]: ${error.message}`)
      return
    }
    console.error('[handler] Unexpected error:', error)
  }
}
```

**Step 2: Run typecheck**

```bash
bun run typecheck
```

Expected: no errors.

---

## Task 13: Update `packages/translator/src/webhook/router.ts`

**Files:**

- Modify: `packages/translator/src/webhook/router.ts`

> Remove old `/webhook` Chatwork endpoint. Add `/internal/translate` endpoint.
> The translator no longer directly receives webhooks from Chatwork.

**Step 1: Replace entire router**

```ts
import type { ChatworkWebhookEvent } from '@chatwork-bot/core'
import { handleTranslateRequest } from './handler'

export async function router(request: Request): Promise<Response> {
  const url = new URL(request.url)

  if (request.method === 'GET' && url.pathname === '/health') {
    return Response.json({ status: 'ok', timestamp: new Date().toISOString() })
  }

  if (request.method === 'POST' && url.pathname === '/internal/translate') {
    return handleInternalTranslate(request)
  }

  return new Response('Not Found', { status: 404 })
}

async function handleInternalTranslate(request: Request): Promise<Response> {
  let event: ChatworkWebhookEvent
  try {
    const body = (await request.json()) as { event: ChatworkWebhookEvent }
    event = body.event
  } catch {
    return new Response('Bad Request: Invalid JSON', { status: 400 })
  }

  // Return 200 immediately, process async (fire-and-forget)
  void handleTranslateRequest(event).catch((error: unknown) => {
    console.error('[router] Background handler error:', error)
  })

  return new Response('OK', { status: 200 })
}
```

**Step 2: Update `packages/translator/src/index.ts`**

Update startup logs to reflect new package identity:

```ts
import { env } from './env'
import { createServer } from './server'

const server = createServer()

console.log(`[translator] AI Translation Service started on port ${env.PORT}`)
console.log(`[translator] Provider: ${env.AI_PROVIDER}`)
console.log(`[translator] Environment: ${env.NODE_ENV}`)
console.log(`[translator] Health check: http://localhost:${env.PORT}/health`)
console.log(`[translator] Internal endpoint: http://localhost:${env.PORT}/internal/translate`)

function shutdown() {
  console.log('\n[translator] Shutting down gracefully...')
  server.stop()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
```

**Step 3: Run typecheck**

```bash
bun run typecheck
```

Expected: no errors.

---

## Task 14: Update `webhook-logger` to forward events

**Files:**

- Modify: `packages/webhook-logger/src/env.ts`
- Modify: `packages/webhook-logger/src/routes/webhook.ts`

**Step 1: Add `TRANSLATOR_URL` to webhook-logger env**

Add to `packages/webhook-logger/src/env.ts` schema:

```ts
import { z } from 'zod'

const base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

const webhookSecretSchema = z
  .string()
  .trim()
  .min(1, 'CHATWORK_WEBHOOK_SECRET is required')
  .superRefine((value, ctx) => {
    if (!base64Pattern.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'CHATWORK_WEBHOOK_SECRET must be a valid Base64 webhook token from Chatwork Webhook settings',
      })
      return
    }

    try {
      const decoded = atob(value)
      if (decoded.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CHATWORK_WEBHOOK_SECRET cannot decode to an empty value',
        })
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CHATWORK_WEBHOOK_SECRET is not decodable Base64',
      })
    }
  })

const envSchema = z.object({
  CHATWORK_WEBHOOK_SECRET: webhookSecretSchema,
  LOGGER_PORT: z.coerce.number().int().positive().default(3001),
  TRANSLATOR_URL: z
    .string()
    .url('TRANSLATOR_URL must be a valid URL')
    .default('http://localhost:3000'),
})

function validateEnv() {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error('[env] Invalid environment variables:')
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`)
    }
    process.exit(1)
  }

  return result.data
}

export const env = validateEnv()

export type Env = z.infer<typeof envSchema>
```

**Step 2: Add forward logic to `webhook.ts`**

Replace the `return new Response('OK', { status: 200 })` section in `packages/webhook-logger/src/routes/webhook.ts` to forward the event after returning 200:

```ts
import { verifyWebhookSignature } from '@chatwork-bot/core'
import type { ChatworkWebhookEvent } from '@chatwork-bot/core'
import { env } from '../env'

export async function handleWebhookRoute(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const rawBody = await request.text()
  const headerSignature = request.headers.get('x-chatworkwebhooksignature')
  const querySignature = url.searchParams.get('chatwork_webhook_signature')
  const signature = headerSignature ?? querySignature

  if (!signature) {
    console.log('[webhook] Rejected: missing signature in header/query')
    return new Response('Unauthorized', { status: 401 })
  }

  const isValid = await verifyWebhookSignature(rawBody, signature, env.CHATWORK_WEBHOOK_SECRET)
  if (!isValid) {
    const signatureSource = headerSignature ? 'header' : 'query'
    const userAgent = request.headers.get('user-agent') ?? 'unknown'
    console.log(
      `[webhook] Rejected: invalid signature (source=${signatureSource}, body_chars=${rawBody.length.toString()}, signature_chars=${signature.length.toString()}, user_agent=${userAgent})`,
    )
    return new Response('Unauthorized', { status: 401 })
  }

  let event: ChatworkWebhookEvent
  try {
    event = JSON.parse(rawBody) as ChatworkWebhookEvent
  } catch {
    console.log('[webhook] Rejected: invalid JSON')
    return new Response('Bad Request: Invalid JSON', { status: 400 })
  }

  console.log('\n------- WEBHOOK EVENT -------')
  console.log('Timestamp:', new Date().toISOString())
  console.log('Headers:', Object.fromEntries(request.headers))
  console.dir(event, { depth: null, colors: true })
  console.log('-----------------------------\n')

  // Forward to translator service (fire-and-forget)
  void fetch(`${env.TRANSLATOR_URL}/internal/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event }),
  }).catch((err: unknown) => {
    console.error('[webhook] Failed to forward to translator:', err)
  })

  return new Response('OK', { status: 200 })
}
```

**Step 3: Run typecheck**

```bash
bun run typecheck
```

Expected: no errors.

---

## Task 15: Update `.env.example` and `.gitignore`

**Step 1: Update `.env.example`**

Replace the entire file:

```env
# Chatwork API Configuration
CHATWORK_API_TOKEN=your_chatwork_api_token_here
CHATWORK_WEBHOOK_SECRET=replace_with_chatwork_webhook_token_from_webhook_settings

# Translator Service Configuration
PORT=3000
NODE_ENV=development

# AI Provider Configuration
# Choose: gemini | openai
AI_PROVIDER=gemini

# Optional: override default model (gemini-2.5-pro for gemini, gpt-4o for openai)
# AI_MODEL=gemini-2.5-pro

# Gemini API Key (required when AI_PROVIDER=gemini)
GOOGLE_GENERATIVE_AI_API_KEY=your_google_generative_ai_api_key_here

# OpenAI API Key (required when AI_PROVIDER=openai)
# OPENAI_API_KEY=your_openai_api_key_here

# Webhook Logger Configuration
LOGGER_PORT=3001

# Translator service URL (used by webhook-logger to forward events)
TRANSLATOR_URL=http://localhost:3000
```

**Step 2: Update `.gitignore`**

Add `output/` directory to `.gitignore`:

```
# Dependencies
node_modules/
.yarn/

# Build output
dist/

# Environment files
.env
.env.local
.env.*.local

# Logs
*.log
npm-debug.log*
bun-error.log

# OS files
.DS_Store
Thumbs.db

# Editor
.vscode/settings.json
.idea/

# Bun
bun.lockb

# Translation output files
output/
```

**Step 3: Create `output/.gitkeep`**

```bash
mkdir -p output && touch output/.gitkeep
```

---

## Task 16: Final Verification

**Step 1: Run all tests**

```bash
bun test
```

Expected: all tests PASS. No failures.

**Step 2: Run typecheck**

```bash
bun run typecheck
```

Expected: 0 errors.

**Step 3: Run lint**

```bash
bun run lint
```

Expected: 0 errors. If warnings appear, fix with:

```bash
bun run lint:fix
```

**Step 4: Verify startup works (dry run)**

Set environment variables and start translator:

```bash
# Create a .env with real or test values
AI_PROVIDER=gemini GOOGLE_GENERATIVE_AI_API_KEY=test PORT=3000 \
  CHATWORK_API_TOKEN=test CHATWORK_WEBHOOK_SECRET=dGVzdA== \
  bun run packages/translator/src/index.ts 2>&1 | head -10
```

Expected output (will fail env validation unless keys are valid, but startup log should appear):

```
[translator] AI Translation Service started on port 3000
[translator] Provider: gemini
[translator] Environment: development
```

**Step 5: Verify health endpoint**

```bash
curl -s http://localhost:3000/health | bun run -e "process.stdin.pipe(process.stdout)"
```

Expected: `{"status":"ok","timestamp":"..."}`

**Step 6: Verify internal translate endpoint accepts events**

```bash
curl -s -X POST http://localhost:3000/internal/translate \
  -H "Content-Type: application/json" \
  -d '{"event":{"webhook_setting_id":"1","webhook_event_type":"message_created","webhook_event_time":1709550000,"webhook_event":{"message_id":"123","room_id":456,"account_id":789,"body":"Hello World","send_time":1709550000,"update_time":0}}}'
```

Expected: `OK` (200) response. Check console for `[handler]` logs and `output/` for JSON file.

---

## Summary: New Files Created

| File                                                | Purpose                                        |
| --------------------------------------------------- | ---------------------------------------------- |
| `packages/core/src/services/translation-prompt.ts`  | Shared prompt builder + AI response parser     |
| `packages/core/src/services/gemini-translation.ts`  | Gemini provider service                        |
| `packages/core/src/services/openai-translation.ts`  | OpenAI provider service                        |
| `packages/core/src/services/translation-factory.ts` | Factory to create services                     |
| `packages/translator/src/utils/output-writer.ts`    | Write translation JSON to output/              |
| `output/.gitkeep`                                   | Placeholder so output/ directory exists in git |

## Summary: Key Env Vars Added

| Variable                       | Package        | Required                              |
| ------------------------------ | -------------- | ------------------------------------- |
| `AI_PROVIDER`                  | translator     | Yes (`gemini` or `openai`)            |
| `AI_MODEL`                     | translator     | No (defaults per provider)            |
| `GOOGLE_GENERATIVE_AI_API_KEY` | translator     | Yes if `AI_PROVIDER=gemini`           |
| `OPENAI_API_KEY`               | translator     | Yes if `AI_PROVIDER=openai`           |
| `TRANSLATOR_URL`               | webhook-logger | No (default: `http://localhost:3000`) |
