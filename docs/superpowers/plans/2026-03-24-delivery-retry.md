# Delivery Retry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add exponential-backoff retry to `sendTranslatedMessage` so transient TCP failures and HTTP 429 rate limits no longer cause silent delivery loss.

**Architecture:** Extract the current try/catch body into a `deliverMessage` inner function (can throw), then wrap calls to it in a retry loop inside `sendTranslatedMessage`. `isRetriable` and `retryDelayMs` are module-level helpers. A `sleepFn` parameter (default `Bun.sleep`) is injectable for tests.

**Tech Stack:** Bun v1.3, TypeScript strict, `bun:test`, `mock.module` for module-level mocking

---

## File Map

| File                                                       | Action | What changes                                                                                                                                 |
| ---------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/translator/src/services/chatwork-sender.ts`      | Modify | Add error imports, constants, `isRetriable`, `retryDelayMs`, extract `deliverMessage`, add retry loop + `sleepFn` to `sendTranslatedMessage` |
| `packages/translator/src/services/chatwork-sender.test.ts` | Modify | Add error class static imports, update `mock.module` factory, update type annotation, add 6 retry test cases                                 |
| `packages/translator/src/env-schema.ts`                    | Modify | Default `TRANSLATOR_DELIVERY_BUDGET_MS`: `15_000` → `45_000`                                                                                 |
| `.env`                                                     | Modify | `TRANSLATOR_DELIVERY_BUDGET_MS=15000` → `45000`                                                                                              |

---

## Task 1: Write failing tests for retry behavior

**Files:**

- Modify: `packages/translator/src/services/chatwork-sender.test.ts`

**Context:** The test file uses `mock.module('@chatwork-bot/chatwork', ...)` inside `beforeAll` to intercept the dynamic import of `chatwork-sender.ts`. Static imports at the top of the test file resolve before `beforeAll` runs and get the real module — we use this to capture the real error classes and pass them through the mock factory so `instanceof` checks work in the implementation.

- [ ] **Step 1: Add static imports for error classes**

At the top of the file, after the existing `import { buildTranslatedMessage } from './chatwork-sender'` line, add:

```typescript
import { ChatworkApiError, ChatworkRateLimitError } from '@chatwork-bot/chatwork'
```

- [ ] **Step 2: Update `mock.module` factory to pass error classes through**

In `describe('sendTranslatedMessage') > beforeAll`, update the `mock.module` factory to include the error classes. The implementation imports them from `@chatwork-bot/chatwork` at load time — if the mock doesn't export them, they would be `undefined` and `instanceof` checks would throw.

Change:

```typescript
void mock.module('@chatwork-bot/chatwork', () => ({
  sendRoomMessage: mockSendRoomMessage,
  resolveRoomMemberDisplayName: mockResolveRoomMemberDisplayName,
}))
```

To:

```typescript
void mock.module('@chatwork-bot/chatwork', () => ({
  sendRoomMessage: mockSendRoomMessage,
  resolveRoomMemberDisplayName: mockResolveRoomMemberDisplayName,
  ChatworkApiError,
  ChatworkRateLimitError,
}))
```

- [ ] **Step 3: Update `sendTranslatedMessage` type annotation**

The type annotation must include the optional `sleepFn` param so new tests can call the function with it. Change the `let sendTranslatedMessage` declaration (currently lines 113–118):

```typescript
let sendTranslatedMessage: (
  command: TranslationIngressCommand,
  result: TranslationResult,
  config: { apiToken: string; destinationRoomId: number },
  sleepFn?: (ms: number) => Promise<void>,
) => Promise<OutputDelivery>
```

- [ ] **Step 4: Add retry test cases**

Add a nested `describe('retry behavior')` block inside `describe('sendTranslatedMessage')`, after the last existing `it()`. Include a shared config and sleepFn factory at the top of the nested block:

```typescript
describe('retry behavior', () => {
  const config = { apiToken: 'test-token', destinationRoomId: 55555 }
  const makeNoopSleepFn = () => mock((_ms: number) => Promise.resolve())

  it('retries on network TypeError and succeeds on second attempt', async () => {
    mockResolveRoomMemberDisplayName.mockImplementationOnce(() => {
      throw new TypeError('Unable to connect. Is the computer able to access the url?')
    })
    const sleepFn = makeNoopSleepFn()

    const result = await sendTranslatedMessage(makeCommand(), makeResult(), config, sleepFn)

    expect(result.status).toBe('sent')
    expect(mockResolveRoomMemberDisplayName.mock.calls.length).toBe(2)
    expect(sleepFn.mock.calls.length).toBe(1)
    expect(sleepFn.mock.calls[0]?.[0]).toBe(1000)
  })

  it('retries on ChatworkRateLimitError and succeeds on third attempt', async () => {
    mockSendRoomMessage
      .mockImplementationOnce(() => Promise.reject(new ChatworkRateLimitError(3)))
      .mockImplementationOnce(() => Promise.reject(new ChatworkRateLimitError(3)))
    const sleepFn = makeNoopSleepFn()

    const result = await sendTranslatedMessage(makeCommand(), makeResult(), config, sleepFn)

    expect(result.status).toBe('sent')
    expect(mockResolveRoomMemberDisplayName.mock.calls.length).toBe(3)
    expect(sleepFn.mock.calls.length).toBe(2)
    expect(sleepFn.mock.calls[0]?.[0]).toBe(3000)
    expect(sleepFn.mock.calls[1]?.[0]).toBe(3000)
  })

  it('exhausts all retries on repeated network TypeError and returns failed', async () => {
    mockResolveRoomMemberDisplayName.mockImplementation(() => {
      throw new TypeError('Unable to connect. Is the computer able to access the url?')
    })
    const sleepFn = makeNoopSleepFn()

    const result = await sendTranslatedMessage(makeCommand(), makeResult(), config, sleepFn)

    expect(result.status).toBe('failed')
    expect(result.errorCode).toBe('TypeError')
    expect(mockResolveRoomMemberDisplayName.mock.calls.length).toBe(3)
    expect(sleepFn.mock.calls.length).toBe(2)

    // Reset to default for subsequent tests
    mockResolveRoomMemberDisplayName.mockImplementation((_roomId, _accountId, _token, _cache) =>
      Promise.resolve('Nguyen Van A'),
    )
  })

  it('does NOT retry on TypeError with non-network message', async () => {
    mockResolveRoomMemberDisplayName.mockImplementationOnce(() => {
      throw new TypeError('Cannot read properties of null (reading "length")')
    })
    const sleepFn = makeNoopSleepFn()

    const result = await sendTranslatedMessage(makeCommand(), makeResult(), config, sleepFn)

    expect(result.status).toBe('failed')
    expect(result.errorCode).toBe('TypeError')
    expect(mockResolveRoomMemberDisplayName.mock.calls.length).toBe(1)
    expect(sleepFn.mock.calls.length).toBe(0)
  })

  it('does NOT retry on ChatworkApiError with non-429 status', async () => {
    mockSendRoomMessage.mockImplementationOnce(() =>
      Promise.reject(new ChatworkApiError('Unauthorized', 401, 'Unauthorized')),
    )
    const sleepFn = makeNoopSleepFn()

    const result = await sendTranslatedMessage(makeCommand(), makeResult(), config, sleepFn)

    expect(result.status).toBe('failed')
    expect(result.errorCode).toBe('ChatworkApiError')
    expect(mockSendRoomMessage.mock.calls.length).toBe(1)
    expect(sleepFn.mock.calls.length).toBe(0)
  })

  it('caps rate-limit delay at 10 000 ms and uses raw value when under cap', async () => {
    // Uncapped: retryAfter=3 → 3000 ms
    mockSendRoomMessage.mockImplementationOnce(() => Promise.reject(new ChatworkRateLimitError(3)))
    const sleepFnUncapped = makeNoopSleepFn()
    await sendTranslatedMessage(makeCommand(), makeResult(), config, sleepFnUncapped)
    expect(sleepFnUncapped.mock.calls[0]?.[0]).toBe(3000)

    mockSendRoomMessage.mockClear()
    mockResolveRoomMemberDisplayName.mockClear()
    mockResolveRoomMemberDisplayName.mockImplementation((_roomId, _accountId, _token, _cache) =>
      Promise.resolve('Nguyen Van A'),
    )
    mockSendRoomMessage.mockImplementation((_roomId, _message, _token) =>
      Promise.resolve({ message_id: 'sent-456' }),
    )

    // Capped: retryAfter=15 → 10 000 ms
    mockSendRoomMessage.mockImplementationOnce(() => Promise.reject(new ChatworkRateLimitError(15)))
    const sleepFnCapped = makeNoopSleepFn()
    await sendTranslatedMessage(makeCommand(), makeResult(), config, sleepFnCapped)
    expect(sleepFnCapped.mock.calls[0]?.[0]).toBe(10_000)
  })
})
```

- [ ] **Step 5: Run tests to confirm new cases fail (expected)**

```bash
bun test packages/translator/src/services/chatwork-sender.test.ts
```

Expected: 6 new tests fail. The "does NOT retry" tests (steps 3a and 4) may pass since current impl always returns failed without retrying — this is expected and correct. Tests 1, 2, 3, and 5 must fail with current implementation.

> Note: typecheck will also fail because the current `sendTranslatedMessage` has only 3 params. This is expected — it will be fixed in Task 2.

---

## Task 2: Implement retry in `chatwork-sender.ts`

**Files:**

- Modify: `packages/translator/src/services/chatwork-sender.ts`

- [ ] **Step 1: Replace the file content with the new implementation**

The new file is a full rewrite. Replace `packages/translator/src/services/chatwork-sender.ts` with:

```typescript
import {
  sendRoomMessage,
  resolveRoomMemberDisplayName,
  ChatworkApiError,
  ChatworkRateLimitError,
} from '@chatwork-bot/chatwork'
import type { TranslationIngressCommand, TranslationResult } from '@chatwork-bot/core'
import type { OutputDelivery } from '~/types/output'

