# Delivery Retry Design

**Date:** 2026-03-24
**Status:** Approved
**Scope:** `packages/translator/src/services/chatwork-sender.ts` + `env-schema.ts`

## Problem

The delivery phase calls the Chatwork API to post the translated message. On 2026-03-24, a transient TCP
connection timeout (5 s) caused delivery to fail silently — the translation was complete but the message was
never sent. The system had no retry mechanism.

Root cause confirmed: `api.chatwork.com` is reachable from the Docker container (wget/Bun fetch both
succeed), but the connection failed transiently at the OS TCP level.

## Decision

Add retry with exponential backoff inside `sendTranslatedMessage`. Interface is unchanged — the function
still never throws and always returns `OutputDelivery`.

## Retry Parameters

| Parameter           | Value                                                      |
| ------------------- | ---------------------------------------------------------- |
| Max retries         | 2 (total 3 attempts)                                       |
| Backoff schedule    | 1 s → 2 s (exponential, base 2)                            |
| Rate limit override | Use `Retry-After` header value in seconds × 1000, cap 10 s |
| Delay cap           | 10 000 ms                                                  |

## Error Classification

`ChatworkRateLimitError` extends `ChatworkApiError`. The `isRetriable` check **must test
`ChatworkRateLimitError` first** (before `ChatworkApiError`) to avoid the subclass matching the
non-retriable branch.

**Retriable:**

- `TypeError` with message matching `/connect|fetch|ECONNREFUSED|timeout/i` — Bun's fetch error for
  connection failures (DNS, TCP timeout, ECONNREFUSED). The message pattern guard is required because
  `TypeError` is also thrown for programming errors (null dereference, wrong type) that must not be
  retried. A plain `instanceof TypeError` would incorrectly retry logic bugs.
- `ChatworkRateLimitError` (HTTP 429) — rate limit; delay = `min(error.retryAfter * 1000, 10_000)` ms

**Non-retriable (fail immediately):**

- `ChatworkApiError` with any status except 429 — auth, permission, not found, other 4xx/5xx
- Any other error type

Both classes are imported from `@chatwork-bot/chatwork` (the package root export), **not** from internal
paths.

## Code Structure

### `chatwork-sender.ts` — restructure (public interface unchanged)

```
// sleepFn is injectable for testing (default: (ms) => Bun.sleep(ms))
const MAX_RETRIES = 2

function isRetriable(error: unknown): boolean
  // MUST check ChatworkRateLimitError before ChatworkApiError (subclass ordering)
  → true  if error instanceof ChatworkRateLimitError
  → true  if error instanceof TypeError && /connect|fetch|ECONNREFUSED|timeout/i.test(error.message)
  → false otherwise

function retryDelayMs(error: unknown, attempt: number): number
  // attempt is 1-based (attempt 1 → first retry delay)
  // Only called after isRetriable() returns true; unreachable path throws to satisfy TS strict
  → if ChatworkRateLimitError: min(error.retryAfter * 1000, 10_000)
  → if TypeError (network):    1000 * 2^(attempt - 1)   // 1000 ms, 2000 ms
  → else: throw new Error('unreachable: retryDelayMs called with non-retriable error')

// Inner function — can throw; config type: { apiToken: string; destinationRoomId: number }
async function deliverMessage(
  command: TranslationIngressCommand,
  result: TranslationResult,
  config: { apiToken: string; destinationRoomId: number },
): Promise<OutputDelivery>
  // calls resolveRoomMemberDisplayName then sendRoomMessage
  // throws on any error (no catch here)

// Public function — never throws; accepts optional sleepFn for testability
export async function sendTranslatedMessage(
  command: TranslationIngressCommand,
  result: TranslationResult,
  config: { apiToken: string; destinationRoomId: number },
  sleepFn: (ms: number) => Promise<void> = (ms) => Bun.sleep(ms),
): Promise<OutputDelivery>
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++):
    try:
      return await deliverMessage(command, result, config)
    catch (error):
      if (attempt <= MAX_RETRIES && isRetriable(error)):
        // log translation_delivery_retrying (warn)
        await sleepFn(retryDelayMs(error, attempt))
        continue
      // final attempt or non-retriable: return failed
      return {
        status: 'failed',
        destinationRoomId: config.destinationRoomId,
        errorCode: error instanceof Error ? error.constructor.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : String(error),
        sentAt: new Date().toISOString(),
      }
```

