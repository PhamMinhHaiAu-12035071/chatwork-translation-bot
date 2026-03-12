# Chatwork Package Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move all Chatwork-specific integration code into a new `@chatwork-bot/chatwork`
package, replace raw Chatwork webhook usage with a neutral translator ingress DTO, add real
webhook signature verification, and preserve current runtime behavior as closely as possible.

**Architecture:** Introduce `@chatwork-bot/chatwork` as the single anti-corruption layer for
Chatwork. Keep `@chatwork-bot/core` free of Chatwork-specific contracts by adding a neutral
translator ingress DTO there. Update `webhook-logger`, `translator`, and `dataset-runner` to
consume Chatwork intent-oriented use cases instead of Chatwork-specific clients and webhook
types.

**Tech Stack:** Bun workspaces, TypeScript ESM strict mode, Elysia, Zod, TypeBox, Bun test,
ESLint, Prettier

---

## Interview Decisions (2026-03-12)

These decisions were confirmed by the author before implementation began:

| Topic                        | Decision                                                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Raw body handling            | Elysia `.derive(async ({ request }) => ({ rawBody: await request.clone().text() }))` — clone preserves stream for JSON parser |
| Member name cache            | In-memory `Map<number, string>` per translation request, passed into `resolveRoomMemberDisplayName`                           |
| Rate-limit retry             | Package throws `ChatworkRateLimitError` with `retryAfter`; callers decide retry strategy                                      |
| Schema library               | TypeBox only — consistent with Elysia and existing webhook-logger pattern                                                     |
| HTTP mock in tests           | `spyOn(globalThis, 'fetch', ...)` via Bun test; real `api.chatwork.com` must be rejected in tests                             |
| Verification opt-out env var | `CHATWORK_SKIP_SIGNATURE_VERIFY=false`; only respected in `development`/`local`, never in `production`                        |
| Audit snapshot type          | `Record<string, unknown>` in `@chatwork-bot/core`                                                                             |
| DTO route validation         | `TranslationIngressCommandSchema` (TypeBox) exported from `core`, used in Elysia route                                        |
| `listRoomMessages`           | Include in v1 public API with `force` param support                                                                           |
| Core consumers               | Only `translator`, `webhook-logger`, `dataset-runner` — one-pass removal is safe                                              |
| Package structure            | `src/http/`, `src/services/`, `src/types/`, `src/errors/`, `src/interfaces/`                                                  |
| Execution mode               | Isolated git worktree                                                                                                         |

---

## Preconditions

- Execute this plan in a dedicated worktree, not the current dirty workspace.
- Read these files before implementing:
  - `docs/plans/2026-03-12-chatwork-package-refactor-design.md`
  - `AGENTS.md`
  - `CLAUDE.md`
  - `ai_rules/project-structure.md`
  - `ai_rules/type-organization.md`
  - `ai_rules/export-patterns.md`
  - `ai_rules/test-colocation.md`
  - `ai_rules/security.md`

### Task 1: Scaffold the New Package

**Files:**

- Create: `packages/chatwork/package.json`
- Create: `packages/chatwork/tsconfig.json`
- Create: `packages/chatwork/src/index.ts`
- Create: `packages/chatwork/src/services/.gitkeep`
- Create: `packages/chatwork/src/types/.gitkeep`
- Create: `packages/chatwork/src/interfaces/.gitkeep`
- Test: `scripts/verify-standards.ts` via standard verification command

**Step 1: Write the failing standards check expectation**

Document the package shape first:

```json
{
  "name": "@chatwork-bot/chatwork",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "lint": "eslint \"**/*.ts\"",
    "lint:fix": "eslint \"**/*.ts\" --fix",
    "format": "prettier --write \"**/*.{ts,tsx,json,md,yml,yaml}\"",
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  }
}
```

**Step 2: Run standards verification before creating files**

Run: `bun run verify:standards`
Expected: PASS now, but note that the new package does not exist yet.

**Step 3: Add the package skeleton**

Create the new package using the repo’s normal workspace layout and `~/` alias conventions.

