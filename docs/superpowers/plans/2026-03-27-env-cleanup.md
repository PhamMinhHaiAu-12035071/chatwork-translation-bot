# Env Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove 7 obsolete global env vars, sync `.env` structure with `.env.example`, add 3 undocumented optional vars, and delete the `requiredEnvKeys` field from `ProviderManifest` interface across all usages.

**Architecture:** TypeScript strict mode is the safety net — removing `requiredEnvKeys` from the interface immediately surfaces every remaining reference as a compile error. Fix interface first, then downstream files, then env files. All changes are deletions or additions of fields/lines with no behavior change.

**Tech Stack:** Bun v1.1+, TypeScript 5.4+ strict, bun:test

---

## File Map

| File                                                       | Change                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| `packages/core/src/interfaces/provider-plugin.ts`          | Remove `requiredEnvKeys` field from `ProviderManifest` interface         |
| `packages/core/src/interfaces/provider-plugin.test.ts`     | Remove field from manifest fixture                                       |
| `packages/core/src/services/provider-registry.test.ts`     | Remove field from `makePlugin()` fixture                                 |
| `packages/provider-openai/src/openai-plugin.ts`            | Remove field from manifest object                                        |
| `packages/provider-gemini/src/gemini-plugin.ts`            | Remove field from manifest object                                        |
| `packages/provider-cursor/src/cursor-plugin.ts`            | Remove field from manifest object                                        |
| `packages/translator/src/routes/provider-health.ts`        | Remove field from response shape                                         |
| `packages/translator/src/routes/provider-health.test.ts`   | Remove field from fixture + response assertion                           |
| `packages/translator/src/bootstrap/startup-banner.test.ts` | Remove field from 3 fixtures                                             |
| `.env.example`                                             | Add 3 optional vars in correct sections                                  |
| `.env`                                                     | Full rewrite: remove 7 obsolete vars, add 2 missing vars, sync structure |

---

## Task 1: Remove `requiredEnvKeys` from ProviderManifest interface

**Files:**

- Modify: `packages/core/src/interfaces/provider-plugin.ts`

- [ ] **Step 1: Remove field from interface**

Edit `packages/core/src/interfaces/provider-plugin.ts`. Remove the `requiredEnvKeys` line:

```typescript
import type { ILLMExecutor } from './llm-executor'

export interface ProviderCreateContext {
  modelId: string
  apiKey?: string
  baseUrl?: string
}

export interface ProviderManifest {
  readonly id: string
  readonly supportedModels: readonly string[]
  readonly defaultModel: string
  readonly capabilities: {
    readonly streaming: boolean
  }
  readonly timeoutMs?: number
}

export interface ProviderPlugin {
  readonly manifest: ProviderManifest
  create(ctx: ProviderCreateContext): ILLMExecutor
}
```

- [ ] **Step 2: Run typecheck to see all downstream errors**

```bash
cd packages/core && bun run typecheck
```

Expected: errors in `provider-plugin.test.ts` and `provider-registry.test.ts` referencing `requiredEnvKeys`. This is correct — TypeScript is guiding the cleanup.

---

## Task 2: Fix core test fixtures

**Files:**

- Modify: `packages/core/src/interfaces/provider-plugin.test.ts`
- Modify: `packages/core/src/services/provider-registry.test.ts`

- [ ] **Step 1: Remove `requiredEnvKeys` from `provider-plugin.test.ts`**

Edit `packages/core/src/interfaces/provider-plugin.test.ts`. The manifest fixture at line 7 becomes:

```typescript
const manifest: ProviderManifest = {
  id: 'test-provider',
  supportedModels: ['model-a', 'model-b'] as const,
  defaultModel: 'model-a',
  capabilities: { streaming: false },
}
```

- [ ] **Step 2: Remove `requiredEnvKeys` from `provider-registry.test.ts`**

Edit `packages/core/src/services/provider-registry.test.ts`. The `makePlugin()` helper at line 11 becomes:

```typescript
function makePlugin(id: string): ProviderPlugin {
  return {
    manifest: {
      id,
      supportedModels: ['model-x'] as const,
      defaultModel: 'model-x',
      capabilities: { streaming: false },
    },
    create: () => ({ execute: () => Promise.reject(new Error('not implemented')) }),
  }
}
```

- [ ] **Step 3: Run core tests**

```bash
cd packages/core && bun test
```

Expected: all tests pass.

