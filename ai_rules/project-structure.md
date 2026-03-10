# Project Structure

## Monorepo Layout

Bun workspaces monorepo. Eight packages:

```
@chatwork-bot/core                ←── imported by ── @chatwork-bot/provider-*
(types, interfaces, utils,                           @chatwork-bot/translator
 registry, execution policy)                         @chatwork-bot/webhook-logger

@chatwork-bot/translation-prompt  ←── imported by ── @chatwork-bot/provider-*
(4-phase pipeline prompts +                          @chatwork-bot/translator
 Zod schemas)

@chatwork-bot/provider-gemini     ←── registered in ── @chatwork-bot/translator
@chatwork-bot/provider-openai     ←── registered in ── @chatwork-bot/translator
@chatwork-bot/provider-cursor     ←── registered in ── @chatwork-bot/translator (LOCAL DEV ONLY)
```

## Package Responsibilities

### `packages/core` (`@chatwork-bot/core`)

Shared logic. Contains:

- `src/types/` — external data shapes (webhook events, branded AIProvider type)
- `src/interfaces/` — behavioral contracts (`ILLMExecutor`, `ISchema`, `IChatworkClient`, `ProviderPlugin`)
- `src/services/` — provider registry, execution policy
- `src/utils/` — pure utility functions (`parseCommand`, `stripChatworkMarkup`)
- `src/chatwork/` — Chatwork REST API client

Package exports point to raw TypeScript source (`"main": "./src/index.ts"`).
No build step needed — Bun resolves TypeScript directly.

### `packages/translation-prompt` (`@chatwork-bot/translation-prompt`)

4-phase translation pipeline prompts and Zod schemas. Contains: `src/sections/` (prompt builders), `src/schemas/` (`AnalysisSchema`, `ReviewSchema`, `TranslationDraftSchema`, `PipelineTraceSchema`). Exports `PromptPair` type. Used by provider-\* AND translator packages.

### `packages/provider-gemini` (`@chatwork-bot/provider-gemini`)

Gemini provider plugin. Implements `ILLMExecutor.execute<T>()` using `Output.object({ schema })` from `@ai-sdk/google`.

### `packages/provider-openai` (`@chatwork-bot/provider-openai`)

OpenAI provider plugin. Implements `ILLMExecutor.execute<T>()` using `Output.object({ schema })` from `@ai-sdk/openai`.

### `packages/provider-cursor` (`@chatwork-bot/provider-cursor`)

Cursor provider plugin (LOCAL DEV ONLY). Implements `ILLMExecutor.execute<T>()` using `extractJsonFromText` + `schema.parse()`. Must not be used in production.

### `packages/translator` (`@chatwork-bot/translator`)

Runnable HTTP server. Owns:

- Env validation with discriminated union (`src/env.ts`)
- Provider bootstrap and startup guards (`src/bootstrap/`)
- HTTP routing + shared-secret auth (`src/webhook/router.ts`)
- Webhook event handling (`src/webhook/handler.ts`)
- Structured JSON request logging (`src/utils/request-log.ts`)
- Provider health endpoint (`src/routes/provider-health.ts`)
- 4-phase translation pipeline (`src/pipeline/pipeline.ts`)

### `packages/webhook-logger` (`@chatwork-bot/webhook-logger`)

Webhook receiver. Receives webhooks from Chatwork and forwards to translator.

### `packages/dataset-runner` (`@chatwork-bot/dataset-runner`)

ACK-driven queue runner sidecar (LOCAL DEV ONLY). Reads JSONL files from `input/pending/`,
injects them into the original Chatwork room via the Chatwork API, then waits for an ACK
callback from the translator before advancing to the next item. This enables automated,
ordered dataset injection for translation testing without polling.

- Port: 3002 (internal only, not published to the host)
- Controlled by `DATASET_AUTORUN` (default `false` — idle until enabled)
- Queue advances via POST `/internal/delivery-acks` (internal callback from translator)
- Status available at GET `/status` (runner mode, active item, counts)
- Input layout: `input/pending/` (active), `input/archive/` (done), `input/failed/` (DLQ)
- Seed batches are committed under `input/samples/` and copied to `pending/` to run

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
  ├── packages/translator/tsconfig.json     (paths: ~/* → packages/translator/src/*, packages/core/src/*, packages/translation-prompt/src/*)
  └── packages/webhook-logger/tsconfig.json (paths: ~/* → packages/webhook-logger/src/*, packages/core/src/*)
```

Cross-package imports (`@chatwork-bot/core`) resolve via Bun workspace symlinks in
`node_modules`, not tsconfig paths. Do not add cross-package entries to tsconfig `paths`.
Each package tsconfig defines `paths: { "~/*": [...] }` for intra-package imports.
Do NOT add `~/` to `tsconfig.base.json` — `baseUrl` differs between root and packages.
Dependent packages must include core's src path in their `~/*` mapping since core sources
are loaded directly (via `"main": "./src/index.ts"`) and contain `~/` imports.
Packages that import translation-prompt (whose source files contain `~/schemas/*` and `~/sections/*` imports) must also include `packages/translation-prompt/src/*` in their `~/*` mapping.