**Step 4: Re-run standards verification**

Run: `bun run verify:standards`
Expected: PASS with the new package included.

**Step 5: Commit**

```bash
git add packages/chatwork
git commit -m "refactor(repo): scaffold chatwork package"
```

### Task 2: Define Neutral Translator Ingress Contracts in Core

**Files:**

- Create: `packages/core/src/types/translation-ingress.ts`
- Create: `packages/core/src/types/translation-ingress.test.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/types/translation-ingress.test.ts`

**Step 1: Write the failing test**

Add compile/runtime-shape tests for a neutral ingress contract:

```ts
import { describe, expect, it } from 'bun:test'
import type { TranslationIngressCommand } from './translation-ingress'

describe('TranslationIngressCommand', () => {
  it('accepts a neutral source payload plus raw snapshot metadata', () => {
    const command: TranslationIngressCommand = {
      sourceSystem: 'chatwork',
      sourceMessageId: 'm1',
      sourceRoomId: 42,
      senderAccountId: 99,
      rawBody: '[To:1] hello',
      translatableText: 'hello',
      sendTime: 1,
      updateTime: 0,
      audit: {
        receivedAt: '2026-03-12T00:00:00.000Z',
        rawSourceSnapshot: { provider: 'chatwork' },
      },
    }

    expect(command.translatableText).toBe('hello')
  })
})
```

**Step 2: Run the test to verify it fails**

Run: `bun test packages/core/src/types/translation-ingress.test.ts`
Expected: FAIL because the contract file does not exist.

**Step 3: Implement the neutral types**

Create neutral exported contracts only. Do not import Chatwork-specific types into this file.

Export both:

- `TranslationIngressCommand` — TypeScript type
- `TranslationIngressCommandSchema` — TypeBox `TObject` schema (used by `translator` Elysia route for body validation)

`audit.rawSourceSnapshot` type must be `Record<string, unknown>` (opaque; callers cast when needed).

**Step 4: Export the new types from core**

Update `packages/core/src/index.ts` so consumers can import both the type and TypeBox schema from `@chatwork-bot/core`.

**Step 5: Re-run the focused test**

Run: `bun test packages/core/src/types/translation-ingress.test.ts`
Expected: PASS.

**Step 6: Commit**

```bash
git add packages/core/src/types/translation-ingress.ts packages/core/src/types/translation-ingress.test.ts packages/core/src/index.ts
git commit -m "feat(core): add neutral translation ingress contract"
```

### Task 3: Add Failing Tests for Chatwork Inbound Security and Mapping

**Files:**

- Create: `packages/chatwork/src/types/webhook.ts`
- Create: `packages/chatwork/src/types/webhook.test.ts`
- Create: `packages/chatwork/src/services/verify-webhook-signature.ts`
- Create: `packages/chatwork/src/services/verify-webhook-signature.test.ts`
- Create: `packages/chatwork/src/services/normalize-webhook-payload.ts`
- Create: `packages/chatwork/src/services/normalize-webhook-payload.test.ts`
- Create: `packages/chatwork/src/services/map-webhook-to-translation-command.ts`
- Create: `packages/chatwork/src/services/map-webhook-to-translation-command.test.ts`
- Modify: `packages/chatwork/src/index.ts`

**Step 1: Write failing signature-verification tests**

Cover:

- valid signature passes
- invalid signature throws `ChatworkWebhookSignatureError`
- production path cannot silently skip verification
- explicit non-production bypass is honored only when caller opts in

Use a raw JSON string fixture and a real HMAC digest generated in the test.

**Step 2: Write failing payload-normalization tests**

Cover:

- valid `message_created` payload normalizes successfully
- malformed JSON throws payload error
- missing required fields throws payload error
- string/number coercion rules match current webhook normalization behavior where intended

**Step 3: Write failing mapping tests**

Cover:

- mapped DTO contains `rawBody`, `translatableText`, IDs, timestamps, and raw snapshot
- Chatwork markup is stripped before `translatableText` is produced
- non-message events are rejected or filtered according to the approved design

**Step 4: Run the inbound package tests**

