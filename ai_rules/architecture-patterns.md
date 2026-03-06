# Architecture Patterns

## Request Flow

```
POST /webhook (webhook-logger)
→ verify HMAC-SHA256 signature, return 200 OK immediately
→ fire-and-forget: forward to translator /internal/translate

POST /internal/translate (translator)
→ router.ts (verify X-Internal-Secret header via timing-safe comparison)
→ async (fire-and-forget): handleTranslateRequest
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
2. Implement `ProviderPlugin` interface (manifest + `create()` factory)
3. Export the plugin object as default from `src/<name>-plugin.ts`
4. Register in `packages/translator/src/bootstrap/register-providers.ts`
5. Add model values to `packages/core/src/types/ai.ts`
6. Add env validation branch in `packages/translator/src/env.ts` (discriminated union)

### Provider lifecycle

```
startup → registerAllProviders() → runStartupGuards() → server.listen()
request → getProviderPlugin(id) → plugin.create(ctx) → service.translate()
```

## Execution Policy

All translation calls go through `translateWithPolicy()`:

- **Timeout**: 10 seconds per attempt
- **Retry**: Up to 2 retries (3 total attempts) for transient `API_ERROR` only
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

Zod schema with `z.discriminatedUnion` on `AI_PROVIDER` is parsed **at module load**
in `packages/translator/src/env.ts`. It exports a typed `env` singleton. Each provider
branch validates its own required keys (e.g., `GOOGLE_GENERATIVE_AI_API_KEY` for gemini).

```typescript
import { env } from '~/env'
const token = env.CHATWORK_API_TOKEN
```

If a required variable is missing, the process exits at startup with a clear error.

## Runtime Endpoints

| Endpoint              | Method | Package    | Purpose                                 |
| --------------------- | ------ | ---------- | --------------------------------------- |
| `/health`             | GET    | both       | Health check (returns 200 OK)           |
| `/health/provider`    | GET    | translator | Provider registry detail (JSON)         |
| `/webhook`            | POST   | logger     | Chatwork webhook receiver               |
| `/internal/translate` | POST   | translator | Internal translate (shared-secret auth) |
