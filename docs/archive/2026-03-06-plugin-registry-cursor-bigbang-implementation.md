# Plugin Registry Cursor Big-Bang Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor translation provider architecture from switch-based factory to plugin registry with dedicated provider packages, add Cursor provider, enforce strict provider-model env validation, and harden runtime/security/ops behavior for production readiness.

**Architecture:** Replace provider selection in `@chatwork-bot/core` with an explicit plugin registry + manifest contract. Move provider implementations into dedicated monorepo packages (`@chatwork-bot/provider-*`) and bootstrap them from composition-root wiring in `packages/translator`. Enforce discriminated union env validation and deterministic startup/runtime behavior (fail-fast, timeout+retry, no fallback).

**Tech Stack:** Bun workspaces, TypeScript strict mode, Elysia, Zod v4, Vercel AI SDK (`ai`, `@ai-sdk/google`, `@ai-sdk/openai`, `@ai-sdk/openai-compatible`), `p-retry`, Bun test runner.

**Key decisions locked:**

- `@chatwork-bot/translation-prompt` — new package at `packages/translation-prompt/` for `TranslationSchema` + `buildTranslationPrompt`
- Env validation uses `z.discriminatedUnion()` (Zod v4 native API — no `.superRefine()`)
- Retry via `p-retry` package (retries: 2, minTimeout: 300ms, factor: 2)
- Shared-secret comparison via `crypto.timingSafeEqual`
- `CURSOR_MODEL_VALUES` hardcoded + open-ended escape hatch (`z.enum(...).or(z.string().min(1))`)
- `cursor-api-proxy` pinned exact version, LOCAL DEV ONLY, documented risk
- Cursor proxy started manually before `bun run dev`; startup guard prints actionable error if not reachable
- Existing test files moved + adapted to provider packages (not duplicated)
- Each new package copies tsconfig pattern from `packages/core/tsconfig.json`
- `DEFAULT_CURSOR_MODEL = 'claude-sonnet-4-5'`

---

## Preconditions

- Work from a clean feature branch: `git checkout -b feat/plugin-registry-cursor`
- Keep runtime command unchanged: `bun run dev`
- Keep `/internal/translate` behavior fire-and-forget after auth passes
- Breaking internal architecture changes are allowed

---

## Task 1: Create Provider Plugin Contracts in Core

**Files:**

- Create: `packages/core/src/interfaces/provider-plugin.ts`
- Create: `packages/core/src/interfaces/provider-plugin.test.ts`
- Modify: `packages/core/src/index.ts`

### Step 1: Write the failing test

```typescript
// packages/core/src/interfaces/provider-plugin.test.ts
import { describe, expect, it } from 'bun:test'
import type { ProviderPlugin, ProviderManifest, ProviderCreateContext } from './provider-plugin'
import type { ITranslationService, TranslationResult } from './translation'

describe('ProviderPlugin contract', () => {
  it('accepts a conforming plugin object', () => {
    const manifest: ProviderManifest = {
      id: 'test-provider',
      supportedModels: ['model-a', 'model-b'] as const,
      defaultModel: 'model-a',
      capabilities: { streaming: false },
    }

    const plugin: ProviderPlugin = {
      manifest,
      create(_ctx: ProviderCreateContext): ITranslationService {
        return {
          translate(_text: string): Promise<TranslationResult> {
            return Promise.resolve({
              cleanText: _text,
              translatedText: 'bản dịch',
              sourceLang: 'English',
              targetLang: 'Vietnamese',
              timestamp: new Date().toISOString(),
            })
          },
        }
      },
    }

    expect(plugin.manifest.id).toBe('test-provider')
    expect(plugin.manifest.supportedModels).toHaveLength(2)
    expect(plugin.manifest.defaultModel).toBe('model-a')
    expect(typeof plugin.create).toBe('function')
    expect(plugin.manifest.capabilities.streaming).toBe(false)
  })
})
```

### Step 2: Run test to verify it fails

```bash
bun test packages/core/src/interfaces/provider-plugin.test.ts
```

Expected: `error: Cannot find module './provider-plugin'`

### Step 3: Implement the contracts

```typescript
// packages/core/src/interfaces/provider-plugin.ts
import type { ITranslationService } from './translation'

export interface ProviderCreateContext {
  modelId: string
  baseUrl?: string
}

export interface ProviderManifest {
  readonly id: string
  readonly supportedModels: readonly string[]
  readonly defaultModel: string
  readonly capabilities: {
    readonly streaming: boolean
  }
}

export interface ProviderPlugin {
  readonly manifest: ProviderManifest
  create(ctx: ProviderCreateContext): ITranslationService
}
```

### Step 4: Export the new types from core index

Add to `packages/core/src/index.ts`:

```typescript
// Add after existing interface exports:
export type {
  ProviderPlugin,
  ProviderManifest,
  ProviderCreateContext,
} from './interfaces/provider-plugin'
```

### Step 5: Run test to verify it passes

```bash
bun test packages/core/src/interfaces/provider-plugin.test.ts
```

Expected: `✓ ProviderPlugin contract > accepts a conforming plugin object`

### Step 6: Commit

```bash
git add packages/core/src/interfaces/provider-plugin.ts packages/core/src/interfaces/provider-plugin.test.ts packages/core/src/index.ts
git commit -m "feat(core): add provider plugin contracts (ProviderManifest, ProviderPlugin, ProviderCreateContext)"
```

---

## Task 2: Build Plugin Registry Service in Core

**Files:**

- Create: `packages/core/src/services/provider-registry.ts`
- Create: `packages/core/src/services/provider-registry.test.ts`
- Modify: `packages/core/src/index.ts`

### Step 1: Write the failing tests

```typescript
// packages/core/src/services/provider-registry.test.ts
import { beforeEach, describe, expect, it } from 'bun:test'
import {
  registerProviderPlugin,
  getProviderPlugin,
  listProviderPlugins,
  resetProviderRegistryForTest,
  ProviderRegistryBootError,
} from './provider-registry'
import type { ProviderPlugin } from '~/interfaces/provider-plugin'

function makePlugin(id: string): ProviderPlugin {
  return {
    manifest: {
      id,
      supportedModels: ['model-x'] as const,
      defaultModel: 'model-x',
      capabilities: { streaming: false },
    },
    create: () => ({ translate: () => Promise.reject(new Error('not implemented')) }),
  }
}

describe('ProviderRegistry', () => {
  beforeEach(() => {
    resetProviderRegistryForTest()
  })

  it('registers a plugin and resolves it by id', () => {
    const plugin = makePlugin('test')
    registerProviderPlugin(plugin)
    expect(getProviderPlugin('test')).toBe(plugin)
  })

  it('throws ProviderRegistryBootError on duplicate registration', () => {
    registerProviderPlugin(makePlugin('dupe'))
    expect(() => registerProviderPlugin(makePlugin('dupe'))).toThrow(ProviderRegistryBootError)
    expect(() => registerProviderPlugin(makePlugin('dupe'))).toThrow(/already registered/)
  })

  it('throws ProviderRegistryBootError when provider not found', () => {
    registerProviderPlugin(makePlugin('gemini'))
    expect(() => getProviderPlugin('cursor')).toThrow(ProviderRegistryBootError)
    expect(() => getProviderPlugin('cursor')).toThrow(/cursor/)
  })

  it('error message lists registered providers when provider not found', () => {
    registerProviderPlugin(makePlugin('gemini'))
    registerProviderPlugin(makePlugin('openai'))
    expect(() => getProviderPlugin('missing')).toThrow(/gemini/)
  })

  it('lists all registered providers', () => {
    registerProviderPlugin(makePlugin('gemini'))
    registerProviderPlugin(makePlugin('openai'))
    const list = listProviderPlugins()
    expect(list).toHaveLength(2)
    expect(list.map((p) => p.manifest.id)).toContain('gemini')
    expect(list.map((p) => p.manifest.id)).toContain('openai')
  })

  it('resetProviderRegistryForTest clears all providers', () => {
    registerProviderPlugin(makePlugin('x'))
    resetProviderRegistryForTest()
    expect(listProviderPlugins()).toHaveLength(0)
  })
})
```

### Step 2: Run test to verify it fails

```bash
bun test packages/core/src/services/provider-registry.test.ts
```

Expected: `error: Cannot find module './provider-registry'`

### Step 3: Implement the registry

```typescript
// packages/core/src/services/provider-registry.ts
import type { ProviderPlugin } from '~/interfaces/provider-plugin'

export class ProviderRegistryBootError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProviderRegistryBootError'
  }
}

const _registry = new Map<string, ProviderPlugin>()

export function registerProviderPlugin(plugin: ProviderPlugin): void {
  if (_registry.has(plugin.manifest.id)) {
    throw new ProviderRegistryBootError(`Provider '${plugin.manifest.id}' is already registered`)
  }
  _registry.set(plugin.manifest.id, plugin)
}

export function getProviderPlugin(id: string): ProviderPlugin {
  const plugin = _registry.get(id)
  if (!plugin) {
    const supported = [..._registry.keys()].join(', ')
    throw new ProviderRegistryBootError(
      `Provider '${id}' not registered. Registered providers: [${supported}]`,
    )
  }
  return plugin
}

export function listProviderPlugins(): ProviderPlugin[] {
  return [..._registry.values()]
}

/** For use in tests only — do not call in production code */
export function resetProviderRegistryForTest(): void {
  _registry.clear()
}
```

### Step 4: Export registry APIs from core index

Add to `packages/core/src/index.ts`:

```typescript
// Add after existing service exports:
export {
  registerProviderPlugin,
  getProviderPlugin,
  listProviderPlugins,
  resetProviderRegistryForTest,
  ProviderRegistryBootError,
} from './services/provider-registry'
```

### Step 5: Run test to verify it passes

```bash
bun test packages/core/src/services/provider-registry.test.ts
```

Expected: `6 pass, 0 fail`

### Step 6: Commit

```bash
git add packages/core/src/services/provider-registry.ts packages/core/src/services/provider-registry.test.ts packages/core/src/index.ts
git commit -m "feat(core): add plugin registry service with typed boot errors"
```

---

## Task 3: Define Strict AI Config Domain Types

**Files:**

- Modify: `packages/core/src/types/ai.ts`
- Create: `packages/core/src/types/ai.test.ts`
- Modify: `packages/core/src/index.ts`

### Step 1: Write the failing tests