Run:

- `bun test packages/chatwork/src/services/verify-webhook-signature.test.ts`
- `bun test packages/chatwork/src/services/normalize-webhook-payload.test.ts`
- `bun test packages/chatwork/src/services/map-webhook-to-translation-command.test.ts`

Expected: FAIL because implementations and types do not exist yet.

**Step 5: Implement the webhook types and inbound use cases**

Rules:

- keep Chatwork-specific schemas/types in `packages/chatwork/src/types/`
- keep use cases in `packages/chatwork/src/services/`
- export only the approved public functions from `packages/chatwork/src/index.ts`

**Step 6: Re-run the focused tests**

Run:

- `bun test packages/chatwork/src/services/verify-webhook-signature.test.ts`
- `bun test packages/chatwork/src/services/normalize-webhook-payload.test.ts`
- `bun test packages/chatwork/src/services/map-webhook-to-translation-command.test.ts`

Expected: PASS.

**Step 7: Commit**

```bash
git add packages/chatwork/src/types/webhook.ts packages/chatwork/src/types/webhook.test.ts packages/chatwork/src/services/verify-webhook-signature.ts packages/chatwork/src/services/verify-webhook-signature.test.ts packages/chatwork/src/services/normalize-webhook-payload.ts packages/chatwork/src/services/normalize-webhook-payload.test.ts packages/chatwork/src/services/map-webhook-to-translation-command.ts packages/chatwork/src/services/map-webhook-to-translation-command.test.ts packages/chatwork/src/index.ts
git commit -m "feat(repo): add chatwork inbound verification and mapping"
```

### Task 4: Add Failing Tests for Chatwork Outbound HTTP Use Cases

**Files:**

- Create: `packages/chatwork/src/types/message.ts`
- Create: `packages/chatwork/src/types/message.test.ts`
- Create: `packages/chatwork/src/interfaces/chatwork-api.ts`
- Create: `packages/chatwork/src/errors/chatwork-api-error.ts`
- Create: `packages/chatwork/src/errors/chatwork-api-error.test.ts`
- Create: `packages/chatwork/src/http/chatwork-api-client.ts`
- Create: `packages/chatwork/src/http/chatwork-api-client.test.ts`
- Create: `packages/chatwork/src/services/send-room-message.ts`
- Create: `packages/chatwork/src/services/send-room-message.test.ts`
- Create: `packages/chatwork/src/services/delete-room-message.ts`
- Create: `packages/chatwork/src/services/delete-room-message.test.ts`
- Create: `packages/chatwork/src/services/get-room-members.ts`
- Create: `packages/chatwork/src/services/get-room-members.test.ts`
- Create: `packages/chatwork/src/services/get-room-message.ts`
- Create: `packages/chatwork/src/services/get-room-message.test.ts`
- Create: `packages/chatwork/src/services/list-room-messages.ts`
- Create: `packages/chatwork/src/services/list-room-messages.test.ts`
- Create: `packages/chatwork/src/services/resolve-room-member-display-name.ts`
- Create: `packages/chatwork/src/services/resolve-room-member-display-name.test.ts`
- Modify: `packages/chatwork/src/index.ts`

**Step 1: Write failing HTTP client tests**

Mock strategy: use `spyOn(globalThis, 'fetch', ...)` from Bun test. In test setup, install a spy that throws `new Error('Unexpected real HTTP call')` by default; override per-test with the desired mock response. Never allow tests to reach `api.chatwork.com`.

Cover:

- `sendRoomMessage` sends form-encoded POST with `X-ChatWorkToken` header
- `deleteRoomMessage` hits the correct DELETE endpoint
- `getRoomMembers`, `getRoomMessage`, and `listRoomMessages` hit the correct GET endpoints
- `listRoomMessages` includes `force` query param when requested
- error responses parse Chatwork error arrays
- `ChatworkRateLimitError` is thrown on 429 with `retryAfter` populated from `Retry-After` header
- rate-limit headers are captured on both success and failure paths
- test environment rejects accidental calls to real `api.chatwork.com`

