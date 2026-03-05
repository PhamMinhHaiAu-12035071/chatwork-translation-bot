# Project Structure

## Monorepo Layout

Bun workspaces monorepo. Two packages:

```
@chatwork-bot/core  ←── imported by ──  @chatwork-bot/bot
(types, interfaces,                     (HTTP server, env,
 utils, services)                        Chatwork client, webhook handling)
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

### `packages/bot` (`@chatwork-bot/bot`)

Runnable HTTP server. Owns:

- Env validation (Zod schema in `src/env.ts`)
- Chatwork REST API client (`src/chatwork/`)
- Webhook signature verification (HMAC-SHA256 via Web Crypto)
- HTTP routing (`src/webhook/router.ts`)
- Webhook event handling (`src/webhook/handler.ts`)

## Key Files

| File                   | Purpose                                   |
| ---------------------- | ----------------------------------------- |
| `dist/server.js`       | Build output — do not edit manually       |
| `eslint.config.ts`     | Root ESLint config shared by all packages |
| `.prettierrc`          | Prettier config                           |
| `commitlint.config.ts` | Conventional commits enforcement          |
| `docker-compose.yml`   | Local Docker setup on port 3000           |
| `.env.example`         | Template for required env vars            |

## Rule: Core vs Bot

Business logic belongs in `core`. Integration and transport concerns belong in `bot`.

- Parsing, translation interfaces, domain types → `core`
- HTTP handling, Chatwork API calls, env loading → `bot`
