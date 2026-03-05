# Architecture Patterns

## Request Flow

```
POST /webhook
→ router.ts (verify HMAC-SHA256 signature, return 200 OK immediately)
→ async (fire-and-forget): handleWebhookEvent
  → parseCommand()
  → ITranslationService.translate()
  → Chatwork API sendMessage()
```

**Fire-and-forget pattern**: The webhook handler returns 200 OK immediately and processes
the translation asynchronously. This prevents Chatwork from retrying on slow responses.

## Path Aliases

Configured in `tsconfig.root.json` and recognized by Bun's bundler:

| Alias     | Resolves to           |
| --------- | --------------------- |
| `@core/*` | `packages/core/src/*` |
| `@bot/*`  | `packages/bot/src/*`  |

Example: `import { parseCommand } from '@core/utils/parse-command'`

## Service Interface Pattern

`ITranslationService` in `packages/core/src/interfaces/translation.ts` defines the contract.
`MockTranslationService` is the current placeholder implementation.

When adding a real translation provider:

1. Implement `ITranslationService` in `packages/core/src/services/`
2. Do not modify the interface — code against the abstraction
3. Swap implementation at the bot's composition root (`packages/bot/src/index.ts`)

## Chatwork Markup Stripping

`parseCommand()` strips these tags from message text before parsing:

- `[To:xxx]` — mention tags
- `[rp aid=...]` — reply tags
- `[quote]...[/quote]` — quoted messages
- `[info]...[/info]` — info blocks
- `[title]...[/title]` — title tags
- `[code]...[/code]` — code blocks

This ensures `/translate en hello` is found even when the message contains markup.

## Env Validation Pattern

Zod schema is parsed **at module load** in `packages/bot/src/env.ts`.
It exports a typed `env` singleton used throughout the bot.

```typescript
// Usage — never use process.env directly in bot code
import { env } from '@bot/env'
const token = env.CHATWORK_API_TOKEN
```

If a required variable is missing, the process exits at startup with a clear error.