**Step 2: Write failing display-name resolution tests**

`resolveRoomMemberDisplayName(roomId, accountId, token, cache?)` accepts an optional `Map<number, string>` cache parameter. When provided, the function reads from and writes to the map, avoiding redundant API calls within the same request scope.

Cover:

- returns matching member name and writes to cache
- second call for same `accountId` uses cached value (no additional fetch call)
- falls back to `#account_id` when member not found in API response
- surfaces typed API errors when member loading fails

**Step 3: Run the focused outbound tests**

Run:

- `bun test packages/chatwork/src/http/chatwork-api-client.test.ts`
- `bun test packages/chatwork/src/services/send-room-message.test.ts`
- `bun test packages/chatwork/src/services/delete-room-message.test.ts`
- `bun test packages/chatwork/src/services/get-room-members.test.ts`
- `bun test packages/chatwork/src/services/get-room-message.test.ts`
- `bun test packages/chatwork/src/services/list-room-messages.test.ts`
- `bun test packages/chatwork/src/services/resolve-room-member-display-name.test.ts`

Expected: FAIL because the outbound layer does not exist yet.

**Step 4: Implement the outbound layer**

Rules:

- low-level fetch wrapper stays internal to the package
- public services stay intent-oriented
- all outbound failures throw typed errors

**Step 5: Re-run the focused outbound tests**

Run the same commands as Step 3.
Expected: PASS.

**Step 6: Commit**

```bash
git add packages/chatwork/src/types/message.ts packages/chatwork/src/types/message.test.ts packages/chatwork/src/interfaces/chatwork-api.ts packages/chatwork/src/errors/chatwork-api-error.ts packages/chatwork/src/errors/chatwork-api-error.test.ts packages/chatwork/src/http/chatwork-api-client.ts packages/chatwork/src/http/chatwork-api-client.test.ts packages/chatwork/src/services/send-room-message.ts packages/chatwork/src/services/send-room-message.test.ts packages/chatwork/src/services/delete-room-message.ts packages/chatwork/src/services/delete-room-message.test.ts packages/chatwork/src/services/get-room-members.ts packages/chatwork/src/services/get-room-members.test.ts packages/chatwork/src/services/get-room-message.ts packages/chatwork/src/services/get-room-message.test.ts packages/chatwork/src/services/list-room-messages.ts packages/chatwork/src/services/list-room-messages.test.ts packages/chatwork/src/services/resolve-room-member-display-name.ts packages/chatwork/src/services/resolve-room-member-display-name.test.ts packages/chatwork/src/index.ts
git commit -m "feat(repo): add chatwork outbound message services"
```

### Task 5: Wire the New Package into Consumers

**Files:**

- Modify: `packages/translator/package.json`
- Modify: `packages/webhook-logger/package.json`
- Modify: `packages/dataset-runner/package.json`
- Modify: `packages/translator/tsconfig.json`
- Modify: `packages/webhook-logger/tsconfig.json`
- Modify: `packages/dataset-runner/tsconfig.json`

**Step 1: Update workspace dependencies**

Add `@chatwork-bot/chatwork` as a workspace dependency to all consuming packages.

**Step 2: Verify package manager and TypeScript resolution**

Run: `bun run typecheck`
Expected: FAIL at this stage if imports have not been migrated yet, but package resolution should
see the new workspace.

**Step 3: Install workspace dependencies**

Run: `bun install`

This regenerates `bun.lockb` to include the new `@chatwork-bot/chatwork` workspace package. Commit the updated lockfile together with the package.json changes.

**Step 4: Commit**

```bash
git add packages/translator/package.json packages/webhook-logger/package.json packages/dataset-runner/package.json packages/translator/tsconfig.json packages/webhook-logger/tsconfig.json packages/dataset-runner/tsconfig.json bun.lockb
git commit -m "chore(repo): wire chatwork workspace dependency"
```

### Task 6: Refactor Webhook Logger to Raw-Body Verification and DTO Forwarding

**Files:**

