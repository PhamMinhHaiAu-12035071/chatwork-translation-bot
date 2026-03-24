# Delivery Retry Design

**Date:** 2026-03-24
**Status:** Approved
**Scope:** `packages/translator/src/services/chatwork-sender.ts` + `env-schema.ts`

## Problem

The delivery phase calls the Chatwork API to post the translated message. On 2026-03-24, a transient TCP connection timeout (5 s) caused delivery to fail silently — the translation was complete but the message was never sent. The system had no retry mechanism.

Root cause confirmed: `api.chatwork.com` is reachable from the Docker container (wget/Bun fetch both succeed), but the connection failed transiently at the OS TCP level.

## Decision

Add retry with exponential backoff inside `sendTranslatedMessage`. Interface is unchanged — the function still never throws and always returns `OutputDelivery`.

## Retry Parameters

| Parameter           | Value                                           |
| ------------------- | ----------------------------------------------- |
| Max retries         | 2 (total 3 attempts)                            |
| Backoff schedule    | 1 s → 2 s (exponential, base 2)                 |
| Rate limit override | Use `Retry-After` header value (capped at 10 s) |
| Delay cap           | 10 s                                            |

## Error Classification

**Retriable:**

- `TypeError` — Bun's fetch error for connection failures (DNS, TCP timeout, ECONNREFUSED)
- `ChatworkRateLimitError` (HTTP 429) — rate limit with `Retry-After` delay

**Non-retriable (fail immediately):**

- `ChatworkApiError` with HTTP 4xx except 429 — auth, permission, not found
- Any other error type

## Code Structure

### `chatwork-sender.ts` — restructure (interface unchanged)

```
isRetriable(error): boolean
  → true for TypeError | ChatworkRateLimitError

retryDelayMs(error, attempt): number
  → ChatworkRateLimitError: min(retryAfter * 1000, 10_000)
  → TypeError: 1000 * 2^(attempt-1)

deliverMessage(command, result, config): Promise<OutputDelivery>
  → inner function, can throw
  → calls resolveRoomMemberDisplayName + sendRoomMessage

sendTranslatedMessage(command, result, config): Promise<OutputDelivery>
  → public function, never throws
  → retry loop: attempt 1..3
    → on retriable error and attempt < 3: sleep(retryDelayMs), continue
    → on non-retriable or final attempt: return { status: 'failed', ... }
```

### `env-schema.ts` — delivery budget default

`TRANSLATOR_DELIVERY_BUDGET_MS` default: `15_000` → `45_000`

Rationale: worst case is 3 attempts × ~5 s TCP timeout + 1 s + 2 s delay = ~18 s. 45 s gives headroom for `Retry-After` scenarios without triggering spurious heartbeat warnings.

## Observability

When a retry is triggered, log to stderr in existing JSON format:

```json
{
  "level": "warn",
  "service": "translator",
  "event": "translation_delivery_retrying",
  "attempt": 2,
  "maxAttempts": 3,
  "delayMs": 1000,
  "errorCode": "CHATWORK_API",
  "errorMessage": "Unable to connect..."
}
```

The existing `translation_delivery_failed` event in `handler.ts` is unchanged — it fires after `sendTranslatedMessage` returns `{ status: 'failed' }`.

`OutputDelivery` type is unchanged — retry count is not persisted.

## Test Coverage

New test cases in `chatwork-sender.test.ts`:

1. Retries on TypeError and succeeds on second attempt — returns `sent`
2. Retries on `ChatworkRateLimitError` with correct delay, succeeds on third attempt
3. Exhausts all retries on repeated TypeError — returns `failed`
4. Does NOT retry on `ChatworkApiError` (non-429) — fails immediately
5. Uses `Retry-After` value for rate limit delay (capped at 10 s)

Existing tests remain passing — interface unchanged.

## Files Changed

| File                                                       | Change                                                          |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| `packages/translator/src/services/chatwork-sender.ts`      | Add retry loop, `isRetriable`, `retryDelayMs`, `deliverMessage` |
| `packages/translator/src/services/chatwork-sender.test.ts` | Add retry test cases                                            |
| `packages/translator/src/env-schema.ts`                    | `TRANSLATOR_DELIVERY_BUDGET_MS` default 15 000 → 45 000         |

No changes to: `handler.ts`, `chatwork-api-client.ts`, `types/output.ts`, `phase-observer.ts`.
