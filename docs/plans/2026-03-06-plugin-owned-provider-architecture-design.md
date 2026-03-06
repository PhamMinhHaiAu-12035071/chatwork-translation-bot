# Plugin-Owned Provider Architecture

## Problem

The current codebase has a tightly coupled provider/model system:

1. **Duplicated source of truth** — Model lists exist in both `core/types/ai.ts` (hardcoded `as const` arrays) and each plugin's `manifest.supportedModels`
2. **Core knows provider specifics** — `@chatwork-bot/core` defines `GEMINI_MODEL_VALUES`, `OPENAI_MODEL_VALUES`, `CURSOR_MODEL_VALUES`, violating Open/Closed Principle
3. **Hardcoded env validation** — `env.ts` uses Zod `discriminatedUnion` with per-provider keys baked in
4. **Adding a provider requires 4+ file changes** — `ai.ts`, `env.ts`, `register-providers.ts`, `core/index.ts`
5. **No runtime discoverability** — No way to see "provider X supports models [a,b,c]" from code or startup logs

## Decision

Plugin-Owned architecture where each provider package is the Single Source of Truth for its models, env keys, and capabilities. Core defines only interfaces and registry.

## Design

### Principle

Each provider package owns its model list. Core provides the contract (interfaces) and aggregation mechanism (registry). Adding a new provider = create package + one import line.

### ProviderManifest (Extended)

```typescript
export interface ProviderManifest {
  readonly id: string
  readonly supportedModels: readonly string[]
  readonly defaultModel: string
  readonly capabilities: {
    readonly streaming: boolean
  }
  readonly timeoutMs?: number
  readonly requiredEnvKeys: readonly string[] // NEW — declared env dependencies
}
```

### AIProvider Type

```typescript
// BEFORE: tightly coupled
export const AI_PROVIDER_VALUES = ['gemini', 'openai', 'cursor'] as const
export type AIProvider = (typeof AI_PROVIDER_VALUES)[number]

// AFTER: decoupled branded string
export type AIProvider = string & { readonly __brand: 'AIProvider' }
export function toAIProvider(value: string): AIProvider {
  return value as AIProvider
}
```

### env.ts (Flat Schema)

```typescript
const envSchema = z.object({
  CHATWORK_API_TOKEN: z.string().min(1),
  CHATWORK_DESTINATION_ROOM_ID: z.coerce.number().int().positive(),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test', 'local']).default('development'),
  AI_PROVIDER: z.string().min(1, 'AI_PROVIDER is required'),
  AI_MODEL: z.string().min(1).optional(),
})
```

### Boot Sequence

```
1. env.ts        → Parse base env (flat, no provider specifics)
2. register()    → Register all provider plugins into registry
3. Guards:
   a. validateProviderExists(AI_PROVIDER)
   b. validateProviderEnvKeys(plugin)     → Check manifest.requiredEnvKeys
   c. validateModelSelection(provider, model?)
      → model in supportedModels: OK
      → model not in list: LOG WARNING (escape hatch), proceed
      → no model specified: use manifest.defaultModel
4. Banner        → Log table of all providers/models
5. Server starts
```

### Provider Model Lists

Each provider defines its own `as const` array internally:

**@chatwork-bot/provider-gemini:**

- `gemini-2.5-pro` (default), `gemini-2.0-flash`

**@chatwork-bot/provider-openai:**

- `gpt-4o` (default), `gpt-4o-mini`

**@chatwork-bot/provider-cursor (17 models from 4 vendors + Cursor own):**

- Anthropic: `claude-sonnet-4`, `claude-sonnet-4-5`, `claude-sonnet-4-5-thinking`, `claude-sonnet-4-6`, `claude-sonnet-4-6-thinking`, `claude-opus-4-5`, `claude-opus-4-5-thinking`, `claude-opus-4-6`, `claude-opus-4-6-thinking`
- Google: `gemini-2.5-flash`, `gemini-3-flash`, `gemini-3-pro`
- OpenAI: `gpt-5.2`, `gpt-5.3-codex`
- Cursor: `composer-1`, `composer-1.5`, `cursor-small`

### Startup Banner

```
[translator] ┌──────────┬────────────────────────────────┬──────────────────┬─────────┐
[translator] │ Provider │ Supported Models               │ Default          │ Timeout │
[translator] ├──────────┼────────────────────────────────┼──────────────────┼─────────┤
[translator] │ gemini   │ gemini-2.5-pro, gemini-2.0-fl… │ gemini-2.5-pro   │ 10s     │
[translator] │ openai   │ gpt-4o, gpt-4o-mini            │ gpt-4o           │ 10s     │
[translator] │ cursor * │ claude-sonnet-4-5, claude-son… │ claude-sonnet-4-5│ 120s    │
[translator] └──────────┴────────────────────────────────┴──────────────────┴─────────┘
[translator] * = active provider
```

## Files Changed

| Action  | File                                     | Description                                             |
| ------- | ---------------------------------------- | ------------------------------------------------------- |
| DELETE  | `core/types/ai.ts`                       | Remove provider-specific model values from core         |
| MODIFY  | `core/interfaces/provider-plugin.ts`     | Add `requiredEnvKeys` to `ProviderManifest`             |
| MODIFY  | `core/index.ts`                          | Remove model value exports, add branded AIProvider type |
| MODIFY  | `provider-gemini/gemini-plugin.ts`       | Own GEMINI_MODEL_VALUES + requiredEnvKeys               |
| MODIFY  | `provider-openai/openai-plugin.ts`       | Own OPENAI_MODEL_VALUES + requiredEnvKeys               |
| MODIFY  | `provider-cursor/cursor-plugin.ts`       | Expanded CURSOR_MODEL_VALUES + requiredEnvKeys          |
| REWRITE | `translator/env.ts`                      | Flat schema, remove discriminatedUnion                  |
| MODIFY  | `translator/startup-guards.ts`           | Add validateProviderEnvKeys, validateModelSelection     |
| CREATE  | `translator/bootstrap/startup-banner.ts` | Table format provider/model log                         |
| MODIFY  | `translator/routes/provider-health.ts`   | Enhanced response with all manifest data                |
| UPDATE  | `translator/env.test.ts`                 | Update for flat schema                                  |
| UPDATE  | `translator/startup-guards.test.ts`      | Add tests for new guards                                |
| UPDATE  | `translator/webhook/router.test.ts`      | Update mocked env shape                                 |
| UPDATE  | `.env.example`                           | Simplified provider comments                            |

## Trade-offs

| Decision                     | Pro                             | Con                              |
| ---------------------------- | ------------------------------- | -------------------------------- |
| Branded string AIProvider    | Zero coupling, extensible       | Loses autocompletion in .env     |
| Plugin self-validates env    | True loose coupling             | Validation split across packages |
| Deferred model validation    | Plugin-owned models possible    | Slightly delayed error reporting |
| Escape hatch (custom models) | Flexible for dev/testing        | Could mask typos                 |
| requiredEnvKeys in manifest  | Centralized check, clear errors | Slight manifest interface growth |

## Adding a New Provider (Example: Groq)

1. Create `packages/provider-groq/` with standard structure
2. Define models, plugin, service internally
3. Add one line to `register-providers.ts`: `registerProviderPlugin(groqPlugin)`
4. No changes to `core`, `env.ts`, or any other existing package

## Escape Hatch Behavior

If `AI_MODEL` is not in `manifest.supportedModels`:

- Log warning: `⚠ Model 'custom-xyz' not in cursor's supported list [...]. Proceeding anyway.`
- Proceed with the custom model string
- Useful for testing new models before adding them to the official list
