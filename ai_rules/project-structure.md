# Project Structure

## Monorepo Layout

Bun workspaces monorepo. Eleven packages:

```
@chatwork-bot/core                ←── imported by ── @chatwork-bot/provider-*
(types, interfaces, utils,                           @chatwork-bot/translator
 registry, execution policy)                         @chatwork-bot/webhook-logger

@chatwork-bot/translation-prompt  ←── imported by ── @chatwork-bot/provider-*
(translation prompts + schemas)                      @chatwork-bot/translator

@chatwork-bot/chatwork            ←── imported by ── @chatwork-bot/translator
(anti-corruption layer)

@chatwork-bot/provider-gemini     ←── registered in ── @chatwork-bot/translator
@chatwork-bot/provider-openai     ←── registered in ── @chatwork-bot/translator
@chatwork-bot/provider-cursor     ←── registered in ── @chatwork-bot/translator (LOCAL DEV ONLY)
@chatwork-bot/provider-kagi       ←── registered in ── @chatwork-bot/translator
@chatwork-bot/kagi-sidecar        ←── standalone sidecar service
@chatwork-bot/translator          ←── HTTP server, webhook handler
@chatwork-bot/webhook-logger      ←── webhook receiver
@chatwork-bot/dataset-runner      ←── dataset injection sidecar (LOCAL DEV ONLY)
@chatwork-bot/dashboard           ←── React SPA for multi-room management
```

## Package Responsibilities

### `packages/core` (`@chatwork-bot/core`)

Shared logic. Contains:

- `src/types/` — external data shapes (neutral `TranslationIngressCommand` + TypeBox schema, branded AIProvider type)
- `src/interfaces/` — behavioral contracts (`ILLMExecutor`, `ISchema`, `ProviderPlugin`)
- `src/services/` — provider registry, execution policy
- `src/utils/` — pure utility functions (`parseCommand`)

Package exports point to raw TypeScript source (`"main": "./src/index.ts"`).
No build step needed — Bun resolves TypeScript directly.

### `packages/translation-prompt` (`@chatwork-bot/translation-prompt`)

**Purpose:** System and user prompts for single-call translation pipeline

**Exports:**

- `buildSingleCallPrompts()` — Constructs system + user prompts
- `buildStructuredTranslationPrompts()` — Legacy structured output (unused)
- Prompt sections: CORE_DOCTRINE, JAPANESE_RULES, ENGLISH_RULES, CONSTRAINTS
- Zod schemas: Only `ReviewSchema` exported (not PipelineTraceSchema)

**Phase 2+ Changes:**

- Optimized prompt versions (30% token reduction)
- Feature flag: `TRANSLATION_PROMPT_VERSION=baseline|optimized`

**Note:** Pipeline is **single LLM call**, not 4-phase (design doc confirmed)

### `packages/chatwork` (`@chatwork-bot/chatwork`)

Anti-corruption layer for Chatwork REST API. Provides a clean, strongly-typed interface to the Chatwork API (message sending, room listing, etc.). Shields translator and other packages from direct API coupling.

### `packages/provider-gemini` (`@chatwork-bot/provider-gemini`)

Gemini provider plugin. Implements `ILLMExecutor.execute<T>()` using `Output.object({ schema })` from `@ai-sdk/google`.

### `packages/provider-openai` (`@chatwork-bot/provider-openai`)

OpenAI provider plugin. Implements `ILLMExecutor.execute<T>()` using `Output.object({ schema })` from `@ai-sdk/openai`.

### `packages/provider-cursor` (`@chatwork-bot/provider-cursor`)

Cursor provider plugin (LOCAL DEV ONLY). Implements `ILLMExecutor.execute<T>()` using `extractJsonFromText` + `schema.parse()`. Must not be used in production.

### `packages/provider-kagi` (`@chatwork-bot/provider-kagi`)

Kagi provider plugin. Implements `ILLMExecutor.execute<T>()` using KagiClient HTTP API. Used for Free tier rooms via `kagi-sidecar`.

### `packages/kagi-sidecar` (`@chatwork-bot/kagi-sidecar`)