- [ ] **Step 4: Run typecheck on core**

```bash
cd packages/core && bun run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/interfaces/provider-plugin.ts \
        packages/core/src/interfaces/provider-plugin.test.ts \
        packages/core/src/services/provider-registry.test.ts
git commit -m "refactor(core): remove requiredEnvKeys from ProviderManifest interface"
```

---

## Task 3: Remove `requiredEnvKeys` from provider plugins

**Files:**

- Modify: `packages/provider-openai/src/openai-plugin.ts`
- Modify: `packages/provider-gemini/src/gemini-plugin.ts`
- Modify: `packages/provider-cursor/src/cursor-plugin.ts`

- [ ] **Step 1: Remove from openai-plugin.ts**

Edit `packages/provider-openai/src/openai-plugin.ts`. The manifest object at line 96 becomes:

```typescript
export const openaiPlugin: ProviderPlugin = {
  manifest: {
    id: 'openai',
    supportedModels: OPENAI_MODEL_VALUES,
    defaultModel: DEFAULT_OPENAI_MODEL,
    capabilities: { streaming: false },
    timeoutMs: DEFAULT_OPENAI_TIMEOUT_MS,
  },
  create(ctx: ProviderCreateContext): ILLMExecutor {
    return new OpenAIExecutor(ctx.modelId, ctx.apiKey, ctx.baseUrl)
  },
}
```

- [ ] **Step 2: Remove from gemini-plugin.ts**

Edit `packages/provider-gemini/src/gemini-plugin.ts`. The manifest object at line 100 becomes:

```typescript
export const geminiPlugin: ProviderPlugin = {
  manifest: {
    id: 'gemini',
    supportedModels: GEMINI_MODEL_VALUES,
    defaultModel: DEFAULT_GEMINI_MODEL,
    capabilities: { streaming: false },
    timeoutMs: DEFAULT_GEMINI_TIMEOUT_MS,
  },
  create(ctx: ProviderCreateContext): ILLMExecutor {
    return new GeminiExecutor(ctx.modelId, ctx.apiKey)
  },
}
```

- [ ] **Step 3: Remove from cursor-plugin.ts**

Edit `packages/provider-cursor/src/cursor-plugin.ts`. The manifest object becomes:

```typescript
export const cursorPlugin: ProviderPlugin = {
  manifest: {
    id: 'cursor',
    supportedModels: CURSOR_MODEL_VALUES,
    defaultModel: DEFAULT_CURSOR_MODEL,
    capabilities: { streaming: false },
    timeoutMs: 1_800_000,
  },
  create(ctx: ProviderCreateContext): ILLMExecutor {
    if (!ctx.baseUrl) {
      throw new Error(
        'cursor provider requires baseUrl in ProviderCreateContext (set CURSOR_API_URL)',
      )
    }
    return new CursorExecutorCtor(ctx.modelId, ctx.baseUrl)
  },
}
```

- [ ] **Step 4: Run typecheck on all 3 provider packages**

```bash
cd packages/provider-openai && bun run typecheck
cd packages/provider-gemini && bun run typecheck
cd packages/provider-cursor && bun run typecheck
```

Expected: no errors in any package.

- [ ] **Step 5: Commit**

```bash
git add packages/provider-openai/src/openai-plugin.ts \
        packages/provider-gemini/src/gemini-plugin.ts \
        packages/provider-cursor/src/cursor-plugin.ts
git commit -m "refactor(providers): remove requiredEnvKeys from provider manifests"
```

---

## Task 4: Fix translator route and tests

**Files:**

- Modify: `packages/translator/src/routes/provider-health.ts`
- Modify: `packages/translator/src/routes/provider-health.test.ts`
- Modify: `packages/translator/src/bootstrap/startup-banner.test.ts`

- [ ] **Step 1: Remove `requiredEnvKeys` from provider-health.ts response**

Edit `packages/translator/src/routes/provider-health.ts`. The `return` object inside the `.map()` at line 25 becomes:

```typescript
return {
  id: p.manifest.id,
  defaultModel: p.manifest.defaultModel,
  supportedModels: p.manifest.supportedModels,
  capabilities: p.manifest.capabilities,
  timeoutMs: p.manifest.timeoutMs ?? null,
  providerDefaultTimeoutMs: p.manifest.timeoutMs ?? null,
  effectiveTimeoutMs,
  timeoutSource,
}
```

