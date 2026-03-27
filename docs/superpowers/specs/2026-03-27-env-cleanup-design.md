# Env Cleanup — Design Spec

**Version:** 1.0
**Date:** 2026-03-27
**Prepared by:** AI-assisted (Claude Code + user collaboration)
**Status:** Approved

---

## Objective

Clean up `.env`, `.env.example`, and the `ProviderManifest` interface after the system migrated from globally-configured env vars to per-room JSON config (Phase 4 of the dashboard multi-room spec). Seven env vars that were moved to per-room JSON storage are still present in `.env`. The `ProviderManifest` interface still carries a `requiredEnvKeys` field that no longer reflects reality.

---

## Definition of Done

1. `.env` no longer contains the 7 obsolete vars from the old global-config system
2. `.env` structure mirrors `.env.example` (same sections, same ordering)
3. `.env.example` documents 3 new optional "operational knobs" that exist in code but were undocumented
4. `requiredEnvKeys` is removed entirely from `ProviderManifest` interface, all provider plugins, the health endpoint, and all tests
5. `bun test && bun run typecheck && bun run lint` passes

---

## Scope

### In Scope

- `.env` rewrite: remove obsolete vars, add missing vars, sync structure to `.env.example`
- `.env.example` additions: 3 new optional commented-out vars
- `ProviderManifest` interface: remove `requiredEnvKeys` field
- 3 provider plugins: remove `requiredEnvKeys` from manifest objects
- `provider-health.ts` route: remove `requiredEnvKeys` from response
- Tests: update fixtures in `startup-banner.test.ts` and `provider-health.test.ts`

### Out of Scope

- `DATASET_CLEAR_OUTPUT` removal (deprecated but still in dataset-runner Zod schema)
- Dockerfile changes
- docker-compose changes
- Any runtime behavior changes

---

## Changes

### 1. `.env` — Full Rewrite

Rewrite to match `.env.example` structure exactly (same section headers, same ordering).

**Remove (7 vars — moved to per-room JSON config):**

| Var                            | Was used by           | Now lives in                        |
| ------------------------------ | --------------------- | ----------------------------------- |
| `CHATWORK_DESTINATION_ROOM_ID` | translator (old)      | `roomConfig.destinationRoomId`      |
| `CHATWORK_WEBHOOK_SECRET`      | webhook-logger (old)  | `roomConfig.encryptedWebhookSecret` |
| `AI_PROVIDER`                  | translator (old)      | `roomConfig.aiProvider`             |
| `AI_MODEL`                     | translator (old)      | `roomConfig.aiModel`                |
| `AI_TRANSLATION_STYLE`         | translator (old)      | `roomConfig.translationStyle`       |
| `GOOGLE_GENERATIVE_AI_API_KEY` | provider-gemini (old) | `roomConfig.encryptedAiApiToken`    |
| `OPENAI_API_KEY`               | provider-openai (old) | `roomConfig.encryptedAiApiToken`    |

**Add (2 vars — present in `.env.example` and code, missing from `.env`):**

| Var                       | Default                 | Used by                   |
| ------------------------- | ----------------------- | ------------------------- |
| `TRANSLATOR_INTERNAL_URL` | `http://localhost:3000` | webhook-logger env schema |
| `GATEWAY_PORT`            | `8080`                  | docker-compose.dev.yml    |

**Keep (all other vars)** with existing values, including intentional customizations:

- `DATASET_COOLDOWN_MS=30000` (custom, `.env.example` default is `2000`)
- `DATASET_ITEM_TIMEOUT_MS=3600000` (custom, `.env.example` default is `1800000`)

**Target section structure:**

```
# === Chatwork Bot Account ===
# === Multi-Room Config (Phase 4+) ===
# === Translator Service ===
  # --- Translator observability (optional) ---
# === Webhook Logger ===
# === Dev Gateway (Docker dev only) ===
# === Ingress / Tunnel (Docker dev only) ===
# === Dataset Runner (local dev only) ===
# === Removed (moved to per-room config via dashboard) ===
```

---

### 2. `.env.example` — Additions Only

No deletions. Add 3 optional vars as commented-out lines with default values.

**Add to `# === Multi-Room Config (Phase 4+) ===`:**

```bash
# Data directory for room-configs.json (optional)
# ROOM_CONFIG_DATA_DIR=./data
```

**Add to `# === Translator Service ===` — after observability vars:**

