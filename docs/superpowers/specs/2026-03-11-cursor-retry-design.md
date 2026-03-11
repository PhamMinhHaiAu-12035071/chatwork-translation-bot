# Cursor API Retry & Cooldown Design

**Date**: 2026-03-11
**Scope**: `@chatwork-bot/provider-cursor` only
**Status**: Approved

## Problem

Cursor's server-side API intermittently returns `"The operation timed out."` during the review phase (~250s elapsed). This propagates as `API_ERROR` through `CursorExecutor` → `TranslationError` → failed delivery ACK → dataset-runner `hard_stop` and `process.exit(1)`.

Root cause: Cursor's backend enforces a burst window (empirically ~240s reset period). Progressive throttling was observed across all 7 dataset items — review phase durations grew from 67s to 127s before hitting 250s at item vfa-007.

## Goals

- Near-100% success rate for dataset runs against Cursor API
- No changes to `pipeline.ts`, `handler.ts`, `queue-runner.ts`, `@chatwork-bot/core`, provider-gemini, or provider-openai
- Only `@chatwork-bot/provider-cursor` gains retry behavior

## Non-Goals

- Layer 3 (QueueRunner re-send to Chatwork after full failure) — deferred
- Retry for non-Cursor providers
- Dynamic retry configuration via environment variables

## Solution: Two Layers

### Layer 1 — `withRetry()` in `provider-cursor`

A generic retry utility scoped to `packages/provider-cursor/src/retry.ts`. `CursorExecutor` wraps **only the first try-catch block** (the `generateText()` call) with it. JSON extraction and schema parsing happen in separate try-catch blocks after the retry wrapper and are NOT retried.

**Note on JSON extraction error code**: The existing code at line 49 throws `'API_ERROR'` for JSON extraction failures (`extractJsonFromText` throw). This pre-existing behavior is unchanged. However, since JSON extraction happens **outside** the `withRetry()` wrapper, these errors are not retried.

**Constants (hardcoded, not env-configurable):**

```ts
const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 240_000 // 240s — Cursor burst reset window
```

**Retry policy:**

| Condition                                      | Behavior                                             |
| ---------------------------------------------- | ---------------------------------------------------- |
| `API_ERROR` from `generateText()`              | Retry after 240s                                     |
| `TIMEOUT` (AbortError from pipeline signal)    | Throw immediately — signal already fired             |
| `API_ERROR` from JSON extraction               | NOT retried — outside the wrapper                    |
| `INVALID_RESPONSE` from schema parse           | NOT retried — outside the wrapper                    |
| Attempt exhausted                              | Throw last error unchanged — no message augmentation |
| `signal.aborted` checked before sleep          | Throw immediately                                    |
| `signal.aborted` checked after sleep completes | Throw immediately                                    |

**Observability** — `console.warn` on each retry attempt (before sleep):

```json
{
  "level": "warn",
  "service": "provider-cursor",
  "event": "cursor_api_retry",
  "attempt": 1,
  "maxAttempts": 3,
  "delayMs": 240000,
  "errorMessage": "Cursor API call failed: The operation timed out.",
  "timestamp": "2026-03-11T..."
}
```

**Sleep**: 240s fixed, no jitter (dataset runner is sequential — thundering herd does not apply).

**`sleepFn` injection**: Passed as third constructor parameter with default `Bun.sleep`. Tests inject `vi.fn().mockResolvedValue(undefined)`. Not expected to reject in normal operation.

### Layer 2 — Cooldown & ACK timeout increases (`.env`)

| Variable                  | Old value | New value | Reason                                           |
| ------------------------- | --------- | --------- | ------------------------------------------------ |
| `DATASET_COOLDOWN_MS`     | 2000      | 30000     | Reduce progressive throttling between items      |
| `DATASET_ITEM_TIMEOUT_MS` | 1800000   | 3600000   | Cover worst-case retry sequence (see math below) |

**Timeout sources clarification:**

- `cursor-api-proxy` sends SIGKILL to `cursor agent` after `CURSOR_BRIDGE_TIMEOUT_MS=300_000` (300s). This is the effective per-attempt wall-clock ceiling. Cursor's server returns the error before SIGKILL in practice (~250s observed).
- `plugin.manifest.timeoutMs = 1_800_000` (1800s) is the pipeline's AbortSignal, which spans ALL retry attempts. **This does NOT need to change** — see math below.
- `DATASET_ITEM_TIMEOUT_MS = 3_600_000` (3600s) is the ACK wait timeout in dataset-runner.

**ACK timeout math (worst case):**

```
3 retry attempts × 300s (cursor-api-proxy ceiling) = 900s
2 delays between attempts × 240s = 480s
total = 1380s

Pipeline AbortSignal fires at 1800s → 1380s < 1800s ✓ (plugin.manifest.timeoutMs unchanged)
DATASET_ITEM_TIMEOUT_MS 3600s > 1380s + pipeline overhead ✓
```

## Implementation

### New file: `packages/provider-cursor/src/retry.ts`

