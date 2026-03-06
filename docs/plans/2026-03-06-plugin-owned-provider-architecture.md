# Plugin-Owned Provider Architecture — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Decouple provider/model definitions from `@chatwork-bot/core` so each provider package owns its model list, env keys, and capabilities — enabling zero-core-change provider additions.

**Architecture:** Move model value arrays from `core/types/ai.ts` into each provider package. Simplify `env.ts` to a flat schema. Add startup guards for env key and model validation. Add startup banner showing all providers/models in table format.

**Tech Stack:** Bun 1.1+, TypeScript 5.4+ strict, Zod, Elysia

---

## Task 1: Extend ProviderManifest with requiredEnvKeys

Non-breaking additive change. All existing manifests will need updating but nothing breaks until we use the new field.

**Files:**

- Modify: `packages/core/src/interfaces/provider-plugin.ts`
- Test: `packages/core/src/interfaces/provider-plugin.test.ts`

**Step 1: Update the interface**

In `packages/core/src/interfaces/provider-plugin.ts`, add `requiredEnvKeys` to `ProviderManifest`:

```typescript
export interface ProviderManifest {
  readonly id: string
  readonly supportedModels: readonly string[]
  readonly defaultModel: string
  readonly capabilities: {
    readonly streaming: boolean
  }
  readonly timeoutMs?: number
  readonly requiredEnvKeys: readonly string[]
}
```

**Step 2: Update the contract test**

In `packages/core/src/interfaces/provider-plugin.test.ts`, add `requiredEnvKeys: []` to the test fixture so it conforms to the updated interface.

**Step 3: Run test to verify**

Run: `bun test packages/core/src/interfaces/provider-plugin.test.ts`
Expected: PASS

**Step 4: Fix all provider plugins that now fail typecheck**

Add `requiredEnvKeys` to every plugin manifest:

- `packages/provider-gemini/src/gemini-plugin.ts`: `requiredEnvKeys: ['GOOGLE_GENERATIVE_AI_API_KEY']`
- `packages/provider-openai/src/openai-plugin.ts`: `requiredEnvKeys: ['OPENAI_API_KEY']`
- `packages/provider-cursor/src/cursor-plugin.ts`: `requiredEnvKeys: ['CURSOR_API_URL']`

Also update `packages/translator/src/bootstrap/startup-guards.test.ts` — the mock manifests need `requiredEnvKeys: []`.

**Step 5: Run full typecheck + tests**