- [ ] **Step 2: Remove `requiredEnvKeys` from provider-health.test.ts**

Edit `packages/translator/src/routes/provider-health.test.ts`.

In the `registerProviderPlugin` call at line 13, remove `requiredEnvKeys` from manifest:

```typescript
registerProviderPlugin({
  manifest: {
    id: 'gemini',
    supportedModels: ['gemini-2.5-pro'] as readonly string[],
    defaultModel: 'gemini-2.5-pro',
    capabilities: { streaming: false },
    timeoutMs: 1_800_000,
  },
  create: () => ({ execute: () => Promise.reject(new Error('noop')) }),
})
```

- [ ] **Step 3: Remove `requiredEnvKeys` from startup-banner.test.ts**

Edit `packages/translator/src/bootstrap/startup-banner.test.ts`. Remove the field from all 3 fixture objects (lines 26, 54, 81):

**Fixture 1** (inside `'logs table with provider info'` test, line 20):

```typescript
registerProviderPlugin({
  manifest: {
    id: 'gemini',
    supportedModels: ['gemini-2.5-pro', 'gemini-2.0-flash'],
    defaultModel: 'gemini-2.5-pro',
    capabilities: { streaming: false },
  },
  create: () => ({ execute: () => Promise.reject(new Error('noop')) }),
})
```

**Fixture 2** (inside `'does not mark an active provider'` test, line 48):

```typescript
registerProviderPlugin({
  manifest: {
    id: 'gemini',
    supportedModels: ['gemini-2.5-pro'],
    defaultModel: 'gemini-2.5-pro',
    capabilities: { streaming: false },
  },
  create: () => ({ execute: () => Promise.reject(new Error('noop')) }),
})
```

**Fixture 3** (inside `'logs the active effective timeout'` test, line 73):

```typescript
registerProviderPlugin({
  manifest: {
    id: 'openai',
    supportedModels: ['gpt-5.4'],
    defaultModel: 'gpt-5.4',
    capabilities: { streaming: false },
    timeoutMs: 1_800_000,
  },
  create: () => ({ execute: () => Promise.reject(new Error('noop')) }),
})
```

- [ ] **Step 4: Run translator tests**

```bash
cd packages/translator && bun test
```

Expected: all tests pass.

- [ ] **Step 5: Run typecheck on translator**

```bash
cd packages/translator && bun run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/translator/src/routes/provider-health.ts \
        packages/translator/src/routes/provider-health.test.ts \
        packages/translator/src/bootstrap/startup-banner.test.ts
git commit -m "refactor(translator): remove requiredEnvKeys from health route and test fixtures"
```

---

## Task 5: Verify zero `requiredEnvKeys` references

- [ ] **Step 1: Grep the entire codebase**

```bash
grep -r "requiredEnvKeys" packages/
```

Expected: **no output** (zero matches). If any output appears, fix the remaining reference before proceeding.

- [ ] **Step 2: Run full test suite**

```bash
bun test
```

Expected: all tests pass, no failures.

- [ ] **Step 3: Run typecheck across all packages**

```bash
bun run typecheck
```

Expected: no TypeScript errors.

---

## Task 6: Update `.env.example` — add 3 optional vars

**Files:**

- Modify: `.env.example`

- [ ] **Step 1: Add `ROOM_CONFIG_DATA_DIR` under Multi-Room Config section**

In `.env.example`, find the `# === Multi-Room Config (Phase 4+) ===` section. After the `INTERNAL_API_SECRET=` block, add:

```bash
# Data directory for room-configs.json (optional)
# ROOM_CONFIG_DATA_DIR=./data
```

- [ ] **Step 2: Add `TRANSLATOR_PIPELINE_TIMEOUT_MS` under Translator observability**

In `.env.example`, find the `# --- Translator observability (optional) ---` block. After the last observability var (`TRANSLATOR_ACK_CALLBACK_BUDGET_MS`), add:

```bash
# Hard cap for entire translation pipeline (optional)
# TRANSLATOR_PIPELINE_TIMEOUT_MS=1800000
```

- [ ] **Step 3: Add `# === Provider Tuning (optional) ===` section before `=== Removed`**

In `.env.example`, find the `# === Removed (moved to per-room config via dashboard) ===` section at the bottom. Insert a new section immediately before it:

