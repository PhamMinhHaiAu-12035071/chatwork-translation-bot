# Plugin Registry Cursor Big-Bang Design

**Status:** Proposed (ready for implementation)
**Date:** 2026-03-06
**Last refined:** 2026-03-06 (post-interview round 2 — decisions locked)
**Owner:** Translation platform (monorepo)

---

## 1) Context

The current translation provider selection uses a centralized branch-based factory in `@chatwork-bot/core`. This works for two providers, but it couples provider growth to factory edits and makes large-scale extension harder.

The target is a production-ready architecture that is:

- loose-coupled
- scalable for additional providers
- strict on configuration safety
- operationally deterministic

Decisions already confirmed:

- Big-bang cutover (internal breaking changes accepted)
- Keep runtime command: `bun run dev`
- Provider/model selected from env
- No automatic provider fallback
- Timeout + transient retry only (`p-retry` package)
- `/internal/translate` remains fire-and-forget
- Shared prompt utilities (`TranslationSchema`, `buildTranslationPrompt`) extracted to `@chatwork-bot/translation-prompt` package
- Env validation via `z.discriminatedUnion()` (Zod v4 native API)
- Shared-secret comparison via `crypto.timingSafeEqual`
- `cursor-api-proxy` is a community tool (LOCAL DEV ONLY) — pin exact version, document risk
- Cursor proxy started manually by developer before `bun run dev` (fail-fast guard if not reachable)

---

## 2) Goals and Non-Goals

### Goals

1. Replace branch-based provider construction with plugin registry architecture.
2. Split providers into dedicated workspace packages:
   - `@chatwork-bot/translation-prompt` (shared prompt utilities)
   - `@chatwork-bot/provider-gemini`
   - `@chatwork-bot/provider-openai`
   - `@chatwork-bot/provider-cursor`
3. Enforce strict provider-model pairing via discriminated union env validation.
4. Add Cursor provider through OpenAI-compatible interface.
5. Harden runtime behavior:
   - fail-fast startup on invalid config/boot state
   - timeout + retry for transient failures
6. Improve operator UX:
   - structured JSON logs
   - runbook-first error handling
   - provider detail health endpoint

### Non-Goals

1. No dynamic runtime provider switching API.
2. No fallback provider chain.
3. No OTel/tracing platform rollout in this phase.
4. No change to external Chatwork webhook contract shape.

---

## 3) High-Level Architecture

### 3.1 Plugin Model

Each provider package exports:

- translation service implementation
- provider plugin object (manifest + `create(...)`)

`@chatwork-bot/translation-prompt` hosts:

- `TranslationSchema` (Zod schema for structured output)
- `buildTranslationPrompt(text)` (prompt builder)
- Imported by all provider packages — single source of truth for prompt logic

`@chatwork-bot/core` hosts:

- plugin interfaces/contracts (`ITranslationService`, `TranslationError`, `TranslationResult`)
- provider registry (register, resolve, list)
- shared AI domain types (`AIProvider`, `GeminiModel`, `OpenAIModel`, `CursorModel`, model value arrays)

`packages/translator` hosts:

- explicit bootstrap that registers official provider plugins
- env validation and startup guards
- request handling, retry policy integration, route security

### 3.2 Control Flow

1. App startup:
   - Validate env via discriminated union.
   - Register plugins explicitly in bootstrap.
   - Run startup guards.
2. Request handling:
   - Resolve provider from env.
   - Resolve provider plugin from registry.
   - Build service with provider-specific options.
   - Execute translation with timeout + retry policy.
3. Logging/ops:
   - Emit structured JSON fields.
   - Keep basic `/health` + separate provider detail endpoint.

---

## 4) Design Decisions

## D1. Big-Bang Migration (chosen)

**Decision:** Replace old factory behavior directly, not incremental dual-mode runtime.

**Why:** Avoid long-lived dual architecture complexity and hidden drift between old/new paths.

**Trade-off:** Higher migration risk in one window; mitigated by strict tests and freeze window rollout.

## D2. Explicit Bootstrap (chosen)

**Decision:** Use explicit provider registration in translator composition root.

**Why:** Deterministic startup, auditable dependency graph, easier production governance.

**Trade-off:** Requires explicit imports when adding providers.

## D3. Provider Packages Split Now (chosen)

**Decision:** Extract providers into dedicated workspace packages immediately.

**Why:** Clear ownership boundaries, scalable package-level extension, cleaner monorepo architecture.

**Trade-off:** More file/package churn in initial refactor.

## D4. Strict Env Contract (chosen)

**Decision:** Discriminated union by `AI_PROVIDER`, with provider-specific `AI_MODEL` domain.

**Why:** Prevent invalid provider-model combinations at boot, reduce runtime ambiguity.

**Trade-off:** Model list updates required when new upstream models are added.

## D5. Translation Prompt as Dedicated Package (chosen)

**Decision:** Extract `TranslationSchema` and `buildTranslationPrompt` into `@chatwork-bot/translation-prompt` package at `packages/translation-prompt/`.

**Why:** Avoids code duplication across provider packages. All providers depend on the same prompt logic. Keeping it in `@chatwork-bot/core` would bloat core with provider-implementation details; copying per-package creates drift.

**Trade-off:** One additional monorepo package. Mitigated by small size and clear ownership.

---

## D6. Runtime Policies (chosen)

**Decision:**

- fail-fast boot on invalid/unsupported provider state
- timeout + transient retry via `p-retry` package (battle-tested, exponential backoff with jitter)
- no provider fallback
- cursor proxy must be started manually before `bun run dev`; startup guard checks proxy reachability and prints actionable error with fix instructions

