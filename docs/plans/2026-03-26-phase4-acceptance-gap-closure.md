# Phase 4 Acceptance Gap Closure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the remaining gaps between the current Phase 4 backend implementation and the manual acceptance checklist so Phase 4 can be signed off without caveats.

**Architecture:** Keep the existing per-room config architecture intact and only tighten the missing contracts: response envelopes, internal secret semantics, webhook-logger caching, and explicit acceptance-level regression coverage. Do not refactor unrelated translator behavior; every change here should map directly to a failed or ambiguous acceptance item.

**Tech Stack:** Bun, TypeScript, Elysia, Zod, Bun test, curl/httpie-style endpoint verification

---

### Task 1: Lock the acceptance contract in failing tests first

**Files:**

- Modify: `packages/translator/src/routes/rooms.test.ts`
- Modify: `packages/translator/src/routes/providers.test.ts`
- Modify: `packages/translator/src/routes/internal-room-secret.test.ts`
- Modify: `packages/webhook-logger/src/routes/webhook.test.ts`
- Modify: `packages/translator/src/webhook/handler.test.ts`

**Step 1: Add failing contract tests for room route response envelopes**

Add assertions that:

- `GET /api/rooms` returns `{ success: true, data: [] }`
- `GET /api/rooms/:id` returns `{ success: true, data: room }`
- `POST /api/rooms` returns `{ success: true, data: room, webhookUrl }`
- `PUT /api/rooms/:id` returns `{ success: true, data: room }`
- `POST /api/rooms/:id/enable` and `/disable` return `{ success: true, data: room }`

**Step 2: Run the rooms tests to verify they fail**

Run: `bun test packages/translator/src/routes/rooms.test.ts`
Expected: FAIL because the current handlers return `{ rooms }` / `{ room }` instead of `{ success, data }`

**Step 3: Add failing provider contract tests**

Add assertions that `GET /api/providers` returns `{ success: true, data: providers }`.

**Step 4: Run the provider tests to verify they fail**

Run: `bun test packages/translator/src/routes/providers.test.ts`
Expected: FAIL because the current handler returns `{ providers }`

**Step 5: Add failing internal-secret contract tests**

Add assertions that:

- success payload is `{ secret: string }`
- disabled rooms return `404`
- enabled rooms still return `200`

**Step 6: Run the internal-secret tests to verify they fail**

Run: `bun test packages/translator/src/routes/internal-room-secret.test.ts`
Expected: FAIL because the current handler returns `{ webhookSecret }` and serves disabled rooms

**Step 7: Add failing webhook-logger cache tests**

Add tests covering:

- second request for the same room within TTL does not call translator internal secret endpoint again
- cache hit + translator internal API outage still succeeds
- cache miss + translator internal API outage returns `503`

**Step 8: Run the webhook-logger tests to verify they fail**

Run: `bun test packages/webhook-logger/src/routes/webhook.test.ts`
Expected: FAIL because there is no secret cache implementation yet

**Step 9: Add failing translator handler log-level tests**

Add assertions that:

- unknown room skip logs at `warn`
- disabled room skip stays `info`

**Step 10: Run the handler tests to verify they fail**

Run: `bun test packages/translator/src/webhook/handler.test.ts`
Expected: FAIL because unknown-room skip currently logs at `info`

**Step 11: Commit the test-only red phase**

```bash
git add packages/translator/src/routes/rooms.test.ts packages/translator/src/routes/providers.test.ts packages/translator/src/routes/internal-room-secret.test.ts packages/webhook-logger/src/routes/webhook.test.ts packages/translator/src/webhook/handler.test.ts
git commit -m "test(phase4): lock acceptance contracts for remaining backend gaps"
```

### Task 2: Align translator CRUD and provider endpoint contracts

**Files:**

- Modify: `packages/translator/src/routes/rooms.ts`
- Modify: `packages/translator/src/routes/providers.ts`

**Step 1: Update room routes to return success envelopes**

Change the handlers to return:

- `{ success: true, data: store.list() }`
- `{ success: true, data: room }`
- `{ success: true, data: room, webhookUrl }`

Keep error payloads unchanged unless a test explicitly requires different error shape.

**Step 2: Update providers route to return success envelope**

Change `GET /api/providers` to return `{ success: true, data: providers }`.

**Step 3: Run rooms and provider tests**

Run: `bun test packages/translator/src/routes/rooms.test.ts packages/translator/src/routes/providers.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/translator/src/routes/rooms.ts packages/translator/src/routes/providers.ts packages/translator/src/routes/rooms.test.ts packages/translator/src/routes/providers.test.ts
git commit -m "refactor(translator): align room and provider APIs with acceptance contract"
```

### Task 3: Tighten internal room secret semantics

**Files:**

- Modify: `packages/translator/src/routes/internal-room-secret.ts`
- Modify: `packages/translator/src/routes/internal-room-secret.test.ts`

**Step 1: Reject disabled rooms**

After loading the room by `originalRoomId`, return `404` when `room.enabled === false`.

**Step 2: Rename success payload key**

Return `{ secret }` instead of `{ webhookSecret }`.

**Step 3: Keep auth and missing/invalid room_id behavior unchanged**

Do not broaden scope beyond the tested contract.

**Step 4: Run internal-secret tests**

Run: `bun test packages/translator/src/routes/internal-room-secret.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/translator/src/routes/internal-room-secret.ts packages/translator/src/routes/internal-room-secret.test.ts
git commit -m "fix(translator): hide disabled room secrets and normalize response payload"
```

### Task 4: Add webhook-logger per-room secret cache