**Retry scope:** the entire `deliverMessage` call is wrapped — including `resolveRoomMemberDisplayName`.
A TCP failure during name resolution is retriable under the same conditions as a failure during message
send.

### `env-schema.ts` — delivery budget default

`TRANSLATOR_DELIVERY_BUDGET_MS` default: `15_000` → `45_000`

Worst-case calculation (all 3 attempts hit 5 s TCP timeout + rate-limit delays):

- 3 attempts × 5 s = 15 s
- delays: 1 s + 2 s = 3 s (TypeError path), or up to 10 s + 10 s = 20 s (rate-limit path)
- Rate-limit worst case: 15 s + 20 s = 35 s

45 s provides headroom. Note: if name resolution also times out on each attempt, worst case doubles the
attempt time; 45 s remains adequate for 3 × ~5 s name + ~5 s send attempts with delays.

## Observability

When a retry is triggered, log to stderr in existing JSON format. `errorCode` reflects the actual error
class name (e.g., `"TypeError"` or `"ChatworkRateLimitError"`), **not** the fixed string
`"CHATWORK_API"`:

```json
{
  "level": "warn",
  "service": "translator",
  "event": "translation_delivery_retrying",
  "attempt": 2,
  "maxAttempts": 3,
  "delayMs": 1000,
  "errorCode": "TypeError",
  "errorMessage": "Unable to connect..."
}
```

The existing `translation_delivery_failed` event in `handler.ts` is unchanged — it fires after
`sendTranslatedMessage` returns `{ status: 'failed' }`. The `errorCode` in the final `OutputDelivery`
also uses the actual error class name.

`OutputDelivery` type is unchanged — retry count is not persisted.

## Test Coverage

New test cases in `chatwork-sender.test.ts` (inject `sleepFn` mock to capture delay values without
real sleeps):

1. Retries on `TypeError` with network message (e.g. `"Unable to connect"`) and succeeds on second
   attempt — returns `sent`, `deliverMessage` called twice
2. Retries on `ChatworkRateLimitError` and succeeds on third attempt — `deliverMessage` called 3 times,
   `sleepFn` called exactly twice, each with `min(retryAfter * 1000, 10_000)` ms
3. Exhausts all retries on repeated `TypeError` (network message) — returns `{ status: 'failed' }` after
   3 attempts
   3a. Does NOT retry on `TypeError` with non-network message (e.g. `"Cannot read properties of null"`) —
   `deliverMessage` called once, returns `{ status: 'failed' }` immediately
4. Does NOT retry on `ChatworkApiError` (non-429, e.g. 401) — `deliverMessage` called once, returns
   `{ status: 'failed' }` immediately
5. Rate limit delay: `Retry-After: 3` → `sleepFn` called with `3000` ms (uncapped path); `Retry-After:
15` → `sleepFn` called with `10000` ms (capped path)

Existing tests remain passing — public interface of `sendTranslatedMessage` is unchanged (the new
optional `sleepFn` param has a default).

## Files Changed

| File                                                       | Change                                                                     |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| `packages/translator/src/services/chatwork-sender.ts`      | Add retry loop, `isRetriable`, `retryDelayMs`, `deliverMessage`, `sleepFn` |
| `packages/translator/src/services/chatwork-sender.test.ts` | Add retry test cases (5 new)                                               |
| `packages/translator/src/env-schema.ts`                    | `TRANSLATOR_DELIVERY_BUDGET_MS` default 15 000 → 45 000                    |

No changes to: `handler.ts`, `chatwork-api-client.ts`, `types/output.ts`, `phase-observer.ts`.