```bash
# Hard cap for entire translation pipeline (optional)
# TRANSLATOR_PIPELINE_TIMEOUT_MS=1800000
```

**Add new section before `# === Removed` at end of file:**

```bash
# === Provider Tuning (optional) ===
# OpenAI reasoning effort for models that support extended thinking (gpt-5.x, o-series)
# Valid values: low | medium | high
# OPENAI_REASONING_EFFORT=medium
```

---

### 3. `ProviderManifest` interface — Remove `requiredEnvKeys`

**File:** `packages/core/src/interfaces/provider-plugin.ts` (ProviderManifest interface)

Remove the `requiredEnvKeys: readonly string[]` field entirely.

**Rationale:** In the per-room system, providers receive their API key via `ctx.apiKey` (decrypted from `roomConfig.encryptedAiApiToken`). `requiredEnvKeys` no longer reflects runtime requirements and is not validated anywhere at startup. Keeping it as `[]` would be dead weight; removing it is cleaner.

---

### 4. Provider Plugins — Remove `requiredEnvKeys`

Remove the `requiredEnvKeys` field from the manifest object in each plugin:

| File                                            | Current value                      | Action       |
| ----------------------------------------------- | ---------------------------------- | ------------ |
| `packages/provider-openai/src/openai-plugin.ts` | `['OPENAI_API_KEY']`               | Remove field |
| `packages/provider-gemini/src/gemini-plugin.ts` | `['GOOGLE_GENERATIVE_AI_API_KEY']` | Remove field |
| `packages/provider-cursor/src/cursor-plugin.ts` | `['CURSOR_API_URL']`               | Remove field |

Note: `CURSOR_API_URL` is still a real env var used by cursor's startup guard, but the startup guard reads it directly from `process.env['CURSOR_API_URL']` — not via `requiredEnvKeys`.

---

### 5. `provider-health.ts` Route — Remove from Response

**File:** `packages/translator/src/routes/provider-health.ts`

Remove `requiredEnvKeys: p.manifest.requiredEnvKeys` from the response shape. Update the response type accordingly.

---

### 6. Tests — Update Fixtures

**`packages/core/src/interfaces/provider-plugin.test.ts`:**

- Remove `requiredEnvKeys` from fixture object

**`packages/core/src/services/provider-registry.test.ts`:**

- Remove `requiredEnvKeys` from fixture object

**`packages/translator/src/bootstrap/startup-banner.test.ts`:**

- Remove `requiredEnvKeys` field from all mock plugin fixture objects (3 instances)

**`packages/translator/src/routes/provider-health.test.ts`:**

- Remove `requiredEnvKeys` from mock plugin fixture
- Remove `requiredEnvKeys` from response shape assertions

---

## File Impact Map

```
.env                                                    ← rewrite
.env.example                                            ← additions only
packages/core/src/interfaces/provider-plugin.ts         ← remove field from ProviderManifest
packages/core/src/interfaces/provider-plugin.test.ts    ← update fixture
packages/core/src/services/provider-registry.test.ts    ← update fixture
packages/provider-openai/src/openai-plugin.ts           ← remove field
packages/provider-gemini/src/gemini-plugin.ts           ← remove field
packages/provider-cursor/src/cursor-plugin.ts           ← remove field
packages/translator/src/routes/provider-health.ts       ← remove from response
packages/translator/src/bootstrap/startup-banner.test.ts ← update fixtures
packages/translator/src/routes/provider-health.test.ts  ← update fixtures
```

---

## Risk & Safety

| Risk                                                     | Mitigation                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `.env` rewrite accidentally changes a value              | Spec lists every kept var explicitly; values are copied verbatim             |
| Removing `requiredEnvKeys` breaks TypeScript compilation | TypeScript strict mode will catch any remaining references at typecheck time |
| `/api/provider-health` response contract changes         | Internal dashboard endpoint only; no external consumers                      |
| Test fixtures out of sync after field removal            | TypeScript will error on unknown fields in typed fixtures                    |

---

## Acceptance Criteria

1. `bun test && bun run typecheck && bun run lint` passes after all changes
2. `.env` diff shows exactly: −7 vars removed, +2 vars added, structure reorganized
3. `.env.example` diff shows: +3 commented-out vars added, no deletions
4. No `requiredEnvKeys` reference exists anywhere in the codebase (grep confirms)
5. `GET /api/provider-health` response no longer includes `requiredEnvKeys` field