const MAX_RETRIES = 2
const NETWORK_ERROR_PATTERN = /connect|fetch|ECONNREFUSED|timeout/i

// MUST check ChatworkRateLimitError before ChatworkApiError (subclass ordering):
// ChatworkRateLimitError extends ChatworkApiError — checking the base class first
// would match rate-limit errors as non-retriable before the subclass check is reached.
function isRetriable(error: unknown): boolean {
  if (error instanceof ChatworkRateLimitError) return true
  if (error instanceof TypeError && NETWORK_ERROR_PATTERN.test(error.message)) return true
  return false
}

function retryDelayMs(error: unknown, attempt: number): number {
  if (error instanceof ChatworkRateLimitError) {
    return Math.min(error.retryAfter * 1000, 10_000)
  }
  if (error instanceof TypeError) {
    return 1000 * Math.pow(2, attempt - 1)
  }
  throw new Error('unreachable: retryDelayMs called with non-retriable error')
}

/**
 * Builds the translated message string to send to the destination Chatwork room.
 * Preserves [To:xxx] and [cc:xxx] markup tags from the original body.
 * Wraps content in Chatwork [info][title] block with metadata.
 */
export function buildTranslatedMessage(
  command: TranslationIngressCommand,
  result: TranslationResult,
  senderName: string,
): string {
  const { rawBody, sendTime } = command

  const timeStr = new Date(sendTime * 1000).toISOString().slice(0, 16).replace('T', ' ')
  const title = `📨 From: ${senderName} | ${timeStr}`

  const markupTags = (rawBody.match(/\[(?:To|cc):\d+\]/g) ?? []).join('')
  const content = markupTags ? `${markupTags}\n${result.translatedText}` : result.translatedText

  return `[info][title]${title}[/title]\n${content}[/info]`
}

