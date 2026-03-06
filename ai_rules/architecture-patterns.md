# Architecture Patterns

## Request Flow

```
POST /webhook (webhook-logger)
→ verify HMAC-SHA256 signature, return 200 OK immediately
→ fire-and-forget: forward to translator /internal/translate

POST /internal/translate (translator)
→ router.ts → async (fire-and-forget): handleTranslateRequest
  → stripChatworkMarkup()
  → getProviderPlugin(env.AI_PROVIDER)  →  plugin.create(ctx)
  → translateWithPolicy(service, text)   (timeout + retry)
  → logTranslationRequest()             (structured JSON to stdout)
  → sendTranslatedMessage()             (Chatwork API)
```

**Fire-and-forget pattern**: The webhook handler returns 200 OK immediately and processes
the translation asynchronously. This prevents Chatwork from retrying on slow responses.

## Plugin Registry Pattern

Translation providers are implemented as plugins that register with a central registry at
startup. The `TranslationServiceFactory` no longer exists — the registry is the only path
to create translation service instances.

### How to add a new provider

1. Create `packages/provider-<name>/` with `package.json`, `tsconfig.json`, `src/`
2. Define model values locally: `export const <NAME>_MODEL_VALUES = [...] as const`
3. Implement `ProviderPlugin` interface with manifest (including `requiredEnvKeys`)
4. Export the plugin object from `src/<name>-plugin.ts`
5. Register in `packages/translator/src/bootstrap/register-providers.ts`

No changes to `core` needed. Model validation happens at startup via guards.

### Provider lifecycle

```
startup → registerAllProviders() → runStartupGuards() → server.listen()
request → getProviderPlugin(id) → plugin.create(ctx) → service.translate()
```

## Execution Policy

All translation calls go through `translateWithPolicy()`:

- **Timeout**: 10 seconds per attempt
- **Retry**: Up to 1 retry (2 total attempts) for transient `API_ERROR` only
- **Backoff**: Exponential (300ms base, factor 2)
- Non-transient errors (`QUOTA_EXCEEDED`, `INVALID_RESPONSE`) fail immediately

## Chatwork Markup Stripping

`stripChatworkMarkup()` removes these tags from message text before translation:

- `[To:xxx]` — mention tags
- `[rp aid=...]` — reply tags
- `[quote]...[/quote]` — quoted messages
- `[info]...[/info]` — info blocks
- `[title]...[/title]` — title tags
- `[code]...[/code]` — code blocks

## Env Validation Pattern

Zod schema with flat validation is parsed **at module load** in `packages/translator/src/env.ts`.
It validates base fields (`CHATWORK_API_TOKEN`, `AI_PROVIDER`, etc.) and exports a typed `env` singleton.

Provider-specific keys (e.g., `GOOGLE_GENERATIVE_AI_API_KEY`) are validated by startup guards
**after** provider registration, using `manifest.requiredEnvKeys`.

```typescript
import { env } from '~/env'
const token = env.CHATWORK_API_TOKEN
```

If a required variable is missing, startup guards throw `ProviderRegistryBootError` with a clear message.
Model validation also happens at startup — models not in `manifest.supportedModels` log a warning (escape hatch).

## Runtime Endpoints

| Endpoint              | Method | Package    | Purpose                                 |
| --------------------- | ------ | ---------- | --------------------------------------- |
| `/health`             | GET    | both       | Health check (returns 200 OK)           |
| `/health/provider`    | GET    | translator | Provider registry detail (JSON)         |
| `/webhook`            | POST   | logger     | Chatwork webhook receiver               |
| `/internal/translate` | POST   | translator | Internal translate (shared-secret auth) |

## Plugin-Owned Architecture

Each provider package owns its model list, required env keys, and capabilities. Core defines only interfaces.

**Provider manifest includes:**

- `supportedModels: readonly string[]` — owned by provider
- `defaultModel: string`
- `requiredEnvKeys: readonly string[]` — validated at startup
- `timeoutMs?: number` — optional per-provider timeout

**Adding a new provider requires:**

- Creating the provider package with local model definitions
- One import line in `register-providers.ts`
- Zero changes to `core`, `env.ts`, or other packages

See `docs/plans/2026-03-06-plugin-owned-provider-architecture-design.md` for full design rationale.
