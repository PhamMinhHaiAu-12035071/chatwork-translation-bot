# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chatwork Translation Bot — a webhook-based bot that receives Chatwork messages, parses `/translate <lang> <text>` commands, translates text, and replies. Pure backend, no frontend or database.

## Tech Stack

- **Runtime**: Bun (v1.1+)
- **Language**: TypeScript 5.4+ (strict mode)
- **HTTP**: Bun.serve() (native, no framework)
- **Validation**: Zod (env vars)
- **Testing**: Bun built-in test runner
- **Container**: Docker with `oven/bun:1.1-distroless`

## Commands

```bash
# Development
bun run dev                    # Run bot with hot-reload

# Build
bun run build                  # Bundle to dist/server.js (minified, target bun)

# Type checking
bun run typecheck              # Checks all packages (base + core + bot)

# Linting & formatting
bun run lint                   # ESLint (strict + stylistic)
bun run lint:fix               # ESLint with auto-fix
bun run format                 # Prettier

# Testing
bun test                       # Run all tests
bun test packages/core/src/utils/parse-command.test.ts  # Run single test file

# Docker
docker compose up              # Run on port 3000 with healthcheck
```

## Monorepo Architecture

Bun workspaces monorepo with two packages:

```
@chatwork-bot/core  ←── imported by ──  @chatwork-bot/bot
(types, interfaces,                     (HTTP server, env,
 utils, services)                        Chatwork client, webhook handling)
```

- **`packages/core`**: Shared logic with zero runtime deps. Exports types, `ITranslationService` interface, `parseCommand()`, and `MockTranslationService`. Package exports point to raw TypeScript source (`./src/index.ts`).
- **`packages/bot`**: Runnable HTTP server. Owns env validation (Zod), Chatwork REST API client, webhook signature verification (HMAC-SHA256 via Web Crypto), and routing.

### Request Flow

```
POST /webhook → router.ts (verify HMAC signature, return 200 immediately)
  → async: handleWebhookEvent → parseCommand → translate → sendMessage (Chatwork API)
```

The webhook handler uses fire-and-forget: returns 200 OK immediately, processes asynchronously.

## Key Patterns

- **Path aliases**: `@core/*` → `packages/core/src/*`, `@bot/*` → `packages/bot/src/*`
- **Import convention**: Use `import type` for type-only imports (enforced by ESLint)
- **Unused vars**: Prefix with `_` (ESLint rule)
- **Service interface**: `ITranslationService` in core defines the contract; `MockTranslationService` is the current placeholder. Real implementations should follow this interface.
- **Chatwork markup stripping**: `parseCommand()` strips `[To:xxx]`, `[rp aid=...]`, `[quote]`, `[info]`, `[title]`, `[code]` tags before parsing
- **Env validation**: Zod schema parsed at module load; exports typed `env` singleton

## Environment Variables

Required: `CHATWORK_API_TOKEN`, `CHATWORK_WEBHOOK_SECRET`
Optional: `PORT` (default 3000), `NODE_ENV` (default development)

See `.env.example` for template.

## Code Style

- Prettier: no semicolons, single quotes, trailing commas, 100 char width
- Commit messages: conventional commits (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`, etc.)
- Pre-commit hooks (Husky): lint-staged → typecheck → tests
- ESLint: `strictTypeChecked` + `stylisticTypeChecked` presets
- TypeScript: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` enabled