```bash
# === Provider Tuning (optional) ===
# OpenAI reasoning effort for models that support extended thinking (gpt-5.x, o-series)
# Valid values: low | medium | high
# OPENAI_REASONING_EFFORT=medium

```

- [ ] **Step 4: Verify `.env.example` structure**

```bash
cat .env.example
```

Confirm the file has these sections in order:

1. `# === Chatwork Bot Account ===`
2. `# === Multi-Room Config (Phase 4+) ===` (with new `ROOM_CONFIG_DATA_DIR` line)
3. `# === Translator Service ===` (with new `TRANSLATOR_PIPELINE_TIMEOUT_MS` line)
4. `# === Webhook Logger ===`
5. `# === Dev Gateway (Docker dev only) ===`
6. `# === Ingress / Tunnel (Docker dev only) ===`
7. `# === Dataset Runner (local dev only) ===`
8. `# === Provider Tuning (optional) ===` ← new section
9. `# === Removed (moved to per-room config via dashboard) ===`

- [ ] **Step 5: Commit**

```bash
git add .env.example
git commit -m "docs(env): add ROOM_CONFIG_DATA_DIR, TRANSLATOR_PIPELINE_TIMEOUT_MS, OPENAI_REASONING_EFFORT to env.example"
```

---

## Task 7: Rewrite `.env` — remove obsolete vars, sync structure

**Files:**

- Modify: `.env`

> **Before editing:** Note your current secret values for `CHATWORK_API_TOKEN`, `CHATWORK_BOT_ACCOUNT_ID`, `ROOM_CONFIG_ENCRYPTION_KEY`, `INTERNAL_API_SECRET`, `ZROK_ENABLE_TOKEN`, `ZROK_UNIQUE_NAME`, `CHATWORK_ORIGINAL_ROOM_ID`, and the DATASET\_\* vars with non-default values. You will need them in the rewritten file.

- [ ] **Step 1: Rewrite `.env` with the following complete structure**

Replace the entire `.env` content with the structure below. Fill `<YOUR_VALUE>` placeholders from your old `.env`:

