# Webhook Logger Internal URL Fix Design

**Date:** 2026-03-27

## Goal

Fix the local Docker dev misconfiguration that prevents `webhook-logger` from fetching room secrets from `translator`, so Chatwork webhook deliveries can be processed after a room is created.

## Root Cause

- `webhook-logger` fetches room secrets from `env.TRANSLATOR_INTERNAL_URL` before verifying webhook signatures.
- The webhook logger env schema defaults `TRANSLATOR_INTERNAL_URL` to `http://localhost:3000`.
- In `docker-compose.dev.yml`, the `webhook-logger` service overrides `TRANSLATOR_URL=http://translator:3000` but does not override `TRANSLATOR_INTERNAL_URL`.
- Inside the `webhook-logger` container, `localhost:3000` points back to the logger container itself, not the `translator` service.
- As a result, room-secret lookup fails with a network error, the logger returns `503`, and Chatwork webhook processing stops before translation forwarding begins.

This is a configuration defect in Docker dev, not a Chatwork API problem and not a room-secret storage bug.

## Current Behavior

- Room creation succeeds because the dashboard and API flows talk directly to `translator`.
- A real Chatwork webhook later fails on the first internal dependency boundary:
  `webhook-logger -> GET {TRANSLATOR_INTERNAL_URL}/internal/room-secret`.
- The logger reports `room_secret_fetch_failed` and returns `503 Translator internal API unavailable`.

## Scope

In scope:

- Fix the `docker-compose.dev.yml` environment for `webhook-logger`
- Add regression coverage so Docker dev cannot silently lose `TRANSLATOR_INTERNAL_URL` again
- Make the internal vs external translator URL contract clearer in env documentation/tests

Out of scope:

- Refactoring webhook forwarding architecture
- Removing `TRANSLATOR_INTERNAL_URL` from the webhook logger
- Changing production `docker-compose.yml`, which already sets the internal URL correctly
- Any Chatwork room or webhook behavior changes

## Approaches Considered

### 1. Fix Docker dev configuration only

Add `TRANSLATOR_INTERNAL_URL=http://translator:3000` to the `webhook-logger` service in `docker-compose.dev.yml` and lock it with tests.

Pros:

- Fixes the real root cause
- Keeps internal/external URL separation explicit
- Minimal blast radius

Cons:

- Still relies on config discipline, so tests must be added

### 2. Add code fallback from `TRANSLATOR_INTERNAL_URL` to `TRANSLATOR_URL`

If the internal URL is missing, the logger could fall back to `TRANSLATOR_URL`.

Pros:

- More forgiving in local environments

Cons:

- Masks misconfiguration
- Blurs internal/external URL boundaries
- Solves the symptom more than the cause

### 3. Collapse to one translator URL variable

Remove the internal URL distinction and use `TRANSLATOR_URL` for both room-secret lookup and translation forwarding.

Pros:

- Smaller env surface area

Cons:

- Unnecessary refactor for a narrow bug
- Changes a contract already encoded in the codebase and specs

## Approved Design

Use Approach 1.

### 1. Keep the current runtime contract

`webhook-logger` should continue to:

- use `TRANSLATOR_INTERNAL_URL` for `/internal/room-secret`
- use `TRANSLATOR_URL` for `/internal/translate`

That separation is already present in the code and remains useful.

### 2. Fix the Docker dev service wiring

In `docker-compose.dev.yml`, the `webhook-logger` service should explicitly set both:

- `TRANSLATOR_URL=http://translator:3000`
- `TRANSLATOR_INTERNAL_URL=http://translator:3000`

This makes the container-level behavior match production compose and the intended service-to-service routing inside the Docker network.

### 3. Add regression tests at the right layers

Two regression layers are needed:

- A compose-level test in `scripts/dev.test.ts` that asserts the `webhook-logger` block includes `TRANSLATOR_INTERNAL_URL=http://translator:3000`
- A webhook-route test that proves room-secret fetches use `TRANSLATOR_INTERNAL_URL` while translation forwarding continues to use `TRANSLATOR_URL`

This prevents both classes of future regressions:

- config drift in Docker dev
- accidental code drift that ignores the internal URL

### 4. Clarify the env contract

Update `.env.example` and, if needed, webhook-logger env tests so it is obvious that:

- native/local dev defaults may still use `localhost`
- Docker dev overrides both URLs to the `translator` service name

This reduces the chance that someone copies `.env` assumptions directly into container networking behavior.

## Testing Strategy

- Focused tests:
  - `bun test scripts/dev.test.ts packages/webhook-logger/src/routes/webhook.test.ts packages/webhook-logger/src/env.test.ts`
- Validation checks:
  - `bun run lint`
  - `bun run typecheck`
- Optional manual verification:
  - restart local dev stack
  - send a message in the original room
  - confirm `room_secret_fetch_failed` is gone and the translator receives the request

## Success Criteria

- `webhook-logger` can resolve `/internal/room-secret` inside Docker dev
- real Chatwork webhooks no longer fail with translator connectivity errors
- tests protect both the compose wiring and runtime URL usage contract