Run: `bun run typecheck && bun test`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add -A
git commit -m "feat(core): add requiredEnvKeys to ProviderManifest interface"
```

---

## Task 2: Move model values from core to provider packages

Move `GEMINI_MODEL_VALUES`, `OPENAI_MODEL_VALUES`, `CURSOR_MODEL_VALUES` and their defaults out of `core/types/ai.ts` into each respective provider package.

**Files:**

- Modify: `packages/provider-gemini/src/gemini-plugin.ts` — define model values locally
- Modify: `packages/provider-openai/src/openai-plugin.ts` — define model values locally
- Modify: `packages/provider-cursor/src/cursor-plugin.ts` — define expanded model values locally
- Modify: `packages/provider-gemini/src/index.ts` — export model values
- Modify: `packages/provider-openai/src/index.ts` — export model values
- Modify: `packages/provider-cursor/src/index.ts` — export model values

**Step 1: Add model values to gemini-plugin.ts**

At the top of `packages/provider-gemini/src/gemini-plugin.ts`, add (before the class):

```typescript
export const GEMINI_MODEL_VALUES = ['gemini-2.5-pro', 'gemini-2.0-flash'] as const
export type GeminiModel = (typeof GEMINI_MODEL_VALUES)[number]
export const DEFAULT_GEMINI_MODEL: GeminiModel = 'gemini-2.5-pro'
```

Remove the imports of `GEMINI_MODEL_VALUES` and `DEFAULT_GEMINI_MODEL` from `@chatwork-bot/core`.

Update `packages/provider-gemini/src/index.ts` to also export these:

```typescript
export { geminiPlugin, GEMINI_MODEL_VALUES, DEFAULT_GEMINI_MODEL } from './gemini-plugin'
export type { GeminiModel } from './gemini-plugin'
```

**Step 2: Add model values to openai-plugin.ts**

Same pattern. At the top of `packages/provider-openai/src/openai-plugin.ts`:

```typescript
export const OPENAI_MODEL_VALUES = ['gpt-4o', 'gpt-4o-mini'] as const
export type OpenAIModel = (typeof OPENAI_MODEL_VALUES)[number]
export const DEFAULT_OPENAI_MODEL: OpenAIModel = 'gpt-4o'
```

Remove the imports from `@chatwork-bot/core`.

Update `packages/provider-openai/src/index.ts`:

```typescript
export { openaiPlugin, OPENAI_MODEL_VALUES, DEFAULT_OPENAI_MODEL } from './openai-plugin'
export type { OpenAIModel } from './openai-plugin'
```

**Step 3: Add expanded model values to cursor-plugin.ts**

At the top of `packages/provider-cursor/src/cursor-plugin.ts`, replace old imports with local definitions:

```typescript
export const CURSOR_MODEL_VALUES = [
  // Anthropic
  'claude-sonnet-4',
  'claude-sonnet-4-5',
  'claude-sonnet-4-5-thinking',
  'claude-sonnet-4-6',
  'claude-sonnet-4-6-thinking',
  'claude-opus-4-5',
  'claude-opus-4-5-thinking',
  'claude-opus-4-6',
  'claude-opus-4-6-thinking',
  // Google
  'gemini-2.5-flash',
  'gemini-3-flash',
  'gemini-3-pro',
  // OpenAI
  'gpt-5.2',
  'gpt-5.3-codex',
  // Cursor own
  'composer-1',
  'composer-1.5',
  'cursor-small',
] as const
export type CursorModel = (typeof CURSOR_MODEL_VALUES)[number]
export const DEFAULT_CURSOR_MODEL: CursorModel = 'claude-sonnet-4-5'
```

Remove the imports of `CURSOR_MODEL_VALUES` and `DEFAULT_CURSOR_MODEL` from `@chatwork-bot/core`.

Update `packages/provider-cursor/src/index.ts`:

```typescript
export { cursorPlugin, CURSOR_MODEL_VALUES, DEFAULT_CURSOR_MODEL } from './cursor-plugin'
export type { CursorModel } from './cursor-plugin'
export { CursorTranslationService } from './cursor-translation'
export { extractJsonFromText } from './extract-json'
```

**Step 4: Run typecheck to see remaining references to old core exports**

Run: `bun run typecheck`
Expected: Errors in `core/index.ts`, `env.ts`, and `env.test.ts` (they still import from core). These will be fixed in later tasks. Provider packages should be clean.

**Step 5: Commit (providers only)**

```bash
git add packages/provider-*/
git commit -m "refactor(core): move model values from core to provider packages"
```

---

## Task 3: Replace core/types/ai.ts with branded AIProvider type

Remove provider-specific model values from core. Replace with a minimal branded type.

**Files:**

- Rewrite: `packages/core/src/types/ai.ts`
- Modify: `packages/core/src/index.ts`
- Delete: `packages/core/src/types/ai.test.ts` (tests move to provider packages)

**Step 1: Rewrite ai.ts**

Replace the entire content of `packages/core/src/types/ai.ts` with:

```typescript
export type AIProvider = string & { readonly __brand: 'AIProvider' }