```bash
# === Chatwork Bot Account ===
CHATWORK_API_TOKEN=<YOUR_VALUE>
# Bot's own account ID (numeric). Used as room admin when creating destination rooms.
# Find it via Chatwork Admin Console or call GET /me with your API token.
CHATWORK_BOT_ACCOUNT_ID=<YOUR_VALUE>

# --- Webhook signature verification (webhook-logger) ---
# Set to true ONLY in development/local to bypass HMAC signature check.
# Always ignored in production. Default: false (verification enabled).
CHATWORK_SKIP_SIGNATURE_VERIFY=false

# === Multi-Room Config (Phase 4+) ===
# AES-256-GCM encryption key for room config secrets (32 bytes, hex-encoded)
# Generate with: openssl rand -hex 32
ROOM_CONFIG_ENCRYPTION_KEY=<YOUR_VALUE>

# Shared secret for internal API communication (translator ↔ webhook-logger)
# Generate with: openssl rand -hex 16
INTERNAL_API_SECRET=<YOUR_VALUE>

# Data directory for room-configs.json (optional)
# ROOM_CONFIG_DATA_DIR=./data

# === Translator Service ===
PORT=3000
NODE_ENV=development

# --- Translator observability (optional) ---
TRANSLATOR_PHASE_HEARTBEAT_MS=30000
TRANSLATOR_TRANSLATION_BUDGET_MS=60000
TRANSLATOR_DELIVERY_BUDGET_MS=45000
TRANSLATOR_ACK_CALLBACK_BUDGET_MS=10000
TRANSLATOR_STATUS_HISTORY_LIMIT=20
# Hard cap for entire translation pipeline (optional)
# TRANSLATOR_PIPELINE_TIMEOUT_MS=1800000

# === Webhook Logger ===
LOGGER_PORT=3001

# Translator service URL (used by webhook-logger to forward events)
TRANSLATOR_URL=http://localhost:3000
TRANSLATOR_INTERNAL_URL=http://localhost:3000

# NOTE: Both translator URLs above default to localhost for native dev
# (bun run dev outside Docker).
# When using Docker Compose, webhook-logger overrides both values to the Docker
# service name. TRANSLATOR_URL is used for forwarding and
# TRANSLATOR_INTERNAL_URL is used for internal room-secret lookups.
# Do NOT change either value to http://translator:3000 here — it will break
# native dev outside Docker.

# === Dev Gateway (Docker dev only) ===
# nginx reverse proxy — single entry point for dashboard + API + webhook.
# zrok tunnels to the gateway so one public URL serves the entire stack.
GATEWAY_PORT=8080

# === Ingress / Tunnel (Docker dev only) ===
# zrok reserved public share — one-time setup: see docs/operations/zrok.md
# 1. Register at https://zrok.io and get your enable token
# 2. Set ZROK_UNIQUE_NAME — the public URL will be https://<name>.share.zrok.io
# 3. Run `bun run dev` — zrok tunnels through the gateway automatically
# 4. Set the displayed PUBLIC URL as your Chatwork webhook URL (path: /webhook)
ZROK_ENABLE_TOKEN=<YOUR_VALUE>
ZROK_UNIQUE_NAME=<YOUR_VALUE>

# === Dataset Runner (local dev only) ===
CHATWORK_ORIGINAL_ROOM_ID=<YOUR_VALUE>
DATASET_AUTORUN=false
DATASET_INPUT_DIR=./input
DATASET_RESET_MODE=resume
DATASET_RESET_CONFIRM=
DATASET_RESET_FILE=
DATASET_RESET_LINE=
DATASET_CLEAR_FAILED=false
# Deprecated: ignored by runtime. output/ is never auto-deleted.
DATASET_CLEAR_OUTPUT=false
DATASET_COOLDOWN_MS=<YOUR_VALUE>
DATASET_MAX_RETRIES=3
DATASET_ITEM_TIMEOUT_MS=<YOUR_VALUE>
DATASET_RUNNER_CALLBACK_URL=http://dataset-runner:3002/internal/delivery-acks

# === Provider Tuning (optional) ===
# OpenAI reasoning effort for models that support extended thinking (gpt-5.x, o-series)
# Valid values: low | medium | high
# OPENAI_REASONING_EFFORT=medium

# === Removed (moved to per-room config via dashboard) ===
# AI_PROVIDER          → roomConfig.aiProvider
# AI_MODEL             → roomConfig.aiModel
# AI_TRANSLATION_STYLE → roomConfig.translationStyle
# CHATWORK_DESTINATION_ROOM_ID → roomConfig.destinationRoomId
# CHATWORK_WEBHOOK_SECRET      → roomConfig.encryptedWebhookSecret
# GOOGLE_GENERATIVE_AI_API_KEY → roomConfig.encryptedAiApiToken
# OPENAI_API_KEY               → roomConfig.encryptedAiApiToken
```

- [ ] **Step 2: Verify removed vars are gone**

```bash
grep -E "CHATWORK_DESTINATION_ROOM_ID|CHATWORK_WEBHOOK_SECRET|AI_PROVIDER|AI_MODEL|AI_TRANSLATION_STYLE|GOOGLE_GENERATIVE_AI_API_KEY|OPENAI_API_KEY" .env
```

Expected: output shows only the commented-out lines in the `=== Removed ===` section (lines starting with `#`). No uncommented references.

- [ ] **Step 3: Verify new vars are present**

```bash
grep -E "TRANSLATOR_INTERNAL_URL|GATEWAY_PORT" .env
```

Expected:

```
TRANSLATOR_INTERNAL_URL=http://localhost:3000
GATEWAY_PORT=8080
```

- [ ] **Step 4: Commit**

```bash
git add .env
git commit -m "chore(env): remove obsolete global vars, sync structure with .env.example"
```

---

## Task 8: Final verification

- [ ] **Step 1: Run full test suite**

```bash
bun test
```

Expected: all tests pass.

- [ ] **Step 2: Run typecheck**

```bash
bun run typecheck
```

Expected: no errors.

- [ ] **Step 3: Run lint**

```bash
bun run lint
```

Expected: no errors.

- [ ] **Step 4: Confirm zero `requiredEnvKeys` in codebase**

```bash
grep -r "requiredEnvKeys" packages/
```

Expected: no output.

- [ ] **Step 5: Confirm removed vars absent from `.env` (active lines only)**

```bash
grep -v "^#" .env | grep -E "CHATWORK_DESTINATION_ROOM_ID|CHATWORK_WEBHOOK_SECRET|AI_PROVIDER=|AI_MODEL=|AI_TRANSLATION_STYLE|GOOGLE_GENERATIVE_AI_API_KEY|OPENAI_API_KEY"
```

Expected: no output.
