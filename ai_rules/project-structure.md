# Project Structure

## Monorepo Layout

Bun workspaces monorepo. Seven packages:

```
@chatwork-bot/core                ←── imported by ── @chatwork-bot/provider-*
(types, interfaces, utils,                           @chatwork-bot/translator
 registry, execution policy)                         @chatwork-bot/webhook-logger

@chatwork-bot/translation-prompt  ←── imported by ── @chatwork-bot/provider-*
(shared prompt + Zod schema)

@chatwork-bot/provider-gemini     ←── registered in ── @chatwork-bot/translator
@chatwork-bot/provider-openai     ←── registered in ── @chatwork-bot/translator
@chatwork-bot/provider-cursor     ←── registered in ── @chatwork-bot/translator (LOCAL DEV ONLY)
```

## Package Responsibilities

### `packages/core` (`@chatwork-bot/core`)

Shared logic. Contains:

- `src/types/` — external data shapes (webhook events, AI config domain types)
- `src/interfaces/` — behavioral contracts (`ITranslationService`, `IChatworkClient`, `ProviderPlugin`)
- `src/services/` — provider registry, execution policy
- `src/utils/` — pure utility functions (`parseCommand`, `stripChatworkMarkup`)
- `src/chatwork/` — Chatwork REST API client

Package exports point to raw TypeScript source (`"main": "./src/index.ts"`).
No build step needed — Bun resolves TypeScript directly.

### `packages/translation-prompt` (`@chatwork-bot/translation-prompt`)

Shared translation prompt and `TranslationSchema` (Zod). Used by all provider packages.

### `packages/provider-gemini` (`@chatwork-bot/provider-gemini`)

Gemini provider plugin. Implements `ProviderPlugin` using `@ai-sdk/google`.

### `packages/provider-openai` (`@chatwork-bot/provider-openai`)

OpenAI provider plugin. Implements `ProviderPlugin` using `@ai-sdk/openai`.

### `packages/provider-cursor` (`@chatwork-bot/provider-cursor`)

Cursor provider plugin (LOCAL DEV ONLY). Uses `@ai-sdk/openai-compatible` with a local
`cursor-api-proxy`. Must not be used in production.

### `packages/translator` (`@chatwork-bot/translator`)

Runnable HTTP server. Owns:

- Env validation with discriminated union (`src/env.ts`)
- Provider bootstrap and startup guards (`src/bootstrap/`)
- HTTP routing + shared-secret auth (`src/webhook/router.ts`)
- Webhook event handling (`src/webhook/handler.ts`)
- Structured JSON request logging (`src/utils/request-log.ts`)
- Provider health endpoint (`src/routes/provider-health.ts`)

### `packages/webhook-logger` (`@chatwork-bot/webhook-logger`)

Webhook receiver. Receives webhooks from Chatwork and forwards to translator.

## Key Files

| File                   | Purpose                                   |
| ---------------------- | ----------------------------------------- |
| `dist/server.js`       | Build output — do not edit manually       |
| `eslint.config.ts`     | Root ESLint config shared by all packages |
| `.prettierrc`          | Prettier config                           |
| `commitlint.config.ts` | Conventional commits enforcement          |
| `docker-compose.yml`   | Local Docker setup on port 3000           |
| `.env.example`         | Template for required env vars            |

## Rule: Core vs Provider vs Translator

- Types, interfaces, registry, domain logic → `core`
- Translation prompt + schema → `translation-prompt`
- AI SDK integration per provider → `provider-*`
- HTTP handling, env loading, bootstrap → `translator`
- Webhook receiving, forwarding → `webhook-logger`

## tsconfig Hierarchy

Single source of truth in `tsconfig.base.json`. Each package extends it.

```
tsconfig.base.json                          (baseUrl: ".")
  ├── tsconfig.root.json                    (root scripts only, excludes packages/)
  ├── packages/core/tsconfig.json           (paths: ~/* → packages/core/src/*)
  ├── packages/translation-prompt/tsconfig.json
  ├── packages/provider-gemini/tsconfig.json
  ├── packages/provider-openai/tsconfig.json
  ├── packages/provider-cursor/tsconfig.json
  ├── packages/translator/tsconfig.json     (paths: ~/* → packages/translator/src/*, packages/core/src/*)
  └── packages/webhook-logger/tsconfig.json (paths: ~/* → packages/webhook-logger/src/*, packages/core/src/*)
```

Cross-package imports (`@chatwork-bot/core`) resolve via Bun workspace symlinks in
`node_modules`, not tsconfig paths. Do not add cross-package entries to tsconfig `paths`.
Each package tsconfig defines `paths: { "~/*": [...] }` for intra-package imports.
Do NOT add `~/` to `tsconfig.base.json` — `baseUrl` differs between root and packages.
Dependent packages must include core's src path in their `~/*` mapping since core sources
are loaded directly (via `"main": "./src/index.ts"`) and contain `~/` imports.
