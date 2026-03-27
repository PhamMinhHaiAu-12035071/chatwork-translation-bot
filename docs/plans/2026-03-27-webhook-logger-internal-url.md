# Webhook Logger Internal URL Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix Docker dev so `webhook-logger` can fetch room secrets from `translator` and process real Chatwork webhooks.

**Architecture:** Keep the existing two-URL contract in `webhook-logger`: `TRANSLATOR_INTERNAL_URL` for internal room-secret lookup and `TRANSLATOR_URL` for translation forwarding. Fix the dev compose wiring, then add regression coverage at both the compose and runtime layers.

**Tech Stack:** Docker Compose, Bun test, TypeScript, Elysia, Zod

---

### Task 1: Lock the Docker dev regression with failing tests

**Files:**

- Modify: `scripts/dev.test.ts`
- Modify: `packages/webhook-logger/src/routes/webhook.test.ts`
- Modify: `packages/webhook-logger/src/env.test.ts`

**Step 1: Write the failing compose test**

Add a test in `scripts/dev.test.ts` that reads the `webhook-logger` service block from `docker-compose.dev.yml` and asserts it contains:

```ts
expect(serviceBlock).toContain('TRANSLATOR_INTERNAL_URL=http://translator:3000')
```

**Step 2: Write the failing webhook route test**

Add a route test that sets:

```ts
mockEnv.TRANSLATOR_INTERNAL_URL = 'http://translator-internal:3000'
mockEnv.TRANSLATOR_URL = 'http://translator-public:3000'
```

and verifies:

- room-secret fetch goes to `http://translator-internal:3000/internal/room-secret?...`
- translation forwarding still goes to `http://translator-public:3000/internal/translate`

**Step 3: Extend the env test if needed**

If the current env test does not make the contract obvious enough, add an assertion or a small new test that proves `TRANSLATOR_INTERNAL_URL` is part of the parsed env surface.

**Step 4: Run tests to verify they fail**

Run:

```bash
bun test scripts/dev.test.ts packages/webhook-logger/src/routes/webhook.test.ts packages/webhook-logger/src/env.test.ts
```

Expected: FAIL because `docker-compose.dev.yml` is still missing the internal URL override and the new URL-splitting test is not yet satisfied by the existing fixtures.

### Task 2: Fix Docker dev wiring and keep the internal/external URL contract explicit

**Files:**

- Modify: `docker-compose.dev.yml`
- Modify: `.env.example`

**Step 1: Patch the webhook-logger dev environment**

In the `webhook-logger` service block of `docker-compose.dev.yml`, add:

```yaml
- TRANSLATOR_INTERNAL_URL=http://translator:3000
```

Keep the existing:

```yaml
- TRANSLATOR_URL=http://translator:3000
```

**Step 2: Clarify the env example**

Update `.env.example` so the translator URL contract is explicit:

- native/local dev defaults can remain `http://localhost:3000`
- Docker dev overrides both `TRANSLATOR_URL` and `TRANSLATOR_INTERNAL_URL` to the Docker service name

Keep the documentation minimal and avoid changing unrelated env sections.

**Step 3: Run the focused tests to verify they pass**

Run:

```bash
bun test scripts/dev.test.ts packages/webhook-logger/src/routes/webhook.test.ts packages/webhook-logger/src/env.test.ts
```

Expected: PASS

### Task 3: Verify repo health for the fix

**Files:**

- Modify: none

**Step 1: Run lint**

Run:

```bash
bun run lint
```

Expected: exit code 0

**Step 2: Run typecheck**

Run:

```bash
bun run typecheck
```

Expected: exit code 0

**Step 3: Run full test suite**

Run:

```bash
bun test
```

Expected: PASS

### Task 4: Manual local verification of the original symptom

**Files:**

- Modify: none

**Step 1: Restart the local dev stack**

Run:

```bash
sh scripts/dev.sh down
sh scripts/dev.sh up
```

Expected: translator, webhook-logger, gateway, and zrok become healthy.

**Step 2: Reproduce the real webhook flow**

Send a message in the original Chatwork room that maps to the created room config.

**Step 3: Confirm the regression is gone**

Inspect logs and confirm:

- no `room_secret_fetch_failed`
- webhook logger successfully verifies and forwards the command
- translator receives the `/internal/translate` request

### Task 5: Commit the configuration fix

**Files:**

- Modify: all files touched above

**Step 1: Create the commit**

Run:

```bash
git add docker-compose.dev.yml .env.example scripts/dev.test.ts \
  packages/webhook-logger/src/routes/webhook.test.ts \
  packages/webhook-logger/src/env.test.ts \
  docs/plans/2026-03-27-webhook-logger-internal-url-design.md \
  docs/plans/2026-03-27-webhook-logger-internal-url.md
git commit -m "fix(repo): restore webhook logger internal translator url in dev"
```

Expected: commit succeeds after hooks.