export function toAIProvider(value: string): AIProvider {
  return value as AIProvider
}
```

**Step 2: Update core/index.ts exports**

Replace the old ai.ts export block:

```typescript
export type { AIProvider, GeminiModel, OpenAIModel, CursorModel } from './types/ai'
export {
  AI_PROVIDER_VALUES,
  GEMINI_MODEL_VALUES,
  // ...
} from './types/ai'
```

With:

```typescript
export type { AIProvider } from './types/ai'
export { toAIProvider } from './types/ai'
```

**Step 3: Delete the old ai.test.ts**

Delete `packages/core/src/types/ai.test.ts` — the tests there asserted provider-specific model values that are now owned by each provider package.

**Step 4: Run typecheck**

Run: `bun run typecheck`
Expected: Errors in `translator/env.ts`, `translator/env.test.ts` (they import old values from core). These are expected and fixed in next tasks.

**Step 5: Commit**

```bash
git add packages/core/
git commit -m "refactor(core): replace provider-specific types with branded AIProvider"
```

---

## Task 4: Simplify env.ts to flat schema

Remove the Zod discriminatedUnion. env.ts will only validate base fields, AI_PROVIDER as a string, and AI_MODEL as an optional string.

**Files:**

- Rewrite: `packages/translator/src/env.ts`
- Rewrite: `packages/translator/src/env.test.ts`

**Step 1: Write the new env.test.ts**

Replace `packages/translator/src/env.test.ts` with tests for the flat schema:

```typescript
import { describe, expect, it } from 'bun:test'
import { z } from 'zod'

const envSchema = z.object({
  CHATWORK_API_TOKEN: z.string().min(1),
  CHATWORK_DESTINATION_ROOM_ID: z.coerce.number().int().positive(),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test', 'local']).default('development'),
  AI_PROVIDER: z.string().min(1, 'AI_PROVIDER is required'),
  AI_MODEL: z.string().min(1).optional(),
})

const base = {
  CHATWORK_API_TOKEN: 'tok-123',
  CHATWORK_DESTINATION_ROOM_ID: '12345',
}