async function deliverMessage(
  command: TranslationIngressCommand,
  result: TranslationResult,
  config: { apiToken: string; destinationRoomId: number },
): Promise<OutputDelivery> {
  const cache = new Map<number, string>()
  const senderName = await resolveRoomMemberDisplayName(
    command.sourceRoomId,
    command.senderAccountId,
    config.apiToken,
    cache,
  )

  const message = buildTranslatedMessage(command, result, senderName)
  const response = await sendRoomMessage(config.destinationRoomId, message, config.apiToken)

  return {
    status: 'sent',
    destinationRoomId: config.destinationRoomId,
    destinationMessageId: response.message_id,
    sentAt: new Date().toISOString(),
  }
}

/**
 * Looks up the sender's name, builds the translated message, and sends it
 * to the configured destination Chatwork room.
 * Retries on transient network errors (TypeError with network message) and
 * rate limit errors (429) with exponential backoff. Max 3 total attempts.
 * Returns delivery metadata — never throws; errors are captured in the returned status.
 *
 * sleepFn is injectable for testing: Bun has no clean way to mock Bun.sleep()
 * without parameter injection.
 */
export async function sendTranslatedMessage(
  command: TranslationIngressCommand,
  result: TranslationResult,
  config: { apiToken: string; destinationRoomId: number },
  sleepFn: (ms: number) => Promise<void> = (ms) => Bun.sleep(ms),
): Promise<OutputDelivery> {
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      return await deliverMessage(command, result, config)
    } catch (error) {
      if (attempt <= MAX_RETRIES && isRetriable(error)) {
        const delayMs = retryDelayMs(error, attempt)
        console.warn(
          JSON.stringify({
            level: 'warn',
            service: 'translator',
            event: 'translation_delivery_retrying',
            attempt: attempt + 1,
            maxAttempts: MAX_RETRIES + 1,
            delayMs,
            errorCode: error instanceof Error ? error.constructor.name : 'UnknownError',
            errorMessage: error instanceof Error ? error.message : String(error),
          }),
        )
        await sleepFn(delayMs)
        continue
      }
      return {
        status: 'failed',
        destinationRoomId: config.destinationRoomId,
        errorCode: error instanceof Error ? error.constructor.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : String(error),
        sentAt: new Date().toISOString(),
      }
    }
  }
  // Unreachable: loop always returns inside try or catch
  throw new Error('unreachable: retry loop exited without returning')
}
```

- [ ] **Step 2: Run tests and confirm all pass**

```bash
bun test packages/translator/src/services/chatwork-sender.test.ts
```

Expected: all tests pass, including the 6 new ones.

> If the "exhausts all retries" test fails: check that `mockImplementation` (not `mockImplementationOnce`) was used in that test's setup, and that it's reset after. The test itself resets the mock implementation at the end.

- [ ] **Step 3: Run full suite + typecheck**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: all 373+ tests pass, no typecheck errors, no lint errors.

- [ ] **Step 4: Commit**

```bash
git add packages/translator/src/services/chatwork-sender.ts \
        packages/translator/src/services/chatwork-sender.test.ts