Kagi translation sidecar service. Anonymous best-effort transport for Free rooms. Provides queue-based rate limiting and guardrails to reduce anti-abuse risk. Port 3002, accessed via KAGI_TRANSLATOR_URL.

### `packages/dashboard` (`@chatwork-bot/dashboard`)

React SPA for multi-room management (Vite + Tailwind). Neubrutalism design language. Provides UI for room configuration, AI provider selection, translation style tuning, and keyword protection rules.

### `packages/translator` (`@chatwork-bot/translator`)

**Purpose:** HTTP server, env validation, bootstrap, translation orchestration

**Key Files:**

- `src/server.ts` — Bun.serve() HTTP server, graceful shutdown
- `src/env-schema.ts` — Zod env validation, runtime config
- `src/bootstrap/` — Provider plugin registration
- `src/webhook/` — Webhook routing, request context, handler
  - `router.ts` — `/internal/translate` endpoint, trace ID generation
  - `handler.ts` — Room config resolution, provider selection
- `src/services/` — Core business logic
  - `room-translation-orchestrator.ts` — Pipeline orchestration (preprocess → LLM → postprocess → deliver)
  - `async-logger.ts` — Buffered non-blocking logging (Phase 1+)
  - `trace-builder.ts` — Per-request timing instrumentation (Phase 3+)
  - `trace-persistence.ts` — Save traces to output/traces/ (Phase 3+)
  - `keyword-redactor.ts` — Mask/restore keyword protection
  - `chatwork-message-parser.ts` — Strip Chatwork markup decorations
- `src/types/` — TypeScript interfaces
  - `observability.ts` — TranslatorLogEntry, TranslatorRequestContext
  - `trace.ts` — TranslationTrace schema (Phase 3+)

**Notes:**

- Pipeline is **single LLM call**, not 4-phase (design doc confirmed)
- Delivery is async fire-and-forget (Phase 1+)
- Tracing system instruments all stages (Phase 3+)

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

## Rule: Core vs Chatwork vs Provider vs Translator

- Neutral types, interfaces, registry, domain logic → `core`
- Chatwork-specific API, webhook verification, HTTP client → `chatwork`
- Translation prompt + schema → `translation-prompt`
- AI SDK integration per provider → `provider-*`
- HTTP handling, env loading, bootstrap → `translator`
- Webhook receiving, signature verification, DTO forwarding → `webhook-logger`

## tsconfig Hierarchy

Single source of truth in `tsconfig.base.json`. Each package extends it.

```
tsconfig.base.json                          (baseUrl: ".")
  ├── tsconfig.root.json                    (root scripts only, excludes packages/)
  ├── packages/core/tsconfig.json           (paths: ~/* → packages/core/src/*)
  ├── packages/chatwork/tsconfig.json       (paths: ~/* → packages/chatwork/src/*, packages/core/src/*)
  ├── packages/translation-prompt/tsconfig.json
  ├── packages/provider-gemini/tsconfig.json
  ├── packages/provider-openai/tsconfig.json
  ├── packages/provider-cursor/tsconfig.json
  ├── packages/translator/tsconfig.json     (paths: ~/* → packages/translator/src/*, packages/core/src/*, packages/translation-prompt/src/*, packages/chatwork/src/*)
  └── packages/webhook-logger/tsconfig.json (paths: ~/* → packages/webhook-logger/src/*, packages/core/src/*, packages/chatwork/src/*)
```

Cross-package imports (`@chatwork-bot/core`) resolve via Bun workspace symlinks in
`node_modules`, not tsconfig paths. Do not add cross-package entries to tsconfig `paths`.
Each package tsconfig defines `paths: { "~/*": [...] }` for intra-package imports.
Do NOT add `~/` to `tsconfig.base.json` — `baseUrl` differs between root and packages.
Dependent packages must include core's src path in their `~/*` mapping since core sources
are loaded directly (via `"main": "./src/index.ts"`) and contain `~/` imports.
Packages that import translation-prompt (whose source files contain `~/schemas/*` and `~/sections/*` imports) must also include `packages/translation-prompt/src/*` in their `~/*` mapping.