describe('env schema - flat', () => {
  it('accepts valid config with AI_PROVIDER only', () => {
    const result = envSchema.safeParse({ ...base, AI_PROVIDER: 'gemini' })
    expect(result.success).toBe(true)
  })

  it('accepts config with AI_PROVIDER and AI_MODEL', () => {
    const result = envSchema.safeParse({
      ...base,
      AI_PROVIDER: 'openai',
      AI_MODEL: 'gpt-4o',
    })
    expect(result.success).toBe(true)
  })

  it('accepts any string as AI_PROVIDER', () => {
    const result = envSchema.safeParse({ ...base, AI_PROVIDER: 'groq' })
    expect(result.success).toBe(true)
  })

  it('rejects missing AI_PROVIDER', () => {
    const result = envSchema.safeParse(base)
    expect(result.success).toBe(false)
  })

  it('rejects empty AI_PROVIDER', () => {
    const result = envSchema.safeParse({ ...base, AI_PROVIDER: '' })
    expect(result.success).toBe(false)
  })

  it('applies default PORT and NODE_ENV', () => {
    const result = envSchema.safeParse({ ...base, AI_PROVIDER: 'gemini' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.PORT).toBe(3000)
      expect(result.data.NODE_ENV).toBe('development')
    }
  })

  it('rejects missing CHATWORK_API_TOKEN', () => {
    const result = envSchema.safeParse({
      CHATWORK_DESTINATION_ROOM_ID: '12345',
      AI_PROVIDER: 'gemini',
    })
    expect(result.success).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails (env.ts not updated yet)**

Run: `bun test packages/translator/src/env.test.ts`
Expected: Tests should fail or error because old env.ts exports don't match.

**Step 3: Rewrite env.ts**

Replace `packages/translator/src/env.ts` with:

```typescript
import { z } from 'zod'

const envSchema = z.object({
  CHATWORK_API_TOKEN: z.string().min(1, 'CHATWORK_API_TOKEN is required'),
  CHATWORK_DESTINATION_ROOM_ID: z.coerce.number().int().positive(),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test', 'local']).default('development'),
  AI_PROVIDER: z.string().min(1, 'AI_PROVIDER is required'),
  AI_MODEL: z.string().min(1).optional(),
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

**Step 4: Run test**

Run: `bun test packages/translator/src/env.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add packages/translator/src/env.ts packages/translator/src/env.test.ts
git commit -m "refactor(translator): simplify env.ts to flat schema"
```

---

## Task 5: Add provider env key and model validation to startup guards

Add two new guards: `validateProviderEnvKeys` checks that required env keys are present, and `validateModelSelection` checks the chosen model against the provider's supported list (with escape hatch warning).

**Files:**

- Modify: `packages/translator/src/bootstrap/startup-guards.ts`
- Modify: `packages/translator/src/bootstrap/startup-guards.test.ts`

**Step 1: Write failing tests for new guards**

Add these tests to `packages/translator/src/bootstrap/startup-guards.test.ts`:

```typescript
it('throws when required env key is missing for active provider', async () => {
  const { resetProviderRegistryForTest, registerProviderPlugin, ProviderRegistryBootError } =
    await import('@chatwork-bot/core')
  resetProviderRegistryForTest()
  registerProviderPlugin({
    manifest: {
      id: 'gemini',
      supportedModels: ['gemini-2.5-pro'],
      defaultModel: 'gemini-2.5-pro',
      capabilities: { streaming: false },
      requiredEnvKeys: ['GOOGLE_GENERATIVE_AI_API_KEY'],
    },
    create: () => ({ translate: () => Promise.reject(new Error('noop')) }),
  })

  delete process.env['GOOGLE_GENERATIVE_AI_API_KEY']
  const { runStartupGuards } = await import('./startup-guards')
  const fakeEnv = { AI_PROVIDER: 'gemini' }

  try {
    await runStartupGuards(fakeEnv as never)
    expect.unreachable('should have thrown')
  } catch (error) {
    expect(error).toBeInstanceOf(ProviderRegistryBootError)
    expect((error as Error).message).toContain('GOOGLE_GENERATIVE_AI_API_KEY')
  }
})

it('logs warning when AI_MODEL is not in supportedModels (escape hatch)', async () => {
  const { resetProviderRegistryForTest, registerProviderPlugin } =
    await import('@chatwork-bot/core')
  resetProviderRegistryForTest()
  registerProviderPlugin({
    manifest: {
      id: 'gemini',
      supportedModels: ['gemini-2.5-pro'],
      defaultModel: 'gemini-2.5-pro',
      capabilities: { streaming: false },
      requiredEnvKeys: [],
    },
    create: () => ({ translate: () => Promise.reject(new Error('noop')) }),
  })

  const warnSpy = mock(() => {})
  console.warn = warnSpy

  const { runStartupGuards } = await import('./startup-guards')
  const fakeEnv = { AI_PROVIDER: 'gemini', AI_MODEL: 'custom-model-xyz' }
  await runStartupGuards(fakeEnv as never)

  expect(warnSpy).toHaveBeenCalled()
  const msg = warnSpy.mock.calls[0]?.[0] as string
  expect(msg).toContain('custom-model-xyz')
  expect(msg).toContain('gemini-2.5-pro')
})
```

**Step 2: Run tests to verify they fail**

Run: `bun test packages/translator/src/bootstrap/startup-guards.test.ts`
Expected: FAIL (new tests)

**Step 3: Implement the new guards**

Rewrite `packages/translator/src/bootstrap/startup-guards.ts`:

```typescript
import {
  getProviderPlugin,
  listProviderPlugins,
  ProviderRegistryBootError,
} from '@chatwork-bot/core'

interface StartupEnv {
  AI_PROVIDER: string
  AI_MODEL?: string
}

export async function runStartupGuards(env: StartupEnv): Promise<void> {
  const registeredIds = listProviderPlugins().map((p) => p.manifest.id)
  if (!registeredIds.includes(env.AI_PROVIDER)) {
    throw new ProviderRegistryBootError(
      `[startup] Provider '${env.AI_PROVIDER}' is not registered. Registered: [${registeredIds.join(', ')}]`,
    )
  }

  const plugin = getProviderPlugin(env.AI_PROVIDER)

  const missingKeys = plugin.manifest.requiredEnvKeys.filter(
    (key) => !process.env[key] || process.env[key] === '',
  )
  if (missingKeys.length > 0) {
    throw new ProviderRegistryBootError(
      `[startup] Provider '${env.AI_PROVIDER}' requires env: ${missingKeys.join(', ')}`,
    )
  }

  if (
    env.AI_MODEL &&
    !(plugin.manifest.supportedModels as readonly string[]).includes(env.AI_MODEL)
  ) {
    const supported = plugin.manifest.supportedModels.join(', ')
    console.warn(
      `[startup] ⚠ Model '${env.AI_MODEL}' not in ${env.AI_PROVIDER}'s supported list [${supported}]. Proceeding anyway (escape hatch).`,
    )
  }

  if (env.AI_PROVIDER === 'cursor') {
    const proxyUrl = process.env['CURSOR_API_URL'] ?? 'http://localhost:8765/v1'
    const ok = await fetch(`${proxyUrl}/models`)
      .then((r) => r.ok)
      .catch(() => false)
    if (!ok) {
      console.error(
        `[startup] Cursor proxy not reachable at ${proxyUrl}\n` +
          '  Fix: Start the proxy first →  bun run cursor-proxy\n' +
          '  Then: bun run dev',
      )
      process.exit(1)
    }
  }
}
```

**Step 4: Update existing tests**

Add `requiredEnvKeys: []` to all mock manifests in the existing tests. Update the `StartupEnv` type usage — the function now accepts `{ AI_PROVIDER: string; AI_MODEL?: string }` instead of `Pick<Env, 'AI_PROVIDER'> & Partial<{ CURSOR_API_URL: string }>`.

**Step 5: Run tests**

Run: `bun test packages/translator/src/bootstrap/startup-guards.test.ts`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add packages/translator/src/bootstrap/
git commit -m "feat(translator): add env key and model validation to startup guards"
```

---

## Task 6: Create startup banner

Create a new module that logs a table of all registered providers, their models, defaults, and timeouts.

**Files:**

- Create: `packages/translator/src/bootstrap/startup-banner.ts`
- Create: `packages/translator/src/bootstrap/startup-banner.test.ts`
- Modify: `packages/translator/src/index.ts` — call banner after guards

**Step 1: Write the test**

Create `packages/translator/src/bootstrap/startup-banner.test.ts`:

```typescript
import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { resetProviderRegistryForTest, registerProviderPlugin } from '@chatwork-bot/core'

describe('logStartupBanner', () => {
  const logSpy = mock((..._args: unknown[]) => {})

  beforeEach(() => {
    resetProviderRegistryForTest()
    logSpy.mockReset()
    console.log = logSpy
  })

  it('logs table with provider info', async () => {
    registerProviderPlugin({
      manifest: {
        id: 'gemini',
        supportedModels: ['gemini-2.5-pro', 'gemini-2.0-flash'],
        defaultModel: 'gemini-2.5-pro',
        capabilities: { streaming: false },
        requiredEnvKeys: ['GOOGLE_GENERATIVE_AI_API_KEY'],
      },
      create: () => ({ translate: () => Promise.reject(new Error('noop')) }),
    })

    const { logStartupBanner } = await import('./startup-banner')
    logStartupBanner({
      provider: 'gemini',
      model: 'gemini-2.5-pro',
      port: 3000,
      nodeEnv: 'development',
    })

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n')
    expect(output).toContain('gemini')
    expect(output).toContain('gemini-2.5-pro')
    expect(output).toContain('gemini-2.0-flash')
  })

  it('marks active provider with asterisk', async () => {
    registerProviderPlugin({
      manifest: {
        id: 'gemini',
        supportedModels: ['gemini-2.5-pro'],
        defaultModel: 'gemini-2.5-pro',
        capabilities: { streaming: false },
        requiredEnvKeys: [],
      },
      create: () => ({ translate: () => Promise.reject(new Error('noop')) }),
    })

    const { logStartupBanner } = await import('./startup-banner')
    logStartupBanner({
      provider: 'gemini',
      model: 'gemini-2.5-pro',
      port: 3000,
      nodeEnv: 'development',
    })

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n')
    expect(output).toContain('*')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/translator/src/bootstrap/startup-banner.test.ts`
Expected: FAIL (module does not exist)

**Step 3: Implement startup-banner.ts**

Create `packages/translator/src/bootstrap/startup-banner.ts`:

```typescript
import { listProviderPlugins } from '@chatwork-bot/core'

interface BannerConfig {
  provider: string
  model: string
  port: number
  nodeEnv: string
}

export function logStartupBanner(config: BannerConfig): void {
  const plugins = listProviderPlugins()
  const defaultTimeoutMs = 10_000

  const rows = plugins.map((p) => {
    const isActive = p.manifest.id === config.provider
    const provider = isActive ? `${p.manifest.id} *` : p.manifest.id
    const models = p.manifest.supportedModels.join(', ')
    const timeout = `${((p.manifest.timeoutMs ?? defaultTimeoutMs) / 1000).toString()}s`
    return { provider, models, default: p.manifest.defaultModel, timeout }
  })

  const col = {
    provider: Math.max(8, ...rows.map((r) => r.provider.length)),
    models: Math.max(16, ...rows.map((r) => Math.min(r.models.length, 40))),
    default: Math.max(7, ...rows.map((r) => r.default.length)),
    timeout: Math.max(7, ...rows.map((r) => r.timeout.length)),
  }

  const pad = (s: string, w: number) => (s.length > w ? s.slice(0, w - 1) + '…' : s.padEnd(w))
  const sep = `├${'─'.repeat(col.provider + 2)}┼${'─'.repeat(col.models + 2)}┼${'─'.repeat(col.default + 2)}┼${'─'.repeat(col.timeout + 2)}┤`
  const top = `┌${'─'.repeat(col.provider + 2)}┬${'─'.repeat(col.models + 2)}┬${'─'.repeat(col.default + 2)}┬${'─'.repeat(col.timeout + 2)}┐`
  const bot = `└${'─'.repeat(col.provider + 2)}┴${'─'.repeat(col.models + 2)}┴${'─'.repeat(col.default + 2)}┴${'─'.repeat(col.timeout + 2)}┘`
  const row = (a: string, b: string, c: string, d: string) =>
    `│ ${pad(a, col.provider)} │ ${pad(b, col.models)} │ ${pad(c, col.default)} │ ${pad(d, col.timeout)} │`

  console.log(`[translator] ${top}`)
  console.log(`[translator] ${row('Provider', 'Supported Models', 'Default', 'Timeout')}`)
  console.log(`[translator] ${sep}`)
  for (const r of rows) {
    console.log(`[translator] ${row(r.provider, r.models, r.default, r.timeout)}`)
  }
  console.log(`[translator] ${bot}`)
  console.log(
    `[translator] * = active provider (AI_PROVIDER=${config.provider}, AI_MODEL=${config.model})`,
  )
}
```

**Step 4: Run test**

Run: `bun test packages/translator/src/bootstrap/startup-banner.test.ts`
Expected: ALL PASS

**Step 5: Integrate into index.ts**

In `packages/translator/src/index.ts`, add the banner call. Replace the old manual console.log lines:

```typescript
import { env } from './env'
import { getProviderPlugin } from '@chatwork-bot/core'
import { registerAllProviders } from '~/bootstrap/register-providers'
import { runStartupGuards } from '~/bootstrap/startup-guards'
import { logStartupBanner } from '~/bootstrap/startup-banner'
import { createServer } from './server'

registerAllProviders()
await runStartupGuards(env)

const activePlugin = getProviderPlugin(env.AI_PROVIDER)
const activeModel = env.AI_MODEL ?? activePlugin.manifest.defaultModel

const server = createServer()
server.listen(env.PORT)

console.log(`[translator] AI Translation Service started on port ${env.PORT.toString()}`)
logStartupBanner({
  provider: env.AI_PROVIDER,
  model: activeModel,
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
})
console.log(`[translator] Health check: http://localhost:${env.PORT.toString()}/health`)
console.log(
  `[translator] Internal endpoint: http://localhost:${env.PORT.toString()}/internal/translate`,
)
if (env.NODE_ENV === 'development') {
  console.log(`[translator] Swagger UI: http://localhost:${env.PORT.toString()}/docs`)
}

function shutdown() {
  console.log('\n[translator] Shutting down gracefully...')
  void server.stop()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
```

**Step 6: Commit**

```bash
git add packages/translator/src/bootstrap/startup-banner.ts packages/translator/src/bootstrap/startup-banner.test.ts packages/translator/src/index.ts
git commit -m "feat(translator): add startup banner showing providers and models table"
```

---

## Task 7: Update remaining tests and fix router.test.ts

Update tests that still reference old core exports or old env shape.

**Files:**

- Modify: `packages/translator/src/webhook/router.test.ts` — update mocked env shape
- Modify: `packages/translator/src/webhook/handler.ts` — update env usage if needed
- Modify: `packages/provider-cursor/src/cursor-plugin.test.ts` — update model assertions
- Modify: `packages/translator/src/routes/provider-health.ts` — enhance response

**Step 1: Update router.test.ts mock env**

The mocked env in `router.test.ts` currently uses the old shape. Remove `OPENAI_API_KEY` reference if present and ensure env mock has the flat shape:

```typescript
void mock.module('../env', () => ({
  env: {
    AI_PROVIDER: 'openai',
    AI_MODEL: 'gpt-4o',
    PORT: 3000,
    NODE_ENV: 'test',
    CHATWORK_API_TOKEN: 'test-token',
    CHATWORK_DESTINATION_ROOM_ID: 99999,
  },
}))
```

(This mock already matches the flat schema, so it should work as-is.)

**Step 2: Update cursor-plugin.test.ts model assertions**

Update tests that assert on `CURSOR_MODEL_VALUES` to include the new expanded model list.

**Step 3: Enhance provider-health.ts**

Update `packages/translator/src/routes/provider-health.ts` to include `requiredEnvKeys`, `timeoutMs`, and `capabilities`:

```typescript
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
      capabilities: p.manifest.capabilities,
      timeoutMs: p.manifest.timeoutMs ?? null,
      requiredEnvKeys: p.manifest.requiredEnvKeys,
    })),
  }
})
```

**Step 4: Run all tests**

Run: `bun test`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor(translator): update tests and enhance provider health endpoint"
```