git commit -m "feat(translator): add delivery retry with exponential backoff

Retries on transient network TypeError (message matches
/connect|fetch|ECONNREFUSED|timeout/i) and ChatworkRateLimitError (429)
with exponential backoff (1s, 2s). Max 3 total attempts. sleepFn is
injectable for testing without real sleeps.

errorCode in OutputDelivery now uses error.constructor.name instead of
the hardcoded string 'CHATWORK_API'.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Update delivery budget default

**Files:**

- Modify: `packages/translator/src/env-schema.ts` (line 15)
- Modify: `.env` (line 38)

**Context:** With 3 attempts × 5 s TCP timeout + 10 s + 10 s rate-limit delay = 35 s worst case. The current 15 s default would expire before the retry loop finishes. 45 s provides headroom.

- [ ] **Step 1: Update env-schema.ts default**

In `packages/translator/src/env-schema.ts`, change line 15:

```typescript
// Before
TRANSLATOR_DELIVERY_BUDGET_MS: z.coerce.number().int().positive().default(15_000),

// After
TRANSLATOR_DELIVERY_BUDGET_MS: z.coerce.number().int().positive().default(45_000),
```

- [ ] **Step 2: Update .env local dev value**

In `.env`, change line 38:

```
# Before
TRANSLATOR_DELIVERY_BUDGET_MS=15000

# After
TRANSLATOR_DELIVERY_BUDGET_MS=45000
```

- [ ] **Step 3: Run full suite**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/translator/src/env-schema.ts .env
git commit -m "chore(translator): increase delivery budget default to 45 s

Worst-case with 3 attempts + exponential backoff + rate-limit delays:
3 × 5s timeout + 10s + 10s = 35s. 45s provides headroom over 35s.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Verification

After all tasks complete:

```bash
bun test && bun run typecheck && bun run lint
```

All checks green. The delivery phase now silently retries transient failures up to 3 times before returning `{ status: 'failed' }`.