**Files:**

- Modify: `packages/webhook-logger/src/routes/webhook.ts`
- Modify: `packages/webhook-logger/src/routes/webhook.test.ts`

**Step 1: Add a tiny in-memory cache**

Implement a module-local cache keyed by `roomId` with:

- `secret: string`
- `expiresAt: number`

Use a `60_000` ms TTL.

**Step 2: Read cache before calling translator**

If a fresh cached secret exists, use it directly and skip the fetch.

**Step 3: Populate cache on successful fetch**

Only cache successful `200` responses.
Do not cache `404` or error responses.

**Step 4: Preserve current miss/error behavior**

Keep:

- `404` => `200 OK` skip
- non-404 or network failure on cache miss => `503`

**Step 5: Make cache-hit outage behavior explicit**

When translator internal API becomes unreachable after the first successful fetch, verification should still succeed while TTL is valid.

**Step 6: Run webhook-logger tests**

Run: `bun test packages/webhook-logger/src/routes/webhook.test.ts packages/webhook-logger/src/app.test.ts packages/webhook-logger/src/env.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add packages/webhook-logger/src/routes/webhook.ts packages/webhook-logger/src/routes/webhook.test.ts packages/webhook-logger/src/app.test.ts packages/webhook-logger/src/env.test.ts
git commit -m "feat(webhook-logger): cache per-room webhook secrets for signature verification"
```

### Task 5: Align translator skip logging with acceptance wording

**Files:**

- Modify: `packages/translator/src/webhook/handler.ts`
- Modify: `packages/translator/src/webhook/handler.test.ts`

**Step 1: Change unknown-room skip log to warning**

Keep the event name `translation_skipped_no_room_config`, but emit `level: 'warn'`.

**Step 2: Keep disabled-room skip at info**

Do not change the disabled-room path.

**Step 3: Run handler tests**

Run: `bun test packages/translator/src/webhook/handler.test.ts packages/translator/src/webhook/router.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/translator/src/webhook/handler.ts packages/translator/src/webhook/handler.test.ts packages/translator/src/webhook/router.test.ts
git commit -m "chore(translator): align room skip logging with phase 4 acceptance"
```

### Task 6: Add explicit atomicity regression for Chatwork room creation failure

**Files:**

- Modify: `packages/translator/src/routes/rooms.test.ts`

**Step 1: Add failing test for Chatwork room creation failure**

Mock `createRoom` from `@chatwork-bot/chatwork` to reject and assert:

- response status is `502`
- `GET /api/rooms` still returns an empty list
- no room is written to `room-configs.json`

**Step 2: Run the rooms test**

Run: `bun test packages/translator/src/routes/rooms.test.ts`
Expected: PASS without production changes if the current flow is already atomic

**Step 3: Commit**

```bash
git add packages/translator/src/routes/rooms.test.ts
git commit -m "test(translator): verify room creation stays atomic on Chatwork failure"
```

### Task 7: Lift coverage on new Phase 4 files above the acceptance threshold

**Files:**

- Modify: `packages/translator/src/routes/rooms.test.ts`
- Modify: `packages/translator/src/routes/internal-room-secret.test.ts`
- Modify: `packages/webhook-logger/src/routes/webhook.test.ts`
- Modify: `packages/translator/src/webhook/handler.test.ts`

**Step 1: Identify the uncovered lines from fresh coverage output**

Focus only on new Phase 4 files that remain under `95%`:

- `packages/translator/src/routes/rooms.ts`
- `packages/translator/src/routes/internal-room-secret.ts`
- `packages/webhook-logger/src/routes/webhook.ts`

**Step 2: Add the smallest missing branch tests**

Examples likely needed:

- `room_id` parse failure path in internal-secret route
- route-level not-found paths in rooms route
- payload-invalid and translator-non-OK branches in webhook-logger

**Step 3: Run targeted tests**

Run: `bun test packages/translator/src/routes/rooms.test.ts packages/translator/src/routes/internal-room-secret.test.ts packages/webhook-logger/src/routes/webhook.test.ts`
Expected: PASS

**Step 4: Re-run coverage**

Run: `bun test --coverage`
Expected: the new Phase 4 files all report `>95%` lines and functions

**Step 5: Commit**

```bash
git add packages/translator/src/routes/rooms.test.ts packages/translator/src/routes/internal-room-secret.test.ts packages/webhook-logger/src/routes/webhook.test.ts packages/translator/src/webhook/handler.test.ts
git commit -m "test(phase4): raise acceptance coverage on new backend files"
```

### Task 8: Final acceptance verification

**Files:**

- No code changes required unless verification reveals a new regression

**Step 1: Run the full quality gate**

Run: `bun test`
Expected: `0 fail`

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: `0` errors

**Step 3: Run lint**

Run: `bun run lint`
Expected: `0` errors

**Step 4: Run coverage**

Run: `bun test --coverage`
Expected: all new Phase 4 files above `95%`

**Step 5: Re-run the manual API smoke checks**

Use a temp `ROOM_CONFIG_DATA_DIR`, seed two rooms, then verify with `curl`:

- `GET /api/rooms`
- `GET /api/rooms/:id`
- `GET /api/providers`
- `GET /internal/room-secret` unauthorized
- `GET /internal/room-secret` enabled room authorized
- `GET /internal/room-secret` disabled room authorized => `404`
- `DELETE /api/rooms/:id`
- file persistence in `room-configs.json` and `room-configs-archive.json`

**Step 6: Commit final acceptance closure**

```bash
git add -A
git commit -m "chore(phase4): close remaining backend acceptance gaps"
```