```typescript
// packages/core/src/types/ai.test.ts
import { describe, expect, it } from 'bun:test'
import {
  AI_PROVIDER_VALUES,
  GEMINI_MODEL_VALUES,
  OPENAI_MODEL_VALUES,
  CURSOR_MODEL_VALUES,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_CURSOR_MODEL,
} from './ai'

describe('AI type domains', () => {
  it('AI_PROVIDER_VALUES includes cursor, gemini, openai', () => {
    expect(AI_PROVIDER_VALUES).toContain('cursor')
    expect(AI_PROVIDER_VALUES).toContain('gemini')
    expect(AI_PROVIDER_VALUES).toContain('openai')
  })

  it('GEMINI_MODEL_VALUES includes default', () => {
    expect(GEMINI_MODEL_VALUES.length).toBeGreaterThan(0)
    expect(GEMINI_MODEL_VALUES).toContain(DEFAULT_GEMINI_MODEL)
  })

  it('OPENAI_MODEL_VALUES includes default', () => {
    expect(OPENAI_MODEL_VALUES.length).toBeGreaterThan(0)
    expect(OPENAI_MODEL_VALUES).toContain(DEFAULT_OPENAI_MODEL)
  })

  it('CURSOR_MODEL_VALUES includes all core cursor models', () => {
    expect(CURSOR_MODEL_VALUES).toContain('claude-sonnet-4-5')
    expect(CURSOR_MODEL_VALUES).toContain('claude-sonnet-4-6')
    expect(CURSOR_MODEL_VALUES).toContain('gpt-4o')
    expect(CURSOR_MODEL_VALUES).toContain('cursor-small')
  })

  it('DEFAULT_CURSOR_MODEL is claude-sonnet-4-5', () => {
    expect(DEFAULT_CURSOR_MODEL).toBe('claude-sonnet-4-5')
  })

  it('all defaults are included in their respective model value arrays', () => {
    expect(GEMINI_MODEL_VALUES).toContain(DEFAULT_GEMINI_MODEL)
    expect(OPENAI_MODEL_VALUES).toContain(DEFAULT_OPENAI_MODEL)
    expect(CURSOR_MODEL_VALUES).toContain(DEFAULT_CURSOR_MODEL)
  })
})
```

### Step 2: Run test to verify it fails

```bash
bun test packages/core/src/types/ai.test.ts
```

Expected: `error: CURSOR_MODEL_VALUES is not defined`

### Step 3: Replace `packages/core/src/types/ai.ts` with the expanded version

```typescript
// packages/core/src/types/ai.ts

export const AI_PROVIDER_VALUES = ['gemini', 'openai', 'cursor'] as const
export type AIProvider = (typeof AI_PROVIDER_VALUES)[number]

export const GEMINI_MODEL_VALUES = ['gemini-2.5-pro', 'gemini-2.0-flash'] as const
export type GeminiModel = (typeof GEMINI_MODEL_VALUES)[number]

export const OPENAI_MODEL_VALUES = ['gpt-4o', 'gpt-4o-mini'] as const
export type OpenAIModel = (typeof OPENAI_MODEL_VALUES)[number]

export const CURSOR_MODEL_VALUES = [
  'claude-sonnet-4-5',
  'claude-sonnet-4-5-thinking',
  'claude-sonnet-4-6',
  'claude-sonnet-4-6-thinking',
  'gpt-4o',
  'cursor-small',
] as const
export type CursorModel = (typeof CURSOR_MODEL_VALUES)[number]

export const DEFAULT_GEMINI_MODEL: GeminiModel = 'gemini-2.5-pro'
export const DEFAULT_OPENAI_MODEL: OpenAIModel = 'gpt-4o'
export const DEFAULT_CURSOR_MODEL: CursorModel = 'claude-sonnet-4-5'
```

### Step 4: Update core index exports

In `packages/core/src/index.ts`, replace the existing ai type exports:

```typescript
// Replace the existing ai export lines with:
export type { AIProvider, GeminiModel, OpenAIModel, CursorModel } from './types/ai'
export {
  AI_PROVIDER_VALUES,
  GEMINI_MODEL_VALUES,
  OPENAI_MODEL_VALUES,
  CURSOR_MODEL_VALUES,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_CURSOR_MODEL,
} from './types/ai'
```

### Step 5: Run test to verify it passes

```bash
bun test packages/core/src/types/ai.test.ts
```

Expected: `6 pass, 0 fail`

### Step 6: Commit

```bash
git add packages/core/src/types/ai.ts packages/core/src/types/ai.test.ts packages/core/src/index.ts
git commit -m "feat(core): add cursor to AI provider domains with CURSOR_MODEL_VALUES and defaults"
```

---

## Task 4: Create @chatwork-bot/translation-prompt Package

**Files:**

- Create: `packages/translation-prompt/package.json`
- Create: `packages/translation-prompt/tsconfig.json`
- Create: `packages/translation-prompt/src/index.ts`
- Create: `packages/translation-prompt/src/translation-prompt.ts` (move from core)
- Create: `packages/translation-prompt/src/translation-prompt.test.ts`
- Delete: `packages/core/src/services/translation-prompt.ts` (after providers migrated)

### Step 1: Write the failing tests

```typescript
// packages/translation-prompt/src/translation-prompt.test.ts
import { describe, expect, it } from 'bun:test'
import { TranslationSchema, buildTranslationPrompt } from './translation-prompt'

describe('buildTranslationPrompt', () => {
  it('includes the source text in the prompt', () => {
    const text = 'Hello World'
    const prompt = buildTranslationPrompt(text)
    expect(prompt).toContain(text)
  })

  it('mentions Vietnamese as the target language', () => {
    const prompt = buildTranslationPrompt('test')
    expect(prompt.toLowerCase()).toContain('vietnamese')
  })

  it('mentions detecting the source language', () => {
    const prompt = buildTranslationPrompt('test')
    expect(prompt.toLowerCase()).toContain('detect')
  })
})

describe('TranslationSchema', () => {
  it('parses a valid object', () => {
    const result = TranslationSchema.parse({ sourceLang: 'English', translated: 'Xin chào' })
    expect(result.sourceLang).toBe('English')
    expect(result.translated).toBe('Xin chào')
  })

  it('rejects an empty translated string', () => {
    expect(() => TranslationSchema.parse({ sourceLang: 'English', translated: '' })).toThrow()
  })

  it('rejects a missing sourceLang', () => {
    expect(() => TranslationSchema.parse({ translated: 'Xin chào' })).toThrow()
  })

  it('rejects a sourceLang shorter than 2 chars', () => {
    expect(() => TranslationSchema.parse({ sourceLang: 'E', translated: 'Xin chào' })).toThrow()
  })

  it('accepts a sourceLang up to 50 chars', () => {
    const lang = 'A'.repeat(50)
    expect(() => TranslationSchema.parse({ sourceLang: lang, translated: 'ok' })).not.toThrow()
  })
})
```

### Step 2: Run test to verify it fails

```bash
bun test packages/translation-prompt/src/translation-prompt.test.ts
```

