# Cursor API Retry & Cooldown Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add retry-with-delay logic to `CursorExecutor` so Cursor API timeouts are automatically retried after a 240s burst-window reset, while increasing dataset-runner cooldown and ACK timeout to prevent progressive throttling.

**Architecture:** A new `withRetry()` utility in `provider-cursor` wraps only the `generateText()` call inside `CursorExecutor.execute()`. `sleepFn` is injected via constructor (third optional parameter, default `Bun.sleep`) for testability. Layer 2 changes two `.env` values only — no code changes.

**Tech Stack:** Bun · TypeScript 5.4+ strict · `bun:test` (Bun's built-in test runner, uses `mock`, `describe`, `it`, `expect` from `bun:test`) · Vercel AI SDK (`ai`, `@ai-sdk/openai-compatible`)

**Spec:** `docs/superpowers/specs/2026-03-11-cursor-retry-design.md`

---

## File Map

| File                                                 | Action | Responsibility                                                                |
| ---------------------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| `packages/provider-cursor/src/retry.ts`              | CREATE | `withRetry<T>()` generic utility — retry loop, sleep, signal checks, warn log |
| `packages/provider-cursor/src/retry.test.ts`         | CREATE | Unit tests for all `withRetry()` scenarios                                    |
| `packages/provider-cursor/src/cursor-translation.ts` | MODIFY | Add `sleepFn` to constructor; wrap `generateText()` with `withRetry()`        |
| `packages/provider-cursor/src/cursor-plugin.ts`      | MODIFY | Update `CursorExecutorConstructor` type alias to include optional `sleepFn`   |
| `.env`                                               | MODIFY | `DATASET_COOLDOWN_MS=30000`, `DATASET_ITEM_TIMEOUT_MS=3600000`                |

---

## Chunk 1: withRetry() utility

### Task 1: Create `retry.test.ts` with failing tests

**Files:**

- Create: `packages/provider-cursor/src/retry.test.ts`

> **Note on Bun mocking**: Bun uses `mock()` from `bun:test` (NOT `vi.fn()`). Use `mock(() => Promise.resolve())` for sleepFn. Use `mock.mockImplementationOnce(...)` or create multiple mocks with different behaviors.

- [ ] **Step 1.1: Create the test file**

```ts
// packages/provider-cursor/src/retry.test.ts
import { describe, expect, it, mock } from 'bun:test'
import { TranslationError } from '@chatwork-bot/core'

// Will be imported once the module exists
// import { withRetry } from './retry'

describe('withRetry', () => {
  it('returns result immediately on first success', async () => {
    const { withRetry } = await import('./retry')
    const fn = mock(() => Promise.resolve('ok'))
    const sleepFn = mock((_ms: number) => Promise.resolve())
    const result = await withRetry(fn, { sleepFn })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(sleepFn).not.toHaveBeenCalled()
  })

  it('retries on API_ERROR and returns result on second attempt', async () => {
    const { withRetry } = await import('./retry')
    const apiError = new TranslationError('timeout', 'API_ERROR')
    const fn = mock(() => Promise.resolve('ok'))
    fn.mockImplementationOnce(() => Promise.reject(apiError))
    const sleepFn = mock((_ms: number) => Promise.resolve())
    const result = await withRetry(fn, { sleepFn })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
    expect(sleepFn).toHaveBeenCalledTimes(1)
    expect(sleepFn).toHaveBeenCalledWith(240_000)
  })

  it('throws after exhausting all attempts', async () => {
    const { withRetry } = await import('./retry')
    const apiError = new TranslationError('timeout', 'API_ERROR')
    const fn = mock(() => Promise.reject(apiError))
    const sleepFn = mock((_ms: number) => Promise.resolve())
    await expect(withRetry(fn, { sleepFn })).rejects.toThrow('timeout')
    expect(fn).toHaveBeenCalledTimes(3)
    expect(sleepFn).toHaveBeenCalledTimes(2) // sleep between attempts, not after last
  })

  it('throws immediately on TIMEOUT — not retryable', async () => {
    const { withRetry } = await import('./retry')
    const timeoutError = new TranslationError('signal fired', 'TIMEOUT')
    const fn = mock(() => Promise.reject(timeoutError))
    const sleepFn = mock((_ms: number) => Promise.resolve())
    await expect(withRetry(fn, { sleepFn })).rejects.toThrow('signal fired')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(sleepFn).not.toHaveBeenCalled()
  })

  it('throws immediately when custom isRetryable returns false', async () => {
    const { withRetry } = await import('./retry')
    const err = new Error('some error')
    const fn = mock(() => Promise.reject(err))
    const sleepFn = mock((_ms: number) => Promise.resolve())
    await expect(withRetry(fn, { sleepFn, isRetryable: () => false })).rejects.toThrow('some error')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(sleepFn).not.toHaveBeenCalled()
  })

  it('throws immediately if signal is aborted before sleep', async () => {
    const { withRetry } = await import('./retry')
    const apiError = new TranslationError('timeout', 'API_ERROR')
    const fn = mock(() => Promise.reject(apiError))
    const sleepFn = mock((_ms: number) => Promise.resolve())
    const controller = new AbortController()
    controller.abort() // already aborted
    await expect(withRetry(fn, { sleepFn, signal: controller.signal })).rejects.toThrow()
    expect(sleepFn).not.toHaveBeenCalled()
  })

  it('does not proceed to next attempt if signal aborts after sleep', async () => {
    const { withRetry } = await import('./retry')
    const apiError = new TranslationError('timeout', 'API_ERROR')
    const fn = mock(() => Promise.reject(apiError))
    const controller = new AbortController()
    // sleep completes, then signal is already aborted
    const sleepFn = mock((_ms: number) => {
      controller.abort()
      return Promise.resolve()
    })
    await expect(withRetry(fn, { sleepFn, signal: controller.signal })).rejects.toThrow()
    expect(fn).toHaveBeenCalledTimes(1) // no second attempt
    expect(sleepFn).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 1.2: Run tests to confirm they fail (module not yet created)**

```bash
cd /path/to/chatwork-translation-bot
bun test packages/provider-cursor/src/retry.test.ts
```

Expected: import error or "Cannot find module './retry'"

---

### Task 2: Create `retry.ts` implementation

**Files:**

- Create: `packages/provider-cursor/src/retry.ts`

- [ ] **Step 2.1: Create the implementation**

```ts
// packages/provider-cursor/src/retry.ts
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

- [ ] **Step 2.2: Run tests — all should pass**

```bash
bun test packages/provider-cursor/src/retry.test.ts
```

Expected: 7 pass, 0 fail

- [ ] **Step 2.3: Run typecheck**

```bash
bun run --filter @chatwork-bot/provider-cursor typecheck
```

Expected: Done in ~1s, no errors

- [ ] **Step 2.4: Commit**

```bash
git add packages/provider-cursor/src/retry.ts packages/provider-cursor/src/retry.test.ts
git commit -m "feat(translator): add withRetry utility for Cursor API retries"
```

---

## Chunk 2: CursorExecutor integration + env config

### Task 3: Update `cursor-translation.ts` to use `withRetry()`

**Files:**

- Modify: `packages/provider-cursor/src/cursor-translation.ts`

The current file has this structure (read it before editing):

```
Line 1-5:   imports
Line 7-8:   class + provider field
Line 10-18: constructor (modelId, baseUrl)
Line 20-63: execute() method
  Lines 26-41: try-catch around generateText() — THIS is what we wrap
  Lines 43-52: try-catch around extractJsonFromText() — leave unchanged
  Lines 54-62: try-catch around schema.parse() — leave unchanged
```

- [ ] **Step 3.1: Write failing integration test first**

Add to the BOTTOM of `packages/provider-cursor/src/cursor-plugin.test.ts` (this file already mocks `ai` and `@ai-sdk/openai-compatible` at module level — your new tests inherit those mocks):

```ts
describe('CursorExecutor retry behavior', () => {
  it('retries on API_ERROR and calls sleepFn', async () => {
    const { CursorExecutor } = await import('./cursor-translation')
    const apiError = new Error('The operation timed out.')
    let callCount = 0
    generateTextMock.mockImplementation(() => {
      callCount++
      if (callCount === 1) return Promise.reject(apiError)
      return Promise.resolve({ text: '{"sourceLang":"ja","translated":"こんにちは"}' })
    })
    const sleepFn = mock((_ms: number) => Promise.resolve())
    const executor = new CursorExecutor('sonnet-4.6', 'http://127.0.0.1:8765/v1', sleepFn)
    const schema = { parse: (d: unknown) => d as { sourceLang: string; translated: string } }
    const result = await executor.execute({ system: 'translate', user: 'hello' }, schema)
    expect(result.translated).toBe('こんにちは')
    expect(sleepFn).toHaveBeenCalledWith(240_000)
    generateTextMock.mockReset()
  })
})
```

- [ ] **Step 3.2: Run to confirm the test fails**

```bash
bun test packages/provider-cursor/src/cursor-plugin.test.ts --test-name-pattern "retry"
```

Expected: Fail — `CursorExecutor` constructor only accepts 2 args currently

- [ ] **Step 3.3: Modify `cursor-translation.ts`**

Replace the constructor and the first try-catch block. Full file after edit:

```ts
import { generateText } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { ILLMExecutor, PromptPair, ISchema } from '@chatwork-bot/core'
import { TranslationError } from '@chatwork-bot/core'
import { extractJsonFromText } from './extract-json'
import { withRetry } from './retry'

export class CursorExecutor implements ILLMExecutor {
  private readonly provider: ReturnType<typeof createOpenAICompatible>

  constructor(
    private readonly modelId: string,
    private readonly baseUrl: string,
    private readonly sleepFn: (ms: number) => Promise<void> = Bun.sleep,
  ) {
    this.provider = createOpenAICompatible({
      name: 'cursor',
      baseURL: baseUrl,
    })
  }

  async execute<T>(
    prompts: PromptPair,
    schema: ISchema<T>,
    options?: { signal?: AbortSignal },
  ): Promise<T> {
    const rawText = await withRetry(
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

    let json: unknown
    try {
      json = extractJsonFromText(rawText)
    } catch (cause) {
      throw new TranslationError(
        `No JSON in Cursor response: ${cause instanceof Error ? cause.message : String(cause)}`,
        'API_ERROR',
        cause,
      )
    }

    try {
      return schema.parse(json)
    } catch (cause) {
      throw new TranslationError(
        `Invalid Cursor response schema: ${cause instanceof Error ? cause.message : String(cause)}`,
        'INVALID_RESPONSE',
        cause,
      )
    }
  }
}
```

- [ ] **Step 3.4: Run the integration test — should pass**

```bash
bun test packages/provider-cursor/src/cursor-plugin.test.ts --test-name-pattern "retry"
```

Expected: 1 pass

- [ ] **Step 3.5: Run ALL cursor-plugin tests to verify no regressions**

```bash
bun test packages/provider-cursor/src/cursor-plugin.test.ts
```

Expected: All existing tests still pass (the `cursorPlugin.create()` call doesn't pass `sleepFn` — it uses the default `Bun.sleep`, which is fine since `generateText` is mocked and never actually sleeps in tests)

---

### Task 4: Update `cursor-plugin.ts` type alias

**Files:**

- Modify: `packages/provider-cursor/src/cursor-plugin.ts:5-8`

- [ ] **Step 4.1: Update the type alias only**

Change lines 5–8 from:

```ts
type CursorExecutorConstructor = new (
  modelId: ProviderCreateContext['modelId'],
  baseUrl: string,
) => ILLMExecutor
```

To:

```ts
type CursorExecutorConstructor = new (
  modelId: ProviderCreateContext['modelId'],
  baseUrl: string,
  sleepFn?: (ms: number) => Promise<void>,
) => ILLMExecutor
```

No other changes — the `create()` function at line 88 (`new CursorExecutorCtor(ctx.modelId, ctx.baseUrl)`) stays unchanged.

- [ ] **Step 4.2: Run typecheck and full test suite**

```bash
bun run typecheck && bun test
```

Expected: 0 type errors, all 227+ tests pass

- [ ] **Step 4.3: Commit both translation + plugin changes**

```bash
git add packages/provider-cursor/src/cursor-translation.ts packages/provider-cursor/src/cursor-plugin.ts packages/provider-cursor/src/cursor-plugin.test.ts
git commit -m "feat(translator): integrate withRetry into CursorExecutor with sleepFn injection"
```

---

### Task 5: Update `.env` (Layer 2)

**Files:**

- Modify: `.env`

> **Note:** `.env` is NOT committed (it's in `.gitignore`). This change is local dev only.

- [ ] **Step 5.1: Update the two values**

In `.env`, change:

```env
DATASET_COOLDOWN_MS=2000
DATASET_ITEM_TIMEOUT_MS=1800000
```

To:

```env
DATASET_COOLDOWN_MS=30000
DATASET_ITEM_TIMEOUT_MS=3600000
```

- [ ] **Step 5.2: Verify env validation still passes**

```bash
bun test packages/dataset-runner/src
```

Expected: All dataset-runner tests pass (env validation is tested with process.env mocks, not from .env file directly)

- [ ] **Step 5.3: Run full test suite one final time**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: All tests pass, no type errors, no lint errors

---

## Definition of Done

- [ ] `packages/provider-cursor/src/retry.ts` — `withRetry()` function with retry loop, signal checks, warn log
- [ ] `packages/provider-cursor/src/retry.test.ts` — 7 test cases covering all retry scenarios
- [ ] `packages/provider-cursor/src/cursor-translation.ts` — `sleepFn` in constructor, `withRetry()` wrapping generateText
- [ ] `packages/provider-cursor/src/cursor-plugin.ts` — type alias updated with optional `sleepFn`
- [ ] `.env` — `DATASET_COOLDOWN_MS=30000`, `DATASET_ITEM_TIMEOUT_MS=3600000`
- [ ] `bun test && bun run typecheck && bun run lint` — all green
