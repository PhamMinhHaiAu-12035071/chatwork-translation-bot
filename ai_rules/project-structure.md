# Project Structure

## Monorepo Layout

Bun workspaces monorepo. Three packages:

```
@chatwork-bot/core  ←── imported by ──  @chatwork-bot/translator
(types, interfaces,                     (HTTP server, translation,
 utils, services)                        webhook handling)

@chatwork-bot/core  ←── imported by ──  @chatwork-bot/webhook-logger
                                        (webhook receiver,
                                         forwards to translator)
```

## Package Responsibilities

### `packages/core` (`@chatwork-bot/core`)

Shared logic with **zero runtime dependencies**.

Contains:

- `src/types/` — external data shapes (webhook events, API responses)
- `src/interfaces/` — behavioral contracts (`ITranslationService`, `IChatworkClient`)
- `src/services/` — service implementations (`MockTranslationService`)
- `src/utils/` — pure utility functions (`parseCommand`)

Package exports point to raw TypeScript source (`"main": "./src/index.ts"`).
No build step needed for `core` — Bun resolves TypeScript directly.

### `packages/translator` (`@chatwork-bot/translator`)

Runnable HTTP server. Owns:

- Env validation (Zod schema in `src/env.ts`)
- Chatwork REST API client (`src/chatwork/`)
- Webhook signature verification (HMAC-SHA256 via Web Crypto)
- HTTP routing (`src/webhook/router.ts`)
- Webhook event handling (`src/webhook/handler.ts`)

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

## Rule: Core vs Translator/Webhook-Logger

Business logic belongs in `core`. Integration and transport concerns belong in `translator` or `webhook-logger`.

- Parsing, translation interfaces, domain types → `core`
- HTTP handling, Chatwork API calls, env loading → `translator`
- Webhook receiving, forwarding → `webhook-logger`

## tsconfig Hierarchy

Single source of truth in `tsconfig.base.json`. Each package extends it.

```
tsconfig.base.json                          (baseUrl: ".")
  ├── tsconfig.root.json                    (root scripts only, excludes packages/)
  ├── packages/core/tsconfig.json           (baseUrl: "../..")
  ├── packages/translator/tsconfig.json     (baseUrl: "../..")
  └── packages/webhook-logger/tsconfig.json (baseUrl: "../..")
```

Cross-package imports (`@chatwork-bot/core`) resolve via Bun workspace symlinks in
`node_modules`, not tsconfig paths. Do not add cross-package entries to tsconfig `paths`.
Each package tsconfig has no local `paths` override — all inherit from base.