Expected: `error: Cannot find module './translation-prompt'` (package doesn't exist yet)

### Step 3: Create the package

**`packages/translation-prompt/package.json`:**

```json
{
  "name": "@chatwork-bot/translation-prompt",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "main": "./src/index.ts",
  "scripts": {
    "lint": "eslint \"**/*.ts\"",
    "lint:fix": "eslint \"**/*.ts\" --fix",
    "format": "prettier --write \"**/*.{ts,tsx,json,md,yml,yaml}\"",
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  "dependencies": {
    "zod": "^4.3.6"
  }
}
```

**`packages/translation-prompt/tsconfig.json`:**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": "../..",
    "rootDir": "src",
    "outDir": "dist",
    "paths": {
      "~/*": ["packages/translation-prompt/src/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**`packages/translation-prompt/src/translation-prompt.ts`** — copy from `packages/core/src/services/translation-prompt.ts` (content is identical):

```typescript
// packages/translation-prompt/src/translation-prompt.ts
import { z } from 'zod'

export const TranslationSchema = z.object({
  sourceLang: z
    .string()
    .min(2)
    .max(50)
    .describe(
      "Full language name in English, e.g. 'Japanese', 'Vietnamese', 'Traditional Chinese'",
    ),
  translated: z.string().min(1),
})

export type TranslationOutput = z.infer<typeof TranslationSchema>

export function buildTranslationPrompt(text: string): string {
  return `You are a professional translator.
Detect the source language and translate the following text into natural, human-readable Vietnamese.
Use natural, idiomatic phrasing so the translation reads like prose written by a native speaker.
Preserve the original meaning, tone, and nuance.
Preserve paragraph breaks (blank lines) when they still feel natural in Vietnamese.
Single line breaks within the same paragraph may be smoothed for better readability.
Return the detected source language as its full English name (e.g., 'Japanese', 'Vietnamese', 'Traditional Chinese').

Text: ${text}`
}
```

**`packages/translation-prompt/src/index.ts`:**

```typescript
// packages/translation-prompt/src/index.ts
export { TranslationSchema, buildTranslationPrompt } from './translation-prompt'
export type { TranslationOutput } from './translation-prompt'
```

### Step 4: Install workspace dependencies

```bash
bun install
```

Expected: `bun install v1.x.x ... Done`

### Step 5: Run test to verify it passes

```bash
bun test packages/translation-prompt/src/translation-prompt.test.ts
```

Expected: `8 pass, 0 fail`

### Step 6: Commit

```bash
git add packages/translation-prompt bun.lockb
git commit -m "feat(translation-prompt): extract shared prompt utilities to dedicated package"
```

---

## Task 5: Create Provider Package Skeletons

**Files:**

- Create: `packages/provider-gemini/package.json`
- Create: `packages/provider-gemini/tsconfig.json`
- Create: `packages/provider-gemini/src/index.ts`
- Create: `packages/provider-openai/package.json`
- Create: `packages/provider-openai/tsconfig.json`
- Create: `packages/provider-openai/src/index.ts`
- Create: `packages/provider-cursor/package.json`
- Create: `packages/provider-cursor/tsconfig.json`
- Create: `packages/provider-cursor/src/index.ts`
- Modify: root `package.json` (add `cursor-api-proxy` to devDependencies)
- Create: `packages/translator/src/bootstrap/providers.test.ts`

### Step 1: Write a bootstrap test to verify package resolution

```typescript
// packages/translator/src/bootstrap/providers.test.ts
import { describe, expect, it } from 'bun:test'

describe('provider package resolution', () => {
  it('can import @chatwork-bot/provider-gemini', async () => {
    const mod = await import('@chatwork-bot/provider-gemini')
    expect(mod).toBeDefined()
  })

  it('can import @chatwork-bot/provider-openai', async () => {
    const mod = await import('@chatwork-bot/provider-openai')
    expect(mod).toBeDefined()
  })

  it('can import @chatwork-bot/provider-cursor', async () => {
    const mod = await import('@chatwork-bot/provider-cursor')
    expect(mod).toBeDefined()
  })
})
```

### Step 2: Run test to verify it fails

```bash
bun test packages/translator/src/bootstrap/providers.test.ts
```

Expected: `error: Cannot find package '@chatwork-bot/provider-gemini'`

### Step 3: Create provider-gemini skeleton

**`packages/provider-gemini/package.json`:**

```json
{
  "name": "@chatwork-bot/provider-gemini",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "main": "./src/index.ts",
  "scripts": {
    "lint": "eslint \"**/*.ts\"",
    "lint:fix": "eslint \"**/*.ts\" --fix",
    "format": "prettier --write \"**/*.{ts,tsx,json,md,yml,yaml}\"",
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  "dependencies": {
    "@chatwork-bot/core": "workspace:*",
    "@chatwork-bot/translation-prompt": "workspace:*",
    "@ai-sdk/google": "^3.0.37",
    "ai": "^6.0.111"
  }
}
```

**`packages/provider-gemini/tsconfig.json`:**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": "../..",
    "rootDir": "src",
    "outDir": "dist",
    "paths": {
      "~/*": ["packages/provider-gemini/src/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**`packages/provider-gemini/src/index.ts`** (placeholder):

```typescript
// packages/provider-gemini/src/index.ts
// populated in Task 6
export {}
```

### Step 4: Create provider-openai skeleton

**`packages/provider-openai/package.json`:**

```json
{
  "name": "@chatwork-bot/provider-openai",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "main": "./src/index.ts",
  "scripts": {
    "lint": "eslint \"**/*.ts\"",
    "lint:fix": "eslint \"**/*.ts\" --fix",
    "format": "prettier --write \"**/*.{ts,tsx,json,md,yml,yaml}\"",
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  "dependencies": {
    "@chatwork-bot/core": "workspace:*",
    "@chatwork-bot/translation-prompt": "workspace:*",
    "@ai-sdk/openai": "^3.0.39",
    "ai": "^6.0.111"
  }
}
```

**`packages/provider-openai/tsconfig.json`:**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": "../..",
    "rootDir": "src",
    "outDir": "dist",
    "paths": {
      "~/*": ["packages/provider-openai/src/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**`packages/provider-openai/src/index.ts`** (placeholder):

```typescript
// packages/provider-openai/src/index.ts
// populated in Task 7
export {}
```

### Step 5: Create provider-cursor skeleton

**`packages/provider-cursor/package.json`:**

```json
{
  "name": "@chatwork-bot/provider-cursor",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "main": "./src/index.ts",
  "scripts": {
    "lint": "eslint \"**/*.ts\"",
    "lint:fix": "eslint \"**/*.ts\" --fix",
    "format": "prettier --write \"**/*.{ts,tsx,json,md,yml,yaml}\"",
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  "dependencies": {
    "@chatwork-bot/core": "workspace:*",
    "@chatwork-bot/translation-prompt": "workspace:*",
    "@ai-sdk/openai-compatible": "^0.2.0",
    "ai": "^6.0.111"
  }
}
```

**`packages/provider-cursor/tsconfig.json`:**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": "../..",
    "rootDir": "src",
    "outDir": "dist",
    "paths": {
      "~/*": ["packages/provider-cursor/src/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**`packages/provider-cursor/src/index.ts`** (placeholder):

```typescript
// packages/provider-cursor/src/index.ts
// populated in Task 8
export {}
```

### Step 6: Pin cursor-api-proxy in root package.json

Look up latest version on npm (`npm view cursor-api-proxy version`), then add to root `package.json` devDependencies with **exact version pin** (no caret):

```json
"devDependencies": {
  ...existing devDeps...,
  "cursor-api-proxy": "X.Y.Z"
}
```

> **IMPORTANT:** Replace `X.Y.Z` with the exact version found on npm. Never use `latest` or `^X.Y.Z`.
> Add this note to docs/operations/cursor-api-proxy-risk.md: "cursor-api-proxy is a community package. It is pinned at an exact version and used for LOCAL DEVELOPMENT ONLY. It must not be installed in production. Re-evaluate the pin on every major upgrade."

### Step 7: Install all workspace dependencies

```bash
bun install
```

Expected: `Done — all workspace packages resolved`

### Step 8: Run test to verify it passes

```bash
bun test packages/translator/src/bootstrap/providers.test.ts
```

Expected: `3 pass, 0 fail` (empty modules resolve successfully)

### Step 9: Verify standards script includes new packages

```bash
bun run verify:standards
```

Expected: All 5 scripts (`lint`, `lint:fix`, `format`, `typecheck`, `test`) detected in each new package.

### Step 10: Commit

```bash
git add packages/provider-gemini packages/provider-openai packages/provider-cursor packages/translator/src/bootstrap/providers.test.ts package.json bun.lockb
git commit -m "chore(repo): scaffold provider-gemini, provider-openai, provider-cursor workspace packages"
```

---

## Task 6: Implement Gemini Provider Plugin

**Files:**

- Create: `packages/provider-gemini/src/gemini-plugin.ts`
- Create: `packages/provider-gemini/src/gemini-plugin.test.ts` (adapted from core test)
- Modify: `packages/provider-gemini/src/index.ts`

### Step 1: Write the failing tests

```typescript
// packages/provider-gemini/src/gemini-plugin.test.ts
// Adapted from packages/core/src/services/gemini-translation.test.ts
import { beforeAll, describe, expect, it, mock } from 'bun:test'
import type { geminiPlugin as geminiPluginType } from './gemini-plugin'

let mockSourceLang = 'English'
let mockTranslated = 'Xin chào thế giới'

const generateTextMock = mock((_config: unknown) =>
  Promise.resolve({
    output: { sourceLang: mockSourceLang, translated: mockTranslated },
  }),
)

const outputObjectMock = mock((config: unknown) => config)
const googleMock = mock((_modelId: string) => ({ provider: 'google', modelId: _modelId }))

void mock.module('ai', () => ({
  generateText: generateTextMock,
  Output: { object: outputObjectMock },
}))

void mock.module('@ai-sdk/google', () => ({ google: googleMock }))

describe('geminiPlugin', () => {
  let geminiPlugin: typeof geminiPluginType

  beforeAll(async () => {
    const mod = await import('./gemini-plugin')
    geminiPlugin = mod.geminiPlugin
  })

  it('manifest id is gemini', () => {
    expect(geminiPlugin.manifest.id).toBe('gemini')
  })

  it('manifest defaultModel is gemini-2.5-pro', () => {
    expect(geminiPlugin.manifest.defaultModel).toBe('gemini-2.5-pro')
  })

  it('manifest supportedModels contains gemini-2.5-pro and gemini-2.0-flash', () => {
    expect(geminiPlugin.manifest.supportedModels).toContain('gemini-2.5-pro')
    expect(geminiPlugin.manifest.supportedModels).toContain('gemini-2.0-flash')
  })

  it('create returns a service that translates text', async () => {
    mockSourceLang = 'English'
    mockTranslated = 'Xin chào thế giới'
    const service = geminiPlugin.create({ modelId: 'gemini-2.5-pro' })
    const result = await service.translate('Hello World')
    expect(result.cleanText).toBe('Hello World')
    expect(result.translatedText).toBe('Xin chào thế giới')
    expect(result.sourceLang).toBe('English')
    expect(result.targetLang).toBe('Vietnamese')
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('passes the modelId through to google()', async () => {
    const service = geminiPlugin.create({ modelId: 'gemini-2.0-flash' })
    await service.translate('test')
    expect(googleMock.mock.calls.at(-1)?.[0]).toBe('gemini-2.0-flash')
  })

  it('wraps API errors in TranslationError', async () => {
    generateTextMock.mockImplementationOnce(() => Promise.reject(new Error('network error')))
    const { TranslationError } = await import('@chatwork-bot/core')
    const service = geminiPlugin.create({ modelId: 'gemini-2.5-pro' })
    await expect(service.translate('test')).rejects.toBeInstanceOf(TranslationError)
  })
})
```

### Step 2: Run test to verify it fails

```bash
bun test packages/provider-gemini/src/gemini-plugin.test.ts
```

Expected: `error: Cannot find module './gemini-plugin'`

### Step 3: Implement gemini-plugin.ts

```typescript
// packages/provider-gemini/src/gemini-plugin.ts
import { generateText, Output } from 'ai'
import { google } from '@ai-sdk/google'
import type { ITranslationService, TranslationResult } from '@chatwork-bot/core'
import { TranslationError, GEMINI_MODEL_VALUES, DEFAULT_GEMINI_MODEL } from '@chatwork-bot/core'
import type { ProviderPlugin, ProviderCreateContext } from '@chatwork-bot/core'
import { TranslationSchema, buildTranslationPrompt } from '@chatwork-bot/translation-prompt'

class GeminiTranslationService implements ITranslationService {
  constructor(private readonly modelId: string = DEFAULT_GEMINI_MODEL) {}

  async translate(text: string): Promise<TranslationResult> {
    try {
      const { output } = await generateText({
        model: google(this.modelId),
        output: Output.object({ schema: TranslationSchema }),
        prompt: buildTranslationPrompt(text),
        temperature: 0,
        maxOutputTokens: 1200,
      })
      return {
        cleanText: text,
        translatedText: output.translated,
        sourceLang: output.sourceLang,
        targetLang: 'Vietnamese',
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

export const geminiPlugin: ProviderPlugin = {
  manifest: {
    id: 'gemini',
    supportedModels: GEMINI_MODEL_VALUES,
    defaultModel: DEFAULT_GEMINI_MODEL,
    capabilities: { streaming: false },
  },
  create(ctx: ProviderCreateContext): ITranslationService {
    return new GeminiTranslationService(ctx.modelId)
  },
}
```

### Step 4: Update provider-gemini index

```typescript
// packages/provider-gemini/src/index.ts
export { geminiPlugin } from './gemini-plugin'
```

### Step 5: Run test to verify it passes

```bash
bun test packages/provider-gemini/src/gemini-plugin.test.ts
```

Expected: `6 pass, 0 fail`

### Step 6: Commit

```bash
git add packages/provider-gemini/src
git commit -m "feat(provider-gemini): add gemini provider plugin with adapted tests"
```

---

## Task 7: Implement OpenAI Provider Plugin

**Files:**

- Create: `packages/provider-openai/src/openai-plugin.ts`
- Create: `packages/provider-openai/src/openai-plugin.test.ts` (adapted from core test)
- Modify: `packages/provider-openai/src/index.ts`

### Step 1: Write the failing tests

```typescript
// packages/provider-openai/src/openai-plugin.test.ts
// Adapted from packages/core/src/services/openai-translation.test.ts
import { beforeAll, describe, expect, it, mock } from 'bun:test'
import type { openaiPlugin as openaiPluginType } from './openai-plugin'

let mockSourceLang = 'Japanese'
let mockTranslated = 'おはようございます、世界！'

const generateTextMock = mock((_config: unknown) =>
  Promise.resolve({
    output: { sourceLang: mockSourceLang, translated: mockTranslated },
  }),
)

const outputObjectMock = mock((config: unknown) => config)
const openaiMock = mock((_modelId: string) => ({ provider: 'openai', modelId: _modelId }))

void mock.module('ai', () => ({
  generateText: generateTextMock,
  Output: { object: outputObjectMock },
}))

void mock.module('@ai-sdk/openai', () => ({ openai: openaiMock }))

describe('openaiPlugin', () => {
  let openaiPlugin: typeof openaiPluginType

  beforeAll(async () => {
    const mod = await import('./openai-plugin')
    openaiPlugin = mod.openaiPlugin
  })

  it('manifest id is openai', () => {
    expect(openaiPlugin.manifest.id).toBe('openai')
  })

  it('manifest defaultModel is gpt-4o', () => {
    expect(openaiPlugin.manifest.defaultModel).toBe('gpt-4o')
  })

  it('manifest supportedModels contains gpt-4o and gpt-4o-mini', () => {
    expect(openaiPlugin.manifest.supportedModels).toContain('gpt-4o')
    expect(openaiPlugin.manifest.supportedModels).toContain('gpt-4o-mini')
  })

  it('create returns a service that translates text', async () => {
    mockSourceLang = 'Japanese'
    mockTranslated = 'おはようございます、世界！'
    const service = openaiPlugin.create({ modelId: 'gpt-4o' })
    const result = await service.translate('おはようございます、世界！')
    expect(result.cleanText).toBe('おはようございます、世界！')
    expect(result.translatedText).toBe('おはようございます、世界！')
    expect(result.sourceLang).toBe('Japanese')
    expect(result.targetLang).toBe('Vietnamese')
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('passes the modelId through to openai()', async () => {
    const service = openaiPlugin.create({ modelId: 'gpt-4o-mini' })
    await service.translate('test')
    expect(openaiMock.mock.calls.at(-1)?.[0]).toBe('gpt-4o-mini')
  })

  it('wraps API errors in TranslationError', async () => {
    generateTextMock.mockImplementationOnce(() => Promise.reject(new Error('quota exceeded')))
    const { TranslationError } = await import('@chatwork-bot/core')
    const service = openaiPlugin.create({ modelId: 'gpt-4o' })
    await expect(service.translate('test')).rejects.toBeInstanceOf(TranslationError)
  })
})
```

### Step 2: Run test to verify it fails

```bash
bun test packages/provider-openai/src/openai-plugin.test.ts
```

Expected: `error: Cannot find module './openai-plugin'`

### Step 3: Implement openai-plugin.ts

```typescript
// packages/provider-openai/src/openai-plugin.ts
import { generateText, Output } from 'ai'
import { openai } from '@ai-sdk/openai'
import type { ITranslationService, TranslationResult } from '@chatwork-bot/core'
import { TranslationError, OPENAI_MODEL_VALUES, DEFAULT_OPENAI_MODEL } from '@chatwork-bot/core'
import type { ProviderPlugin, ProviderCreateContext } from '@chatwork-bot/core'
import { TranslationSchema, buildTranslationPrompt } from '@chatwork-bot/translation-prompt'

class OpenAITranslationService implements ITranslationService {
  constructor(private readonly modelId: string = DEFAULT_OPENAI_MODEL) {}

  async translate(text: string): Promise<TranslationResult> {
    try {
      const { output } = await generateText({
        model: openai(this.modelId),
        output: Output.object({ schema: TranslationSchema }),
        prompt: buildTranslationPrompt(text),
        temperature: 0,
        maxOutputTokens: 1200,
      })
      return {
        cleanText: text,
        translatedText: output.translated,
        sourceLang: output.sourceLang,
        targetLang: 'Vietnamese',
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

export const openaiPlugin: ProviderPlugin = {
  manifest: {
    id: 'openai',
    supportedModels: OPENAI_MODEL_VALUES,
    defaultModel: DEFAULT_OPENAI_MODEL,
    capabilities: { streaming: false },
  },
  create(ctx: ProviderCreateContext): ITranslationService {
    return new OpenAITranslationService(ctx.modelId)
  },
}
```

### Step 4: Update provider-openai index

```typescript
// packages/provider-openai/src/index.ts
export { openaiPlugin } from './openai-plugin'
```

### Step 5: Run test to verify it passes

```bash
bun test packages/provider-openai/src/openai-plugin.test.ts
```

Expected: `6 pass, 0 fail`

### Step 6: Commit

```bash
git add packages/provider-openai/src
git commit -m "feat(provider-openai): add openai provider plugin with adapted tests"
```

---

## Task 8: Implement Cursor Provider Plugin

**Files:**

- Create: `packages/provider-cursor/src/cursor-translation.ts`
- Create: `packages/provider-cursor/src/cursor-plugin.ts`
- Create: `packages/provider-cursor/src/cursor-plugin.test.ts`
- Modify: `packages/provider-cursor/src/index.ts`

### Step 1: Write the failing tests

```typescript
// packages/provider-cursor/src/cursor-plugin.test.ts
import { beforeAll, describe, expect, it, mock } from 'bun:test'
import type { cursorPlugin as cursorPluginType } from './cursor-plugin'

let mockSourceLang = 'English'
let mockTranslated = 'Xin chào từ Cursor'

const generateTextMock = mock((_config: unknown) =>
  Promise.resolve({
    output: { sourceLang: mockSourceLang, translated: mockTranslated },
  }),
)

const outputObjectMock = mock((config: unknown) => config)
const createOpenAICompatibleMock = mock((_config: unknown) => {
  return (_modelId: string) => ({ provider: 'cursor', modelId: _modelId })
})

void mock.module('ai', () => ({
  generateText: generateTextMock,
  Output: { object: outputObjectMock },
}))

void mock.module('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: createOpenAICompatibleMock,
}))

describe('cursorPlugin', () => {
  let cursorPlugin: typeof cursorPluginType

  beforeAll(async () => {
    const mod = await import('./cursor-plugin')
    cursorPlugin = mod.cursorPlugin
  })

  it('manifest id is cursor', () => {
    expect(cursorPlugin.manifest.id).toBe('cursor')
  })

  it('manifest defaultModel is claude-sonnet-4-5', () => {
    expect(cursorPlugin.manifest.defaultModel).toBe('claude-sonnet-4-5')
  })

  it('manifest supportedModels contains all cursor models', () => {
    expect(cursorPlugin.manifest.supportedModels).toContain('claude-sonnet-4-5')
    expect(cursorPlugin.manifest.supportedModels).toContain('gpt-4o')
    expect(cursorPlugin.manifest.supportedModels).toContain('cursor-small')
  })

  it('create returns a service that translates text', async () => {
    mockSourceLang = 'English'
    mockTranslated = 'Xin chào từ Cursor'
    const service = cursorPlugin.create({
      modelId: 'claude-sonnet-4-5',
      baseUrl: 'http://localhost:3040',
    })
    const result = await service.translate('Hello from Cursor')
    expect(result.cleanText).toBe('Hello from Cursor')
    expect(result.translatedText).toBe('Xin chào từ Cursor')
    expect(result.sourceLang).toBe('English')
    expect(result.targetLang).toBe('Vietnamese')
  })

  it('throws if baseUrl is missing', () => {
    expect(() => cursorPlugin.create({ modelId: 'claude-sonnet-4-5' })).toThrow(/baseUrl/)
  })

  it('wraps API errors in TranslationError', async () => {
    generateTextMock.mockImplementationOnce(() => Promise.reject(new Error('proxy down')))
    const { TranslationError } = await import('@chatwork-bot/core')
    const service = cursorPlugin.create({
      modelId: 'claude-sonnet-4-5',
      baseUrl: 'http://localhost:3040',
    })
    await expect(service.translate('test')).rejects.toBeInstanceOf(TranslationError)
  })
})
```

### Step 2: Run test to verify it fails

```bash
bun test packages/provider-cursor/src/cursor-plugin.test.ts
```

Expected: `error: Cannot find module './cursor-plugin'`

### Step 3: Implement cursor-translation.ts

```typescript
// packages/provider-cursor/src/cursor-translation.ts
import { generateText, Output } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { ITranslationService, TranslationResult } from '@chatwork-bot/core'
import { TranslationError } from '@chatwork-bot/core'
import { TranslationSchema, buildTranslationPrompt } from '@chatwork-bot/translation-prompt'

export class CursorTranslationService implements ITranslationService {
  private readonly provider: ReturnType<typeof createOpenAICompatible>

  constructor(
    private readonly modelId: string,
    private readonly baseUrl: string,
  ) {
    this.provider = createOpenAICompatible({
      name: 'cursor',
      baseURL: baseUrl,
    })
  }

  async translate(text: string): Promise<TranslationResult> {
    try {
      const { output } = await generateText({
        model: this.provider(this.modelId),
        output: Output.object({ schema: TranslationSchema }),
        prompt: buildTranslationPrompt(text),
        temperature: 0,
        maxOutputTokens: 1200,
      })
      return {
        cleanText: text,
        translatedText: output.translated,
        sourceLang: output.sourceLang,
        targetLang: 'Vietnamese',
        timestamp: new Date().toISOString(),
      }
    } catch (cause) {
      throw new TranslationError(
        `Cursor API call failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        'API_ERROR',
        cause,
      )
    }
  }
}
```

### Step 4: Implement cursor-plugin.ts

```typescript
// packages/provider-cursor/src/cursor-plugin.ts
import type { ITranslationService } from '@chatwork-bot/core'
import { CURSOR_MODEL_VALUES, DEFAULT_CURSOR_MODEL } from '@chatwork-bot/core'
import type { ProviderPlugin, ProviderCreateContext } from '@chatwork-bot/core'
import { CursorTranslationService } from './cursor-translation'

export const cursorPlugin: ProviderPlugin = {
  manifest: {
    id: 'cursor',
    supportedModels: CURSOR_MODEL_VALUES,
    defaultModel: DEFAULT_CURSOR_MODEL,
    capabilities: { streaming: false },
  },
  create(ctx: ProviderCreateContext): ITranslationService {
    if (!ctx.baseUrl) {
      throw new Error(
        'cursor provider requires baseUrl in ProviderCreateContext (set CURSOR_API_URL)',
      )
    }
    return new CursorTranslationService(ctx.modelId, ctx.baseUrl)
  },
}
```

### Step 5: Update provider-cursor index

```typescript
// packages/provider-cursor/src/index.ts
export { cursorPlugin } from './cursor-plugin'
export { CursorTranslationService } from './cursor-translation'
```

### Step 6: Run test to verify it passes

```bash
bun test packages/provider-cursor/src/cursor-plugin.test.ts
```

Expected: `6 pass, 0 fail`

### Step 7: Commit

```bash
git add packages/provider-cursor/src
git commit -m "feat(provider-cursor): add cursor provider plugin using @ai-sdk/openai-compatible"
```

---

## Task 9: Add Explicit Provider Bootstrap in Translator

**Files:**

- Create: `packages/translator/src/bootstrap/register-providers.ts`
- Modify: `packages/translator/src/bootstrap/providers.test.ts`
- Modify: `packages/translator/src/index.ts`

### Step 1: Update the providers test to verify all 3 are registered

```typescript
// packages/translator/src/bootstrap/providers.test.ts (replace full file)
import { beforeAll, describe, expect, it } from 'bun:test'
import { listProviderPlugins, resetProviderRegistryForTest } from '@chatwork-bot/core'

describe('registerAllProviders', () => {
  beforeAll(async () => {
    resetProviderRegistryForTest()
    const { registerAllProviders } = await import('./register-providers')
    registerAllProviders()
  })

  it('registers exactly 3 providers', () => {
    expect(listProviderPlugins()).toHaveLength(3)
  })

  it('registers gemini provider', () => {
    const ids = listProviderPlugins().map((p) => p.manifest.id)
    expect(ids).toContain('gemini')
  })

  it('registers openai provider', () => {
    const ids = listProviderPlugins().map((p) => p.manifest.id)
    expect(ids).toContain('openai')
  })

  it('registers cursor provider', () => {
    const ids = listProviderPlugins().map((p) => p.manifest.id)
    expect(ids).toContain('cursor')
  })
})
```

### Step 2: Run test to verify it fails

```bash
bun test packages/translator/src/bootstrap/providers.test.ts
```

Expected: `error: Cannot find module './register-providers'`

### Step 3: Implement register-providers.ts

```typescript
// packages/translator/src/bootstrap/register-providers.ts
import { registerProviderPlugin } from '@chatwork-bot/core'
import { geminiPlugin } from '@chatwork-bot/provider-gemini'
import { openaiPlugin } from '@chatwork-bot/provider-openai'
import { cursorPlugin } from '@chatwork-bot/provider-cursor'

export function registerAllProviders(): void {
  registerProviderPlugin(geminiPlugin)
  registerProviderPlugin(openaiPlugin)
  registerProviderPlugin(cursorPlugin)
}
```

### Step 4: Call bootstrap at startup in `packages/translator/src/index.ts`

Find the current entry point and add the bootstrap call at the top, before the server starts. The call must happen before any request is handled:

```typescript
// Add near the top of packages/translator/src/index.ts, after env import:
import { registerAllProviders } from '~/bootstrap/register-providers'

// Call before server.listen / Elysia.listen:
registerAllProviders()
```

### Step 5: Run test to verify it passes

```bash
bun test packages/translator/src/bootstrap/providers.test.ts
```

Expected: `4 pass, 0 fail`

### Step 6: Commit

```bash
git add packages/translator/src/bootstrap/register-providers.ts packages/translator/src/bootstrap/providers.test.ts packages/translator/src/index.ts
git commit -m "feat(translator): add explicit provider bootstrap registry wiring"
```

---

## Task 10: Replace Factory with Registry Resolution in Handler

**Files:**

- Modify: `packages/translator/src/webhook/handler.ts`
- Modify: `packages/translator/package.json` (add `@chatwork-bot/provider-gemini/openai/cursor` deps)

### Step 1: Run existing handler tests to establish baseline

```bash
bun test packages/translator/src/webhook/handler.test.ts
```

Expected: `pass` (baseline before refactor)

### Step 2: Update handler.ts to use getProviderPlugin

Replace the current `TranslationServiceFactory.create(env.AI_PROVIDER, env.AI_MODEL)` call with registry resolution:

```typescript
// packages/translator/src/webhook/handler.ts
import {
  isChatworkMessageEvent,
  stripChatworkMarkup,
  getProviderPlugin,
  TranslationError,
} from '@chatwork-bot/core'
import type { ChatworkWebhookEvent } from '@chatwork-bot/core'
import { env } from '~/env'
import { writeTranslationOutput } from '~/utils/output-writer'
import { sendTranslatedMessage } from '~/services/chatwork-sender'

export async function handleTranslateRequest(event: ChatworkWebhookEvent): Promise<void> {
  if (!isChatworkMessageEvent(event)) {
    return
  }

  const { body } = event.webhook_event
  const cleanText = stripChatworkMarkup(body)
  if (!cleanText) {
    return
  }

  try {
    const plugin = getProviderPlugin(env.AI_PROVIDER)
    const cursorEnv = env as typeof env & { CURSOR_API_URL?: string }
    const service = plugin.create({
      modelId: env.AI_MODEL ?? plugin.manifest.defaultModel,
      baseUrl: cursorEnv.CURSOR_API_URL,
    })
    const result = await service.translate(cleanText)

    const outputBaseDir = process.env['OUTPUT_BASE_DIR']
    await writeTranslationOutput(
      { ...event, translation: result },
      ...(outputBaseDir ? [outputBaseDir] : []),
    )

    await sendTranslatedMessage(event, result, {
      apiToken: env.CHATWORK_API_TOKEN,
      destinationRoomId: env.CHATWORK_DESTINATION_ROOM_ID,
    })
  } catch (error) {
    if (error instanceof TranslationError) {
      return
    }
    throw error
  }
}
```

### Step 3: Run handler tests again

```bash
bun test packages/translator/src/webhook/handler.test.ts
```

Expected: `pass` (behavior unchanged — mocks still work)

### Step 4: Commit

```bash
git add packages/translator/src/webhook/handler.ts
git commit -m "refactor(translator): route translation creation through plugin registry"
```

---

## Task 11: Enforce Strict Discriminated Union Env Validation

**Files:**

- Modify: `packages/translator/src/env.ts`
- Create: `packages/translator/src/env.test.ts`
- Modify: `.env.example`

### Step 1: Write the failing env tests

```typescript
// packages/translator/src/env.test.ts
import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { GEMINI_MODEL_VALUES, OPENAI_MODEL_VALUES, CURSOR_MODEL_VALUES } from '@chatwork-bot/core'

// We test the schema shape directly without calling validateEnv()
// (which calls process.exit on failure — not suitable for unit tests)
// Build a testable schema mirror here:

const baseEnv = z.object({
  CHATWORK_API_TOKEN: z.string().min(1),
  CHATWORK_DESTINATION_ROOM_ID: z.coerce.number().int().positive(),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test', 'local']).default('development'),
  INTERNAL_TRANSLATE_SECRET: z.string().min(16),
})

const providerUnion = z.discriminatedUnion('AI_PROVIDER', [
  z.object({
    AI_PROVIDER: z.literal('gemini'),
    AI_MODEL: z.enum(GEMINI_MODEL_VALUES).optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
  }),
  z.object({
    AI_PROVIDER: z.literal('openai'),
    AI_MODEL: z.enum(OPENAI_MODEL_VALUES).optional(),
    OPENAI_API_KEY: z.string().min(1),
  }),
  z.object({
    AI_PROVIDER: z.literal('cursor'),
    AI_MODEL: z.enum(CURSOR_MODEL_VALUES).or(z.string().min(1)).optional(),
    CURSOR_API_URL: z
      .string()
      .url()
      .refine((u: string) => /^https?:\/\/(localhost|127\.0\.0\.1)/.test(u), {
        message: 'CURSOR_API_URL must be a localhost URL (local dev only)',
      }),
  }),
])

const schema = baseEnv.and(providerUnion)

const base = {
  CHATWORK_API_TOKEN: 'tok-123',
  CHATWORK_DESTINATION_ROOM_ID: '12345',
  INTERNAL_TRANSLATE_SECRET: 'minimum-16-chars-secret',
}

describe('env schema - gemini branch', () => {
  it('accepts valid gemini config', () => {
    const result = schema.safeParse({
      ...base,
      AI_PROVIDER: 'gemini',
      GOOGLE_GENERATIVE_AI_API_KEY: 'gkey-xxx',
    })
    expect(result.success).toBe(true)
  })

  it('accepts gemini with explicit model', () => {
    const result = schema.safeParse({
      ...base,
      AI_PROVIDER: 'gemini',
      GOOGLE_GENERATIVE_AI_API_KEY: 'gkey-xxx',
      AI_MODEL: 'gemini-2.0-flash',
    })
    expect(result.success).toBe(true)
  })

  it('rejects gemini without GOOGLE_GENERATIVE_AI_API_KEY', () => {
    const result = schema.safeParse({ ...base, AI_PROVIDER: 'gemini' })
    expect(result.success).toBe(false)
  })

  it('rejects gemini with invalid AI_MODEL', () => {
    const result = schema.safeParse({
      ...base,
      AI_PROVIDER: 'gemini',
      GOOGLE_GENERATIVE_AI_API_KEY: 'gkey',
      AI_MODEL: 'gpt-4o',
    })
    expect(result.success).toBe(false)
  })
})

describe('env schema - openai branch', () => {
  it('accepts valid openai config', () => {
    const result = schema.safeParse({
      ...base,
      AI_PROVIDER: 'openai',
      OPENAI_API_KEY: 'sk-xxx',
    })
    expect(result.success).toBe(true)
  })

  it('rejects openai without OPENAI_API_KEY', () => {
    const result = schema.safeParse({ ...base, AI_PROVIDER: 'openai' })
    expect(result.success).toBe(false)
  })
})

describe('env schema - cursor branch', () => {
  it('accepts valid cursor config with localhost URL', () => {
    const result = schema.safeParse({
      ...base,
      AI_PROVIDER: 'cursor',
      CURSOR_API_URL: 'http://localhost:3040',
    })
    expect(result.success).toBe(true)
  })

  it('accepts cursor with 127.0.0.1 URL', () => {
    const result = schema.safeParse({
      ...base,
      AI_PROVIDER: 'cursor',
      CURSOR_API_URL: 'http://127.0.0.1:3040',
    })
    expect(result.success).toBe(true)
  })

  it('rejects cursor with non-localhost URL', () => {
    const result = schema.safeParse({
      ...base,
      AI_PROVIDER: 'cursor',
      CURSOR_API_URL: 'https://api.example.com',
    })
    expect(result.success).toBe(false)
  })

  it('accepts cursor with custom model string (escape hatch)', () => {
    const result = schema.safeParse({
      ...base,
      AI_PROVIDER: 'cursor',
      CURSOR_API_URL: 'http://localhost:3040',
      AI_MODEL: 'my-custom-local-model',
    })
    expect(result.success).toBe(true)
  })

  it('rejects cursor without CURSOR_API_URL', () => {
    const result = schema.safeParse({ ...base, AI_PROVIDER: 'cursor' })
    expect(result.success).toBe(false)
  })
})

describe('env schema - base fields', () => {
  it('rejects unknown AI_PROVIDER', () => {
    const result = schema.safeParse({
      ...base,
      AI_PROVIDER: 'unknown-provider',
      GOOGLE_GENERATIVE_AI_API_KEY: 'gkey',
    })
    expect(result.success).toBe(false)
  })

  it('rejects INTERNAL_TRANSLATE_SECRET shorter than 16 chars', () => {
    const result = schema.safeParse({
      ...base,
      INTERNAL_TRANSLATE_SECRET: 'tooshort',
      AI_PROVIDER: 'gemini',
      GOOGLE_GENERATIVE_AI_API_KEY: 'gkey',
    })
    expect(result.success).toBe(false)
  })
})
```

### Step 2: Run test to verify it fails

```bash
bun test packages/translator/src/env.test.ts
```

Expected: Tests referencing `CURSOR_MODEL_VALUES` fail because current env.ts doesn't have cursor support.

### Step 3: Replace env.ts with discriminated union version

```typescript
// packages/translator/src/env.ts
import { z } from 'zod'
import {
  AI_PROVIDER_VALUES,
  GEMINI_MODEL_VALUES,
  OPENAI_MODEL_VALUES,
  CURSOR_MODEL_VALUES,
} from '@chatwork-bot/core'

const baseEnv = z.object({
  CHATWORK_API_TOKEN: z.string().min(1, 'CHATWORK_API_TOKEN is required'),
  CHATWORK_DESTINATION_ROOM_ID: z.coerce.number().int().positive(),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test', 'local']).default('development'),
  INTERNAL_TRANSLATE_SECRET: z
    .string()
    .min(16, 'INTERNAL_TRANSLATE_SECRET must be at least 16 characters'),
})

const providerUnion = z.discriminatedUnion('AI_PROVIDER', [
  z.object({
    AI_PROVIDER: z.literal('gemini'),
    AI_MODEL: z.enum(GEMINI_MODEL_VALUES).optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z
      .string()
      .min(1, 'GOOGLE_GENERATIVE_AI_API_KEY is required when AI_PROVIDER=gemini'),
  }),
  z.object({
    AI_PROVIDER: z.literal('openai'),
    AI_MODEL: z.enum(OPENAI_MODEL_VALUES).optional(),
    OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required when AI_PROVIDER=openai'),
  }),
  z.object({
    AI_PROVIDER: z.literal('cursor'),
    AI_MODEL: z.enum(CURSOR_MODEL_VALUES).or(z.string().min(1)).optional(),
    CURSOR_API_URL: z
      .string()
      .url('CURSOR_API_URL must be a valid URL')
      .refine((u) => /^https?:\/\/(localhost|127\.0\.0\.1)/.test(u), {
        message: 'CURSOR_API_URL must point to localhost or 127.0.0.1 (LOCAL DEV ONLY)',
      }),
  }),
])

const envSchema = baseEnv.and(providerUnion)

function validateEnv() {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const supported = AI_PROVIDER_VALUES.join(' | ')
    console.error('[env] Invalid environment variables:')
    console.error(`  Supported providers: ${supported}`)
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

### Step 4: Update .env.example

```bash
# .env.example (updated section)

# --- AI Provider (required) ---
# Choose one: gemini | openai | cursor
AI_PROVIDER=gemini

# --- Model (optional, provider-specific) ---
# gemini: gemini-2.5-pro | gemini-2.0-flash (default: gemini-2.5-pro)
# openai: gpt-4o | gpt-4o-mini (default: gpt-4o)
# cursor: claude-sonnet-4-5 | claude-sonnet-4-5-thinking | claude-sonnet-4-6 | claude-sonnet-4-6-thinking | gpt-4o | cursor-small (default: claude-sonnet-4-5)
#         Also accepts any custom model string as escape hatch
# AI_MODEL=gemini-2.5-pro

# --- Provider-specific keys (only required for chosen provider) ---
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-key-here
# OPENAI_API_KEY=your-openai-key-here

# --- Cursor provider (local dev only) ---
# Start cursor proxy first: node_modules/.bin/cursor-api-proxy
# Then set:
# AI_PROVIDER=cursor
# CURSOR_API_URL=http://localhost:3040

# --- Security ---
# Must be at least 16 characters
INTERNAL_TRANSLATE_SECRET=change-this-to-a-strong-secret-at-least-16-chars
```

### Step 5: Run tests to verify they pass

```bash
bun test packages/translator/src/env.test.ts
```

Expected: `14 pass, 0 fail`

### Step 6: Commit

```bash
git add packages/translator/src/env.ts packages/translator/src/env.test.ts .env.example
git commit -m "feat(translator): enforce strict discriminated union env validation with INTERNAL_TRANSLATE_SECRET"
```

---

## Task 12: Add Startup Fail-Fast Guards

**Files:**

- Create: `packages/translator/src/bootstrap/startup-guards.ts`
- Create: `packages/translator/src/bootstrap/startup-guards.test.ts`
- Modify: `packages/translator/src/index.ts`

### Step 1: Write the failing tests

```typescript
// packages/translator/src/bootstrap/startup-guards.test.ts
import { beforeEach, describe, expect, it, mock } from 'bun:test'

const mockFetch = mock((_url: string) => Promise.resolve({ ok: true }))
// @ts-expect-error — override global fetch for testing
global.fetch = mockFetch

describe('runStartupGuards', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockImplementation(() => Promise.resolve({ ok: true }))
  })

  it('passes without error when gemini provider is registered', async () => {
    const { resetProviderRegistryForTest, registerProviderPlugin } =
      await import('@chatwork-bot/core')
    resetProviderRegistryForTest()
    registerProviderPlugin({
      manifest: {
        id: 'gemini',
        supportedModels: ['m'],
        defaultModel: 'm',
        capabilities: { streaming: false },
      },
      create: () => ({ translate: () => Promise.reject(new Error('noop')) }),
    })

    const { runStartupGuards } = await import('./startup-guards')
    const fakeEnv = { AI_PROVIDER: 'gemini' }
    await expect(runStartupGuards(fakeEnv as any)).resolves.toBeUndefined()
  })

  it('throws ProviderRegistryBootError when provider not registered', async () => {
    const { resetProviderRegistryForTest, ProviderRegistryBootError } =
      await import('@chatwork-bot/core')
    resetProviderRegistryForTest()

    const { runStartupGuards } = await import('./startup-guards')
    const fakeEnv = { AI_PROVIDER: 'gemini' }
    await expect(runStartupGuards(fakeEnv as any)).rejects.toBeInstanceOf(ProviderRegistryBootError)
  })

  it('checks cursor proxy reachability when provider is cursor', async () => {
    const { resetProviderRegistryForTest, registerProviderPlugin } =
      await import('@chatwork-bot/core')
    resetProviderRegistryForTest()
    registerProviderPlugin({
      manifest: {
        id: 'cursor',
        supportedModels: ['m'],
        defaultModel: 'm',
        capabilities: { streaming: false },
      },
      create: () => ({ translate: () => Promise.reject(new Error('noop')) }),
    })

    mockFetch.mockImplementation(() => Promise.resolve({ ok: true }))

    const { runStartupGuards } = await import('./startup-guards')
    const fakeEnv = { AI_PROVIDER: 'cursor', CURSOR_API_URL: 'http://localhost:3040' }
    await expect(runStartupGuards(fakeEnv as any)).resolves.toBeUndefined()
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3040/models')
  })
})
```

### Step 2: Run test to verify it fails

```bash
bun test packages/translator/src/bootstrap/startup-guards.test.ts
```

Expected: `error: Cannot find module './startup-guards'`

### Step 3: Implement startup-guards.ts

```typescript
// packages/translator/src/bootstrap/startup-guards.ts
import { listProviderPlugins, ProviderRegistryBootError } from '@chatwork-bot/core'
import type { Env } from '~/env'

export async function runStartupGuards(
  env: Pick<Env, 'AI_PROVIDER'> & Partial<{ CURSOR_API_URL: string }>,
): Promise<void> {
  // Guard 1: provider must be registered
  const registeredIds = listProviderPlugins().map((p) => p.manifest.id)
  if (!registeredIds.includes(env.AI_PROVIDER)) {
    throw new ProviderRegistryBootError(
      `[startup] Provider '${env.AI_PROVIDER}' is not registered. Registered: [${registeredIds.join(', ')}]`,
    )
  }

  // Guard 2: cursor proxy must be reachable
  if (env.AI_PROVIDER === 'cursor') {
    const proxyUrl = env.CURSOR_API_URL ?? 'http://localhost:3040'
    const ok = await fetch(`${proxyUrl}/models`)
      .then((r) => r.ok)
      .catch(() => false)
    if (!ok) {
      console.error(
        `[startup] Cursor proxy not reachable at ${proxyUrl}\n` +
          '  Fix: Start the proxy first →  node_modules/.bin/cursor-api-proxy\n' +
          '  Then: bun run dev',
      )
      process.exit(1)
    }
  }
}
```

### Step 4: Wire startup guard into index.ts

```typescript
// In packages/translator/src/index.ts — add after registerAllProviders():
import { runStartupGuards } from '~/bootstrap/startup-guards'

// ...after registerAllProviders():
await runStartupGuards(env)
```

### Step 5: Run tests to verify they pass

```bash
bun test packages/translator/src/bootstrap/startup-guards.test.ts
```

Expected: `3 pass, 0 fail`

### Step 6: Commit

```bash
git add packages/translator/src/bootstrap/startup-guards.ts packages/translator/src/bootstrap/startup-guards.test.ts packages/translator/src/index.ts
git commit -m "feat(translator): add fail-fast startup guards with cursor proxy reachability check"
```

---

## Task 13: Add Translation Execution Policy (Timeout + Retry)

**Dependency:** Add `p-retry` to `packages/core/package.json` dependencies.

**Files:**

- Modify: `packages/core/package.json` (add `p-retry`)
- Create: `packages/core/src/services/translation-execution-policy.ts`
- Create: `packages/core/src/services/translation-execution-policy.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/translator/src/webhook/handler.ts`

### Step 1: Add p-retry to core

In `packages/core/package.json`, add to dependencies:

```json
"p-retry": "^6.2.1"
```

Then:

```bash
bun install
```

Expected: `Done`

### Step 2: Write the failing policy tests

```typescript
// packages/core/src/services/translation-execution-policy.test.ts
import { describe, expect, it, mock } from 'bun:test'
import { TranslationError } from '~/interfaces/translation'
import type { ITranslationService } from '~/interfaces/translation'

function makeService(impl: () => Promise<any>): ITranslationService {
  return { translate: mock(impl) }
}

const okResult = {
  cleanText: 'Hello',
  translatedText: 'Xin chào',
  sourceLang: 'English',
  targetLang: 'Vietnamese' as const,
  timestamp: new Date().toISOString(),
}

describe('translateWithPolicy', () => {
  async function getPolicy() {
    const { translateWithPolicy } = await import('./translation-execution-policy')
    return translateWithPolicy
  }

  it('returns result on first attempt', async () => {
    const policy = await getPolicy()
    const service = makeService(() => Promise.resolve(okResult))
    const result = await policy(service, 'Hello')
    expect(result.translatedText).toBe('Xin chào')
  })

  it('retries on API_ERROR and eventually succeeds', async () => {
    const policy = await getPolicy()
    let attempt = 0
    const service = makeService(() => {
      attempt++
      if (attempt < 3) {
        return Promise.reject(new TranslationError('transient', 'API_ERROR'))
      }
      return Promise.resolve(okResult)
    })
    const result = await policy(service, 'Hello')
    expect(result.translatedText).toBe('Xin chào')
    expect(attempt).toBe(3)
  })

  it('does not retry on QUOTA_EXCEEDED (non-transient)', async () => {
    const policy = await getPolicy()
    let attempt = 0
    const service = makeService(() => {
      attempt++
      return Promise.reject(new TranslationError('quota', 'QUOTA_EXCEEDED'))
    })
    await expect(policy(service, 'Hello')).rejects.toBeInstanceOf(TranslationError)
    expect(attempt).toBe(1)
  })

  it('does not retry on INVALID_RESPONSE (non-transient)', async () => {
    const policy = await getPolicy()
    let attempt = 0
    const service = makeService(() => {
      attempt++
      return Promise.reject(new TranslationError('bad resp', 'INVALID_RESPONSE'))
    })
    await expect(policy(service, 'Hello')).rejects.toBeInstanceOf(TranslationError)
    expect(attempt).toBe(1)
  })

  it('stops retrying after 2 retries (3 total attempts) on persistent API_ERROR', async () => {
    const policy = await getPolicy()
    let attempt = 0
    const service = makeService(() => {
      attempt++
      return Promise.reject(new TranslationError('always fails', 'API_ERROR'))
    })
    await expect(policy(service, 'Hello')).rejects.toBeInstanceOf(Error)
    expect(attempt).toBe(3)
  })
})
```

### Step 3: Run test to verify it fails

```bash
bun test packages/core/src/services/translation-execution-policy.test.ts
```

Expected: `error: Cannot find module './translation-execution-policy'`

### Step 4: Implement translation-execution-policy.ts

```typescript
// packages/core/src/services/translation-execution-policy.ts
import pRetry, { AbortError } from 'p-retry'
import type { ITranslationService, TranslationResult } from '~/interfaces/translation'
import { TranslationError } from '~/interfaces/translation'

const TIMEOUT_MS = 10_000

const RETRY_OPTIONS = {
  retries: 2, // 3 total attempts
  minTimeout: 300, // first retry: 300ms, second: 600ms
  factor: 2,
}

function isTransient(error: unknown): boolean {
  return error instanceof TranslationError && error.code === 'API_ERROR'
}

export async function translateWithPolicy(
  service: ITranslationService,
  text: string,
): Promise<TranslationResult> {
  return pRetry(
    async () => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
      try {
        return await service.translate(text)
      } finally {
        clearTimeout(timer)
      }
    },
    {
      ...RETRY_OPTIONS,
      onFailedAttempt(error) {
        if (!isTransient(error)) {
          throw new AbortError(error)
        }
      },
    },
  )
}
```

### Step 5: Export from core index

Add to `packages/core/src/index.ts`:

```typescript
export { translateWithPolicy } from './services/translation-execution-policy'
```

### Step 6: Wire policy into handler.ts

In `packages/translator/src/webhook/handler.ts`, replace the direct `service.translate(cleanText)` call:

```typescript
// Add import at top:
import { translateWithPolicy } from '@chatwork-bot/core'

// Replace: const result = await service.translate(cleanText)
// With:
const result = await translateWithPolicy(service, cleanText)
```

### Step 7: Run tests to verify they pass

```bash
bun test packages/core/src/services/translation-execution-policy.test.ts
```

Expected: `5 pass, 0 fail`

### Step 8: Commit

```bash
git add packages/core/src/services/translation-execution-policy.ts packages/core/src/services/translation-execution-policy.test.ts packages/core/package.json packages/core/src/index.ts packages/translator/src/webhook/handler.ts bun.lockb
git commit -m "feat(core): add translation execution policy with timeout and p-retry (retries: 2, minTimeout: 300ms)"
```

---

## Task 14: Secure Internal Endpoint with Shared Secret

**Files:**

- Modify: `packages/translator/src/webhook/router.ts`
- Create: `packages/translator/src/webhook/router.test.ts`

### Step 1: Write the failing route security tests

```typescript
// packages/translator/src/webhook/router.test.ts
import { describe, expect, it, mock, beforeAll } from 'bun:test'

// Mock handler to avoid real translation
void mock.module('./handler', () => ({
  handleTranslateRequest: mock(() => Promise.resolve()),
}))

// Mock env with a known secret
void mock.module('~/env', () => ({
  env: {
    CHATWORK_API_TOKEN: 'tok',
    CHATWORK_DESTINATION_ROOM_ID: 1234,
    AI_PROVIDER: 'gemini',
    AI_MODEL: 'gemini-2.5-pro',
    INTERNAL_TRANSLATE_SECRET: 'test-secret-16chars',
  },
}))

const VALID_EVENT = {
  webhook_event_type: 'mention_to_me',
  to_account_id: 1,
  webhook_event: {
    id: '1',
    body: 'hello',
    send_time: 0,
    update_time: 0,
    account_id: 2,
    room_id: 100,
  },
}

describe('POST /internal/translate', () => {
  let app: any

  beforeAll(async () => {
    const { translateRoutes } = await import('./router')
    const { Elysia } = await import('elysia')
    app = new Elysia().use(translateRoutes)
  })

  it('returns 401 when X-Internal-Secret header is missing', async () => {
    const res = await app.handle(
      new Request('http://localhost/internal/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: VALID_EVENT }),
      }),
    )
    expect(res.status).toBe(401)
  })

  it('returns 401 when X-Internal-Secret header is wrong', async () => {
    const res = await app.handle(
      new Request('http://localhost/internal/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': 'wrong-secret',
        },
        body: JSON.stringify({ event: VALID_EVENT }),
      }),
    )
    expect(res.status).toBe(401)
  })

  it('returns 200 OK when X-Internal-Secret is correct', async () => {
    const res = await app.handle(
      new Request('http://localhost/internal/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': 'test-secret-16chars',
        },
        body: JSON.stringify({ event: VALID_EVENT }),
      }),
    )
    expect(res.status).toBe(200)
  })
})
```

### Step 2: Run test to verify it fails

```bash
bun test packages/translator/src/webhook/router.test.ts
```

Expected: Current router returns 200 for all requests without auth check.

### Step 3: Update router.ts with shared-secret middleware

```typescript
// packages/translator/src/webhook/router.ts
import { timingSafeEqual } from 'crypto'
import { Elysia, t } from 'elysia'
import { ChatworkWebhookEventSchema } from '@chatwork-bot/core'
import { env } from '~/env'
import { handleTranslateRequest } from './handler'

function isValidSecret(provided: string, expected: string): boolean {
  // Length check first — avoids allocating equal-length buffers for obviously wrong secrets
  // This is safe: length is not sensitive information
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export const translateRoutes = new Elysia({ name: 'translator:webhook' })
  .derive(({ request }) => ({
    internalSecret: request.headers.get('x-internal-secret') ?? '',
  }))
  .post(
    '/internal/translate',
    ({ body, internalSecret, set }) => {
      if (!isValidSecret(internalSecret, env.INTERNAL_TRANSLATE_SECRET)) {
        set.status = 401
        return 'Unauthorized'
      }
      void handleTranslateRequest(body.event).catch((err: unknown) => {
        console.error('[router] Background handler error:', err)
      })
      return 'OK'
    },
    {
      body: t.Object({
        event: ChatworkWebhookEventSchema,
      }),
    },
  )
```

### Step 4: Run tests to verify they pass

```bash
bun test packages/translator/src/webhook/router.test.ts
```

Expected: `3 pass, 0 fail`

### Step 5: Commit

```bash
git add packages/translator/src/webhook/router.ts packages/translator/src/webhook/router.test.ts
git commit -m "feat(translator): secure /internal/translate with X-Internal-Secret header (crypto.timingSafeEqual)"
```

---

## Task 15: Add Provider Detail Health Endpoint

**Files:**

- Create: `packages/translator/src/routes/provider-health.ts`
- Create: `packages/translator/src/routes/provider-health.test.ts`
- Modify: `packages/translator/src/app.ts` (register new route)

### Step 1: Write the failing tests

```typescript
// packages/translator/src/routes/provider-health.test.ts
import { beforeAll, describe, expect, it } from 'bun:test'

describe('GET /health/provider', () => {
  let app: any

  beforeAll(async () => {
    const { resetProviderRegistryForTest, registerProviderPlugin } =
      await import('@chatwork-bot/core')
    resetProviderRegistryForTest()
    registerProviderPlugin({
      manifest: {
        id: 'gemini',
        supportedModels: ['gemini-2.5-pro'] as const,
        defaultModel: 'gemini-2.5-pro',
        capabilities: { streaming: false },
      },
      create: () => ({ translate: () => Promise.reject(new Error('noop')) }),
    })

    const { providerHealthRoute } = await import('./provider-health')
    const { Elysia } = await import('elysia')
    app = new Elysia().use(providerHealthRoute)
  })

  it('returns 200 with registered providers', async () => {
    const res = await app.handle(new Request('http://localhost/health/provider'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.providers).toBeDefined()
    expect(Array.isArray(body.providers)).toBe(true)
    expect(body.providers).toContain('gemini')
  })

  it('returns status field', async () => {
    const res = await app.handle(new Request('http://localhost/health/provider'))
    const body = await res.json()
    expect(body.status).toBe('ok')
  })
})
```

### Step 2: Run test to verify it fails

```bash
bun test packages/translator/src/routes/provider-health.test.ts
```

Expected: `error: Cannot find module './provider-health'`

### Step 3: Implement provider-health.ts

```typescript
// packages/translator/src/routes/provider-health.ts
import { Elysia } from 'elysia'
import { listProviderPlugins } from '@chatwork-bot/core'

export const providerHealthRoute = new Elysia().get('/health/provider', () => {
  const plugins = listProviderPlugins()
  return {
    status: 'ok',
    providers: plugins.map((p) => p.manifest.id),
    detail: plugins.map((p) => ({
      id: p.manifest.id,
      defaultModel: p.manifest.defaultModel,
      supportedModels: p.manifest.supportedModels,
    })),
  }
})
```

### Step 4: Register route in app.ts

Find `packages/translator/src/app.ts` and add:

```typescript
import { providerHealthRoute } from '~/routes/provider-health'

// Add .use(providerHealthRoute) to the app chain
```

### Step 5: Run tests to verify they pass

```bash
bun test packages/translator/src/routes/provider-health.test.ts
```

Expected: `2 pass, 0 fail`

### Step 6: Commit

```bash
git add packages/translator/src/routes/provider-health.ts packages/translator/src/routes/provider-health.test.ts packages/translator/src/app.ts
git commit -m "feat(translator): add GET /health/provider endpoint with registry detail"
```

---

## Task 16: Add Structured JSON Request Logging

**Files:**

- Create: `packages/translator/src/utils/request-log.ts`
- Create: `packages/translator/src/utils/request-log.test.ts`
- Modify: `packages/translator/src/webhook/handler.ts`

### Step 1: Write the failing tests

```typescript
// packages/translator/src/utils/request-log.test.ts
import { describe, expect, it, mock, spyOn } from 'bun:test'
import { logTranslationRequest } from './request-log'
import type { TranslationResult } from '@chatwork-bot/core'

describe('logTranslationRequest', () => {
  it('logs a JSON object with required fields to console.log', () => {
    const consoleSpy = spyOn(console, 'log').mockImplementation(() => {})

    const result: TranslationResult = {
      cleanText: 'Hello',
      translatedText: 'Xin chào',
      sourceLang: 'English',
      targetLang: 'Vietnamese',
      timestamp: '2026-03-06T00:00:00.000Z',
    }

    logTranslationRequest({
      requestId: 'req-123',
      provider: 'gemini',
      model: 'gemini-2.5-pro',
      latencyMs: 450,
      outcome: 'success',
      result,
    })

    expect(consoleSpy).toHaveBeenCalledTimes(1)
    const logged = JSON.parse(consoleSpy.mock.calls[0]![0] as string)
    expect(logged.requestId).toBe('req-123')
    expect(logged.provider).toBe('gemini')
    expect(logged.model).toBe('gemini-2.5-pro')
    expect(logged.latencyMs).toBe(450)
    expect(logged.outcome).toBe('success')

    consoleSpy.mockRestore()
  })

  it('includes errorCode when outcome is error', () => {
    const consoleSpy = spyOn(console, 'log').mockImplementation(() => {})

    logTranslationRequest({
      requestId: 'req-456',
      provider: 'openai',
      model: 'gpt-4o',
      latencyMs: 0,
      outcome: 'error',
      errorCode: 'API_ERROR',
    })

    const logged = JSON.parse(consoleSpy.mock.calls[0]![0] as string)
    expect(logged.outcome).toBe('error')
    expect(logged.errorCode).toBe('API_ERROR')

    consoleSpy.mockRestore()
  })
})
```

### Step 2: Run test to verify it fails

```bash
bun test packages/translator/src/utils/request-log.test.ts
```

Expected: `error: Cannot find module './request-log'`

### Step 3: Implement request-log.ts

```typescript
// packages/translator/src/utils/request-log.ts
import type { TranslationResult } from '@chatwork-bot/core'

interface TranslationLogEntry {
  requestId: string
  provider: string
  model: string
  latencyMs: number
  outcome: 'success' | 'error'
  errorCode?: string
  sourceLang?: string
  timestamp?: string
}

interface LogTranslationParams {
  requestId: string
  provider: string
  model: string
  latencyMs: number
  outcome: 'success' | 'error'
  result?: TranslationResult
  errorCode?: string
}

export function logTranslationRequest(params: LogTranslationParams): void {
  const entry: TranslationLogEntry = {
    requestId: params.requestId,
    provider: params.provider,
    model: params.model,
    latencyMs: params.latencyMs,
    outcome: params.outcome,
    sourceLang: params.result?.sourceLang,
    timestamp: params.result?.timestamp ?? new Date().toISOString(),
    ...(params.errorCode ? { errorCode: params.errorCode } : {}),
  }
  console.log(JSON.stringify(entry))
}
```

### Step 4: Wire logging into handler.ts

In `packages/translator/src/webhook/handler.ts`, add structured logging after translation:

```typescript
// Add import:
import { logTranslationRequest } from '~/utils/request-log'

// In the try block, replace result usage with:
const startMs = Date.now()
const result = await translateWithPolicy(service, cleanText)
const latencyMs = Date.now() - startMs

logTranslationRequest({
  requestId: crypto.randomUUID(),
  provider: env.AI_PROVIDER,
  model: env.AI_MODEL ?? plugin.manifest.defaultModel,
  latencyMs,
  outcome: 'success',
  result,
})
```

### Step 5: Run tests to verify they pass

```bash
bun test packages/translator/src/utils/request-log.test.ts
```

Expected: `2 pass, 0 fail`

### Step 6: Commit

```bash
git add packages/translator/src/utils/request-log.ts packages/translator/src/utils/request-log.test.ts packages/translator/src/webhook/handler.ts
git commit -m "feat(translator): add structured JSON translation request logs"
```

---

## Task 17: Remove Deprecated Legacy Code from Core

**Files:**

- Delete: `packages/core/src/services/gemini-translation.ts` (now in provider-gemini)
- Delete: `packages/core/src/services/openai-translation.ts` (now in provider-openai)
- Delete: `packages/core/src/services/translation-prompt.ts` (now in translation-prompt package)
- Delete: `packages/core/src/services/translation-factory.ts` (replaced by registry)
- Modify: `packages/core/src/index.ts` (remove old exports)

### Step 1: Run full test suite to confirm current state

```bash
bun test
```

Expected: All tests pass before cleanup.

### Step 2: Remove old exports from core index

From `packages/core/src/index.ts`, remove these lines:

```typescript
// DELETE these exports:
export { MockTranslationService } from './services/mock-translation' // keep only if used in tests
export { GeminiTranslationService } from './services/gemini-translation'
export { OpenAITranslationService } from './services/openai-translation'
export { TranslationServiceFactory } from './services/translation-factory'
```

> **Note:** Keep `MockTranslationService` only if it's used by tests outside of core. Check with `grep -r "MockTranslationService" packages/` before deleting.

### Step 3: Delete legacy service files

```bash
rm packages/core/src/services/gemini-translation.ts
rm packages/core/src/services/gemini-translation.test.ts   # now lives in provider-gemini
rm packages/core/src/services/openai-translation.ts
rm packages/core/src/services/openai-translation.test.ts   # now lives in provider-openai
rm packages/core/src/services/translation-prompt.ts        # now lives in translation-prompt package
rm packages/core/src/services/translation-factory.ts
```

### Step 4: Run full test suite again

```bash
bun test
```

Expected: All tests still pass. If anything fails, check for remaining import references.

### Step 5: Run typecheck

```bash
bun run typecheck
```

Expected: `0 errors`

### Step 6: Commit

```bash
git add -A
git commit -m "refactor(core): remove legacy provider services now replaced by plugin registry"
```

---

## Task 18: Documentation and Final Verification

**Files:**

- Modify: `CLAUDE.md` (update monorepo section + keyword trigger for provider work)
- Modify: `ai_rules/project-structure.md` (add new packages to structure diagram)
- Modify: `ai_rules/architecture-patterns.md` (document plugin registry pattern)
- Modify: `ai_rules/security.md` (add INTERNAL_TRANSLATE_SECRET and cursor dev-only warning)
- Modify: `ai_rules/commands.md` (add cursor proxy startup sequence)
- Modify: `.env.example` (verify complete and accurate)

### Step 1: Update CLAUDE.md monorepo section

Add the new packages to the monorepo diagram:

```
@chatwork-bot/translation-prompt  ←── imported by ── @chatwork-bot/provider-*
@chatwork-bot/core                ←── imported by ── @chatwork-bot/provider-*
@chatwork-bot/core                ←── imported by ── @chatwork-bot/translator
@chatwork-bot/provider-gemini     ←── registered in ── @chatwork-bot/translator
@chatwork-bot/provider-openai     ←── registered in ── @chatwork-bot/translator
@chatwork-bot/provider-cursor     ←── registered in ── @chatwork-bot/translator (LOCAL DEV ONLY)
```

### Step 2: Update ai_rules/architecture-patterns.md

Add a section "Plugin Registry Pattern":

- How to add a new provider: create `packages/provider-<name>/`, implement `ProviderPlugin`, export the plugin, register in `packages/translator/src/bootstrap/register-providers.ts`
- Never modify `TranslationServiceFactory` — it no longer exists; registry is the only path

### Step 3: Update ai_rules/security.md

Add:

- `INTERNAL_TRANSLATE_SECRET`: required, min 16 chars, used for `X-Internal-Secret` header auth on `/internal/translate`
- `cursor-api-proxy`: LOCAL DEV ONLY, pinned exact version, must not be installed in production

### Step 4: Update ai_rules/commands.md

Add cursor provider startup sequence:

```bash
# When AI_PROVIDER=cursor:
# 1. Start the cursor proxy (in a separate terminal):
node_modules/.bin/cursor-api-proxy

# 2. Start the translator server:
bun run dev
```

### Step 5: Run full quality gate

```bash
bun test && bun run typecheck && bun run lint
```

Expected: `PASS` across all packages

### Step 6: Run standards verification

```bash
bun run verify:standards
```

Expected: All packages have `lint`, `lint:fix`, `format`, `typecheck`, `test` scripts.

### Step 7: Final commit

```bash
git add CLAUDE.md ai_rules docs .env.example
git commit -m "docs(repo): update architecture rules, security docs, and runbook for plugin registry"
```

---

## PR Batching Plan

| PR      | Contents                                                                                                            | Tasks      |
| ------- | ------------------------------------------------------------------------------------------------------------------- | ---------- |
| **PR1** | Registry infra + contracts + type domains                                                                           | Tasks 1–3  |
| **PR2** | `translation-prompt` package + provider package scaffolding + Gemini/OpenAI/Cursor plugins                          | Tasks 4–8  |
| **PR3** | Translator wiring: bootstrap, registry resolution, env, startup guards, retry, auth, health, logging, cleanup, docs | Tasks 9–18 |

Each PR must pass before merging:

```bash
bun test && bun run typecheck && bun run lint
```

---

## Acceptance Criteria

- [ ] `bun run dev` remains the local runtime command (unchanged)
- [ ] Provider and model are validated as a strict pair by `z.discriminatedUnion` — wrong pair causes startup exit with human-readable error
- [ ] Unknown provider causes typed `ProviderRegistryBootError` at startup with actionable message listing supported providers
- [ ] Translation execution uses 10s timeout + 2 retries (3 attempts) for transient `API_ERROR` only — no retry for `QUOTA_EXCEEDED`/`INVALID_RESPONSE`
- [ ] `/internal/translate` is protected by `X-Internal-Secret` header checked with `crypto.timingSafeEqual`
- [ ] `/health` remains basic alive check; `/health/provider` returns registry detail
- [ ] Structured JSON logs include `requestId`, `provider`, `model`, `latencyMs`, `outcome`, `sourceLang`, `timestamp`
- [ ] All 4 new packages (`translation-prompt`, `provider-gemini`, `provider-openai`, `provider-cursor`) pass `bun run verify:standards`
- [ ] Legacy `GeminiTranslationService`, `OpenAITranslationService`, `TranslationServiceFactory` removed from core
- [ ] `bun test && bun run typecheck && bun run lint` passes across all packages