---

## Task 8: Update .env.example and documentation

Update `.env.example` to reflect the new architecture and update `ai_rules/architecture-patterns.md`.

**Files:**

- Modify: `.env.example`
- Modify: `ai_rules/architecture-patterns.md`
- Modify: `ai_rules/security.md` (if it references old env validation)

**Step 1: Update .env.example**

Simplify the model comments to reference the startup banner:

```env
# --- AI Provider (required) ---
# Registered providers are listed in the startup banner when server starts.
# Currently available: gemini | openai | cursor
AI_PROVIDER=gemini

# --- Model (optional) ---
# If not set, uses the provider's default model.
# Run the server to see supported models per provider in the startup banner.
# Any string is accepted (escape hatch) — unsupported models log a warning.
# AI_MODEL=gemini-2.5-pro
```

**Step 2: Update architecture-patterns.md**

Add a section about the Plugin-Owned Provider Architecture if not present. Reference `docs/plans/2026-03-06-plugin-owned-provider-architecture-design.md`.

**Step 3: Run full validation**

Run: `bun test && bun run typecheck && bun run lint`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add .env.example ai_rules/
git commit -m "docs(repo): update env example and architecture docs for plugin-owned providers"
```

---

## Task 9: Final verification

Run the full Definition of Done check.

**Step 1: Run all checks**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: ALL PASS, 0 failures

**Step 2: Verify startup banner works (manual)**

```bash
bun run dev
```

Expected: Server starts, table banner appears showing all 3 providers with models.

**Step 3: Verify /health/provider endpoint**

```bash
curl -s http://localhost:3000/health/provider | bun -e "console.log(JSON.stringify(JSON.parse(await Bun.stdin.text()), null, 2))"
```

Expected: JSON with `detail` array containing `requiredEnvKeys`, `capabilities`, `timeoutMs` for each provider.