- Modify: `packages/webhook-logger/src/env.ts`
- Modify: `packages/webhook-logger/src/routes/webhook.ts`
- Modify: `packages/webhook-logger/src/routes/webhook.test.ts`
- Modify: `packages/webhook-logger/src/app.test.ts`

**Step 1: Rewrite the failing route tests first**

Add or replace tests so they cover:

- valid raw body + valid HMAC signature -> 200 and neutral DTO forwarded to translator
- missing `X-ChatWorkWebhookSignature` header -> 422 rejection
- invalid signature -> `ChatworkWebhookSignatureError` caught and mapped to rejection
- valid signature + malformed JSON body -> payload rejection
- valid signature + valid JSON but missing fields -> payload rejection
- `CHATWORK_SKIP_SIGNATURE_VERIFY=true` in development bypasses verification and logs warning
- `CHATWORK_SKIP_SIGNATURE_VERIFY=true` in production is ignored (verification still runs)
- forwarding failure behavior remains the same

Include a test fixture that generates a real HMAC-SHA256 digest over the raw JSON string and attaches it as `X-ChatWorkWebhookSignature`.

Use Elysia's test client (or `new Request(...)` pattern) to send raw body with the signature header intact.

**Step 2: Run the webhook route tests**

Run:

- `bun test packages/webhook-logger/src/routes/webhook.test.ts`
- `bun test packages/webhook-logger/src/app.test.ts`

Expected: FAIL because the route still assumes parsed JSON body.

**Step 3: Refactor the route**

Implementation rules:

- Use Elysia `.derive(async ({ request }) => ({ rawBody: await request.clone().text() }))` to make the raw body available in route handlers. Cloning preserves the original stream for Elysia's JSON parser while exposing the raw string for HMAC verification. Do not use `onRequest` alone — it cannot inject derived per-request values into handlers.
- In the route handler, pass `rawBody` and the `X-ChatWorkWebhookSignature` header to `verifyWebhookSignature(...)` from `@chatwork-bot/chatwork`.
- After verification, parse `store.rawBody` and normalize through `normalizeWebhookPayload(...)`.
- Map to neutral DTO with `mapWebhookToTranslationCommand(...)`.
- Forward the neutral DTO (not `ChatworkWebhookEvent`) to translator.
- Add `CHATWORK_SKIP_SIGNATURE_VERIFY` to `webhook-logger` env schema (boolean, default `false`). Only allow bypass when `NODE_ENV !== 'production'` AND the flag is `true`. Log a warning when bypass is active.
- Keep structured logs compatible where possible.

**Step 4: Re-run the focused tests**

Run:

- `bun test packages/webhook-logger/src/routes/webhook.test.ts`
- `bun test packages/webhook-logger/src/app.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/webhook-logger/src/env.ts packages/webhook-logger/src/routes/webhook.ts packages/webhook-logger/src/routes/webhook.test.ts packages/webhook-logger/src/app.test.ts
git commit -m "refactor(webhook-logger): verify raw chatwork webhooks"
```

### Task 7: Refactor Translator Ingress to the Neutral DTO

**Files:**

- Modify: `packages/translator/src/webhook/router.ts`
- Modify: `packages/translator/src/webhook/router.test.ts`
- Modify: `packages/translator/src/webhook/handler.ts`
- Modify: `packages/translator/src/webhook/handler.test.ts`
- Modify: `packages/translator/src/types/output.ts`
- Modify: `packages/translator/src/utils/output-writer.ts`
- Modify: `packages/translator/src/utils/output-writer.test.ts`

**Step 1: Rewrite the failing translator tests**

Replace Chatwork-webhook-based fixtures with the new neutral DTO.

Cover:

- route accepts the neutral DTO
- handler still skips unsupported/non-translatable cases appropriately
- output writer preserves current output shape using the audit snapshot
- delivery metadata still lands in rewritten output files

**Step 2: Run the translator-focused tests**

Run:

- `bun test packages/translator/src/webhook/router.test.ts`
- `bun test packages/translator/src/webhook/handler.test.ts`
- `bun test packages/translator/src/utils/output-writer.test.ts`

Expected: FAIL because translator still expects `ChatworkWebhookEvent`.