```ts
import { TranslationError } from '@chatwork-bot/core'

const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 240_000

export interface RetryOptions {
  maxAttempts?: number
  delayMs?: number
  sleepFn?: (ms: number) => Promise<void>
  signal?: AbortSignal
  isRetryable?: (error: unknown) => boolean
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxAttempts = MAX_ATTEMPTS,
    delayMs = RETRY_DELAY_MS,
    sleepFn = Bun.sleep,
    signal,
    isRetryable = defaultIsRetryable,
  } = options

  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const isLast = attempt === maxAttempts
      if (isLast || !isRetryable(error)) throw error

      console.warn(
        JSON.stringify({
          level: 'warn',
          service: 'provider-cursor',
          event: 'cursor_api_retry',
          attempt,
          maxAttempts,
          delayMs,
          errorMessage: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        }),
      )

      if (signal?.aborted) throw error
      await sleepFn(delayMs)
      if (signal?.aborted) throw error
    }
  }
  throw lastError
}

function defaultIsRetryable(error: unknown): boolean {
  return error instanceof TranslationError && error.code === 'API_ERROR'
}
```

### Modified: `packages/provider-cursor/src/cursor-translation.ts`

Add `sleepFn` as third constructor parameter (after existing `baseUrl`). Wrap only the first try-catch block (lines 26–41) with `withRetry()`. All other code unchanged.

**Updated constructor:**

```ts
constructor(
  private readonly modelId: string,
  private readonly baseUrl: string,
  private readonly sleepFn: (ms: number) => Promise<void> = Bun.sleep,
) {
  this.provider = createOpenAICompatible({ name: 'cursor', baseURL: baseUrl })
}
```

**Updated execute() — first try-catch block only:**

```ts
let rawText: string
rawText = await withRetry(
  async () => {
    try {
      const result = await generateText({
        model: this.provider(this.modelId),
        system: prompts.system,
        prompt: prompts.user,
        ...(options?.signal && { abortSignal: options.signal }),
      })
      return result.text
    } catch (cause) {
      const isAbort = cause instanceof Error && cause.name === 'AbortError'
      throw new TranslationError(
        `Cursor API call failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        isAbort ? 'TIMEOUT' : 'API_ERROR',
        cause,
      )
    }
  },
  { signal: options?.signal, sleepFn: this.sleepFn },
)

// JSON extraction and schema parsing — unchanged, not wrapped
```

### Modified: `packages/provider-cursor/src/cursor-plugin.ts`

Update `CursorExecutorConstructor` type alias to include the optional `sleepFn` third parameter (or remove the alias entirely since the cast bypasses type checking anyway):

```ts
// Update the type alias to include the optional third parameter
type CursorExecutorConstructor = new (
  modelId: ProviderCreateContext['modelId'],
  baseUrl: string,
  sleepFn?: (ms: number) => Promise<void>,
) => ILLMExecutor
```

The instantiation at line 88 remains unchanged:

```ts
return new CursorExecutorCtor(ctx.modelId, ctx.baseUrl)
// sleepFn defaults to Bun.sleep — no call site changes needed
```

### Modified: `.env` (local dev only, not committed)

```env
DATASET_COOLDOWN_MS=30000
DATASET_ITEM_TIMEOUT_MS=3600000
```

## Testing

### `packages/provider-cursor/src/retry.test.ts`

| Test                             | Mock                                            | Expected                                                |
| -------------------------------- | ----------------------------------------------- | ------------------------------------------------------- |
| success on first try             | fn resolves                                     | returns result, sleepFn not called                      |
| fail once, succeed on retry      | fn throws API_ERROR → resolves                  | result returned, sleepFn called once with 240_000       |
| exhaust all retries              | fn always throws API_ERROR                      | throws after 3 attempts, sleepFn called exactly 2 times |
| non-retryable TIMEOUT            | fn throws TIMEOUT                               | throws immediately, sleepFn not called                  |
| custom isRetryable returns false | custom fn returning false                       | throws immediately on first failure                     |
| signal aborted before sleep      | signal.aborted = true after first failure       | throws immediately, sleepFn not called                  |
| signal aborted after sleep       | signal aborts during sleep (checked post-await) | throws after sleep, does not proceed to next attempt    |

### `packages/provider-cursor/src/cursor-translation.test.ts`

- Inject `sleepFn = vi.fn().mockResolvedValue(undefined)` via constructor third argument
- Mock `generateText` to throw on first call, succeed on second
- Verify `sleepFn` called once with 240_000
- Verify final result returned correctly

## Files Changed

```
packages/provider-cursor/src/retry.ts               (NEW)
packages/provider-cursor/src/retry.test.ts          (NEW)
packages/provider-cursor/src/cursor-translation.ts  (MODIFIED)
packages/provider-cursor/src/cursor-plugin.ts       (MODIFIED — type alias only)
packages/provider-cursor/src/cursor-translation.test.ts  (NEW or MODIFIED)
.env                                                 (MODIFIED, not committed)
```

## Risks & Mitigations

| Risk                                              | Mitigation                                                                                                                         |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 240s delay blocks translator process              | Dataset runner is sequential; translator handles 1 request at a time in automation mode. Acceptable.                               |
| 3 retries still insufficient                      | 3 attempts covers burst window empirically. MAX_ATTEMPTS can be increased manually if needed.                                      |
| Pipeline AbortSignal fires during retries         | 1380s worst case < 1800s signal timeout. Signal abort checked before and after each sleep.                                         |
| ACK timeout exceeded in dataset-runner            | 3600s provides ~2200s buffer over 1380s worst case.                                                                                |
| `sleepFn` injection breaks existing instantiation | `sleepFn` is third optional parameter with default; existing `new CursorExecutorCtor(ctx.modelId, ctx.baseUrl)` continues to work. |