**Why:** Predictable behavior, easier incident triage. `p-retry` avoids writing retry boilerplate and handles edge cases (abort signal, retry filtering). Manual proxy startup keeps `bun run dev` unchanged.

---

## 5) Configuration Model

## 5.1 Required Runtime Shape

- `AI_PROVIDER` in `{ gemini | openai | cursor }`
- `AI_MODEL` validated against selected provider model set (strict per-provider enum)
- Provider-specific defaults if `AI_MODEL` is omitted
- `CURSOR_MODEL_VALUES`: hardcoded known list with open-ended escape hatch (`string & {}`) to allow custom/future models via env without code change

Cursor-specific:

- `CURSOR_API_URL` must be localhost/127.0.0.1 policy (enforced in Zod)

Security:

- `INTERNAL_TRANSLATE_SECRET` required for `/internal/translate`
- Comparison via `crypto.timingSafeEqual` — prevents timing attacks

## 5.2 Zod v4 Discriminated Union Pattern

Use `z.discriminatedUnion('AI_PROVIDER', [...])` natively in Zod v4 — each branch defines its own `AI_MODEL` enum. Cross-branch model leak is impossible at schema level.

```typescript
// Sketch — actual implementation in Task 10
z.discriminatedUnion('AI_PROVIDER', [
  z.object({ AI_PROVIDER: z.literal('gemini'), AI_MODEL: z.enum(GEMINI_MODEL_VALUES).optional() }),
  z.object({ AI_PROVIDER: z.literal('openai'), AI_MODEL: z.enum(OPENAI_MODEL_VALUES).optional() }),
  z.object({
    AI_PROVIDER: z.literal('cursor'),
    AI_MODEL: z.enum(CURSOR_MODEL_VALUES).or(z.string().min(1)).optional(),
    CURSOR_API_URL: z
      .string()
      .url()
      .refine((u) => /^https?:\/\/(localhost|127\.0\.0\.1)/.test(u)),
  }),
])
```

## 5.3 Validation Behavior

Invalid config must:

1. fail startup (process.exit(1))
2. print actionable multi-line error
3. list supported values and example fix

---

## 6) API and Operational Behavior

### 6.1 Internal Translation Endpoint

- Keep fire-and-forget behavior (return quickly)
- Add app-layer shared-secret check

### 6.2 Health

- `/health`: basic liveness
- `/health/provider` (or equivalent): active provider/model/registry readiness details

### 6.3 Structured Logs

Mandatory fields:

- `requestId`
- `provider`
- `model`
- `latencyMs`
- `outcome`
- `errorCode`
- `eventType`

---

## 7) Risks and Mitigations

## R1. Big-bang regression risk

**Mitigation:** 3-batch PR strategy, freeze window, full gate + targeted integration tests.

## R2. Upstream model naming drift

**Mitigation:** Centralized provider model lists + explicit update process and docs.

## R3. Cursor proxy availability issues

**Mitigation:** fail-fast startup checks and deterministic incident runbook.

## R4. Misconfiguration in multi-env setups

**Mitigation:** strict env schema + actionable errors + `.env.example` matrix update.

## R5. cursor-api-proxy is a community npm package (not official Cursor)

**Risk:** Package may be unmaintained, change behavior, or disappear.

**Mitigation:**

- Pin exact version in `devDependencies` (not `latest`)
- Mark as LOCAL DEV ONLY in README and runbook — production must not use cursor provider via community proxy
- Document fallback: switch `AI_PROVIDER=gemini` or `openai` for production

## R6. Timing attack on shared-secret endpoint

**Mitigation:** Use `crypto.timingSafeEqual` for all shared-secret comparisons. Constant-time comparison prevents secret enumeration via response timing.

---

## 8) Testing Strategy

1. Unit tests:
   - plugin interfaces/manifest expectations
   - registry behavior (register/resolve/duplicate/missing)
   - env discriminated union validation
2. Provider package tests:
   - plugin create + model support + error mapping
3. Integration tests:
   - translator bootstrap + registry resolution + handler path
   - route auth and fire-and-forget behavior
4. Quality gate:
   - `bun test`
   - `bun run typecheck`
   - `bun run lint`

---

## 9) Documentation and Governance Updates

Mandatory updates:

- `README.md`
- `.env.example`
- `CLAUDE.md`
- `AGENTS.md`
- `ai_rules/architecture-patterns.md`
- `ai_rules/export-patterns.md`
- `ai_rules/commands.md`
- `ai_rules/security.md`
- `ai_rules/project-structure.md`
- `ai_rules/commit-conventions.md` (if batching workflow details are codified)

New docs:

- architecture note for plugin registry
- operator runbook for deterministic incident response

---

## 10) Rollout Plan

Cutover in short maintenance/freeze window with 3 PR batches:

1. Registry contracts + infrastructure
2. Provider package extraction + Cursor provider
3. Translator wiring + security + observability + docs/rules

No runtime feature flag; direct cutover by design.

---

## 11) Definition of Done

Complete when all are true:

1. Plugin registry architecture is active in production path.
2. Providers run from dedicated `@chatwork-bot/provider-*` packages.
3. `bun run dev` remains the only local run command.
4. Provider-model validation is strict and type-safe.
5. Startup fail-fast + timeout/retry policy is active.
6. `/internal/translate` shared-secret protection is active.
7. Structured JSON logging contract is implemented.
8. Basic health + provider detail health endpoints are available.
9. Full quality gate passes.
10. Docs/rules are fully updated and consistent.