**Step 3: Refactor the route, handler, and output types**

Implementation rules:

- `router.ts` validates the neutral DTO, not a Chatwork schema
- `handler.ts` uses `translatableText` directly and no longer imports Chatwork webhook types
- output files preserve today’s observable shape by reading from `audit.rawSourceSnapshot`

**Step 4: Re-run the focused tests**

Run the same commands as Step 2.
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/translator/src/webhook/router.ts packages/translator/src/webhook/router.test.ts packages/translator/src/webhook/handler.ts packages/translator/src/webhook/handler.test.ts packages/translator/src/types/output.ts packages/translator/src/utils/output-writer.ts packages/translator/src/utils/output-writer.test.ts
git commit -m "refactor(translator): consume neutral ingress command"
```

### Task 8: Refactor Translator Delivery to Use Chatwork Intent APIs

**Files:**

- Modify: `packages/translator/src/services/chatwork-sender.ts`
- Modify: `packages/translator/src/services/chatwork-sender.test.ts`
- Modify: `packages/translator/src/webhook/handler.ts`
- Modify: `packages/translator/src/webhook/handler.test.ts`

**Step 1: Rewrite the failing delivery tests**

Adjust tests so translator no longer mocks a raw `ChatworkClient`.

Cover:

- sender display name resolves through `resolveRoomMemberDisplayName(...)`
- message send happens through `sendRoomMessage(...)`
- delivery failures still become returned `OutputDelivery` failures, not thrown crashes

**Step 2: Run the focused delivery tests**

Run:

- `bun test packages/translator/src/services/chatwork-sender.test.ts`
- `bun test packages/translator/src/webhook/handler.test.ts`

Expected: FAIL because the sender still constructs `ChatworkClient` directly.

**Step 3: Refactor translator delivery**

Implementation rules:

- translator keeps composing message text
- translator uses Chatwork package intent APIs
- translator does not call `getRoomMembers(...)` directly; use `resolveRoomMemberDisplayName(...)`
- translator creates a `new Map<number, string>()` per translation request and passes it as the `cache` argument to `resolveRoomMemberDisplayName(...)`. This avoids redundant API calls within the same request scope without process-level state.

**Step 4: Re-run the focused tests**

Run:

- `bun test packages/translator/src/services/chatwork-sender.test.ts`
- `bun test packages/translator/src/webhook/handler.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/translator/src/services/chatwork-sender.ts packages/translator/src/services/chatwork-sender.test.ts packages/translator/src/webhook/handler.ts packages/translator/src/webhook/handler.test.ts
git commit -m "refactor(translator): use chatwork intent services"
```

### Task 9: Refactor Dataset Runner to Use Chatwork Message Send Use Cases

**Files:**

- Modify: `packages/dataset-runner/src/services/item-processor.ts`
- Modify: `packages/dataset-runner/src/services/item-processor.test.ts`
- Modify: `packages/dataset-runner/src/services/queue-runner.ts`
- Modify: `packages/dataset-runner/src/services/queue-runner.test.ts`

**Step 1: Rewrite the failing dataset-runner tests**

Update tests to mock `sendRoomMessage(...)` or the package-level send service instead of
`IChatworkClient`.

Cover:

- sent source metadata is still returned
- source-map write timing remains unchanged
- retry exhaustion behavior remains unchanged

**Step 2: Run the focused dataset tests**

Run:

- `bun test packages/dataset-runner/src/services/item-processor.test.ts`
- `bun test packages/dataset-runner/src/services/queue-runner.test.ts`

Expected: FAIL because dataset-runner still depends on the old core client contract.

**Step 3: Refactor dataset-runner**

Implementation rules:

- remove direct construction of `ChatworkClient`
- use the Chatwork send use case
- preserve retry semantics and logging

**Step 4: Re-run the focused dataset tests**

Run:

- `bun test packages/dataset-runner/src/services/item-processor.test.ts`
- `bun test packages/dataset-runner/src/services/queue-runner.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/dataset-runner/src/services/item-processor.ts packages/dataset-runner/src/services/item-processor.test.ts packages/dataset-runner/src/services/queue-runner.ts packages/dataset-runner/src/services/queue-runner.test.ts
git commit -m "refactor(repo): route dataset sending through chatwork services"
```

### Task 10: Remove Chatwork from Core and Clean Up Imports

**Files:**

- Modify: `packages/core/src/index.ts`
- Delete: `packages/core/src/types/chatwork.ts`
- Delete: `packages/core/src/types/chatwork.test.ts`
- Delete: `packages/core/src/interfaces/chatwork.ts`
- Delete: `packages/core/src/chatwork/client.ts`
- Delete: `packages/core/src/chatwork/client.test.ts`
- Modify: any consumers still importing Chatwork symbols from `@chatwork-bot/core`

**Step 1: Search for remaining Chatwork imports from core**

Run: `rg -n "Chatwork|chatwork" packages -g '*.ts'`
Expected: matches remain in old core files and consumer imports.

**Step 2: Remove old exports and migrate imports**

Rules:

- no Chatwork symbols remain exported from `@chatwork-bot/core`
- all Chatwork-specific imports come from `@chatwork-bot/chatwork`
- translator only imports the neutral DTO from core

**Step 3: Re-run a repo-wide typecheck**

Run: `bun run typecheck`
Expected: PASS if all imports and deletions are complete.

**Step 4: Commit**

```bash
git add packages/core/src/index.ts packages/core/src/types packages/core/src/interfaces packages/core/src/chatwork packages/translator packages/webhook-logger packages/dataset-runner packages/chatwork
git commit -m "refactor(core): remove chatwork-specific contracts"
```

### Task 11: Update Documentation and Environment Examples

**Files:**

- Modify: `.env.example`
- Modify: `AGENTS.md` if package list needs updating
- Modify: `CLAUDE.md` if package list needs updating
- Modify: `ai_rules/project-structure.md`
- Modify: `ai_rules/architecture-patterns.md`
- Modify: `ai_rules/security.md`

**Step 1: Write the docs changes**

Update docs to reflect:

- the new `@chatwork-bot/chatwork` package
- neutral translator ingress contract
- raw-body signature verification
- the new `CHATWORK_SKIP_SIGNATURE_VERIFY` env var

Add the following block to `.env.example` after the `CHATWORK_WEBHOOK_SECRET` line:

```bash
# --- Webhook signature verification (webhook-logger) ---
# Set to true ONLY in development/local to bypass HMAC signature check.
# Always ignored in production. Default: false (verification enabled).
CHATWORK_SKIP_SIGNATURE_VERIFY=false
```

**Step 2: Run formatting**

Run: `bun run format`
Expected: PASS and docs formatted.

**Step 3: Commit**

```bash
git add .env.example AGENTS.md CLAUDE.md ai_rules/project-structure.md ai_rules/architecture-patterns.md ai_rules/security.md
git commit -m "docs(repo): document chatwork package architecture"
```

### Task 12: Final Verification and Review Gate

**Files:**

- Verify only; no new files

**Step 1: Run focused regression checks**

Run:

- `bun test packages/chatwork`
- `bun test packages/webhook-logger/src/routes/webhook.test.ts`
- `bun test packages/translator/src/webhook/handler.test.ts`
- `bun test packages/translator/src/services/chatwork-sender.test.ts`
- `bun test packages/dataset-runner/src/services/item-processor.test.ts`

Expected: PASS.

**Step 2: Run full project verification**

Run:

- `bun test`
- `bun run typecheck`
- `bun run lint`

Expected: all PASS with zero errors.

**Step 3: Run final git review**

Run:

- `git status --short`
- `git log --oneline -n 10`
- `git diff --stat origin/main...HEAD` if working in a feature branch with remote context

Expected:

- clean worktree
- commit history grouped by task
- diff matches the approved design

**Step 4: Request code review**

Use the `requesting-code-review` skill before merging or opening a PR.

**Step 5: Final commit if needed**

```bash
git add -A
git commit -m "refactor(repo): complete chatwork package extraction"
```
