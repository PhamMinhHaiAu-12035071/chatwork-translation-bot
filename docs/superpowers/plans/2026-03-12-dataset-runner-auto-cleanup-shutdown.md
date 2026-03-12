# Dataset Runner — Auto Cleanup & Auto-Shutdown Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After each dataset item is processed, automatically delete the source and destination Chatwork messages, then shut down the entire Docker stack when the queue empties.

**Architecture:** Add a new `message-cleaner.ts` service (calls `@chatwork-bot/chatwork`'s `deleteRoomMessage`), wire it into `queue-runner.ts` at three call sites (success path + two hard-stop paths), and add a `processedFilesCount` counter that triggers `process.exit(0)` + a summary table when the queue drains. Docker stack teardown is triggered by `--abort-on-container-exit`, and `dev.sh` must treat the named `docker` command as the success authority when cursor local mode uses `concurrently`.

**Tech Stack:** Bun v1.1+ · TypeScript 5.4+ strict · `@chatwork-bot/chatwork` · `bun:test`

**Spec:** `docs/superpowers/specs/2026-03-12-dataset-runner-auto-cleanup-shutdown-design.md`

---

## File Map

| File                                                           | Action     | Responsibility                                                                      |
| -------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------- |
| `packages/dataset-runner/src/services/message-cleaner.ts`      | **Create** | Delete source + destination Chatwork messages; catch errors, log warn               |
| `packages/dataset-runner/src/services/message-cleaner.test.ts` | **Create** | Unit tests for `cleanupMessages`                                                    |
| `packages/dataset-runner/src/services/queue-runner.ts`         | **Modify** | Wire cleanup at success path + 2 hard-stop paths; add auto-shutdown logic + summary |

`scripts/dev-dataset.sh` — **no changes needed**.
`scripts/dev.sh` — **requires orchestration fix** so cursor-mode happy shutdown returns `0` even when `cursor-proxy` is SIGTERM'd intentionally.

---

## Chunk 1: `message-cleaner.ts` module (TDD)

**Files:**

- Create: `packages/dataset-runner/src/services/message-cleaner.ts`
- Create: `packages/dataset-runner/src/services/message-cleaner.test.ts`

### Task 1: Write the failing tests for `message-cleaner.ts`

- [ ] **Step 1.1: Create the test file**

```typescript
// packages/dataset-runner/src/services/message-cleaner.test.ts
import { describe, expect, it, mock } from 'bun:test'

void mock.module('@chatwork-bot/chatwork', () => ({
  deleteRoomMessage: mock(() => Promise.resolve()),
}))

describe('cleanupMessages', () => {
  it('calls deleteRoomMessage for source when only source is provided', async () => {
    const { deleteRoomMessage } = await import('@chatwork-bot/chatwork')
    const { cleanupMessages } = await import('./message-cleaner')

    const deleteMock = deleteRoomMessage as ReturnType<typeof mock>
    deleteMock.mockClear()
    deleteMock.mockImplementation(() => Promise.resolve())

    await cleanupMessages({ sourceRoomId: 111, sourceMessageId: 'src-1' }, 'test-token')

    expect(deleteMock.mock.calls.length).toBe(1)
    expect(deleteMock.mock.calls[0]).toEqual([111, 'src-1', 'test-token'])
  })

  it('calls deleteRoomMessage for both source and destination when both are provided', async () => {
    const { deleteRoomMessage } = await import('@chatwork-bot/chatwork')
    const { cleanupMessages } = await import('./message-cleaner')

    const deleteMock = deleteRoomMessage as ReturnType<typeof mock>
    deleteMock.mockClear()
    deleteMock.mockImplementation(() => Promise.resolve())

    await cleanupMessages(
      {
        sourceRoomId: 111,
        sourceMessageId: 'src-1',
        destRoomId: 222,
        destMessageId: 'dst-1',
      },
      'test-token',
    )

    expect(deleteMock.mock.calls.length).toBe(2)
    expect(deleteMock.mock.calls[0]).toEqual([111, 'src-1', 'test-token'])
    expect(deleteMock.mock.calls[1]).toEqual([222, 'dst-1', 'test-token'])
  })

  it('skips destination delete when destRoomId is absent', async () => {
    const { deleteRoomMessage } = await import('@chatwork-bot/chatwork')
    const { cleanupMessages } = await import('./message-cleaner')

    const deleteMock = deleteRoomMessage as ReturnType<typeof mock>
    deleteMock.mockClear()
    deleteMock.mockImplementation(() => Promise.resolve())

    await cleanupMessages(
      { sourceRoomId: 111, sourceMessageId: 'src-1', destMessageId: 'dst-1' },
      'test-token',
    )

    // destRoomId absent → only source deleted
    expect(deleteMock.mock.calls.length).toBe(1)
  })

  it('skips destination delete when destMessageId is absent', async () => {
    const { deleteRoomMessage } = await import('@chatwork-bot/chatwork')
    const { cleanupMessages } = await import('./message-cleaner')

    const deleteMock = deleteRoomMessage as ReturnType<typeof mock>
    deleteMock.mockClear()
    deleteMock.mockImplementation(() => Promise.resolve())

    await cleanupMessages(
      { sourceRoomId: 111, sourceMessageId: 'src-1', destRoomId: 222 },
      'test-token',
    )

    // destMessageId absent → only source deleted
    expect(deleteMock.mock.calls.length).toBe(1)
  })

  it('does not throw when source delete fails — logs warn and continues', async () => {
    const { deleteRoomMessage } = await import('@chatwork-bot/chatwork')
    const { cleanupMessages } = await import('./message-cleaner')

    const deleteMock = deleteRoomMessage as ReturnType<typeof mock>
    deleteMock.mockClear()
    deleteMock.mockImplementation(() => Promise.reject(new Error('404 not found')))

    const loggedLines: string[] = []
    const originalConsoleError = console.error
    console.error = mock((...args: unknown[]) => {
      loggedLines.push(args.map((a) => String(a)).join(' '))
    }) as typeof console.error

    // Must not throw
    await expect(
      cleanupMessages({ sourceRoomId: 111, sourceMessageId: 'src-1' }, 'test-token'),
    ).resolves.toBeUndefined()

    expect(loggedLines.some((l) => l.includes('"event":"dataset_cleanup_failed"'))).toBe(true)
    expect(loggedLines.some((l) => l.includes('"level":"warn"'))).toBe(true)

    console.error = originalConsoleError
  })

  it('continues to delete destination even when source delete fails', async () => {
    const { deleteRoomMessage } = await import('@chatwork-bot/chatwork')
    const { cleanupMessages } = await import('./message-cleaner')

    const deleteMock = deleteRoomMessage as ReturnType<typeof mock>
    deleteMock.mockClear()
    let callCount = 0
    deleteMock.mockImplementation(() => {
      callCount++
      if (callCount === 1) return Promise.reject(new Error('source fail'))
      return Promise.resolve()
    })

    const originalConsoleError = console.error
    console.error = mock(() => {}) as typeof console.error

    await cleanupMessages(
      { sourceRoomId: 111, sourceMessageId: 'src-1', destRoomId: 222, destMessageId: 'dst-1' },
      'test-token',
    )

    // Both calls attempted despite first failure
    expect(deleteMock.mock.calls.length).toBe(2)
    console.error = originalConsoleError
  })

  it('does not throw when destination delete fails — logs warn and continues', async () => {
    const { deleteRoomMessage } = await import('@chatwork-bot/chatwork')
    const { cleanupMessages } = await import('./message-cleaner')

    const deleteMock = deleteRoomMessage as ReturnType<typeof mock>
    deleteMock.mockClear()
    let callCount = 0
    deleteMock.mockImplementation(() => {
      callCount++
      if (callCount === 2) return Promise.reject(new Error('dest 404'))
      return Promise.resolve()
    })

    const loggedLines: string[] = []
    const originalConsoleError = console.error
    console.error = mock((...args: unknown[]) => {
      loggedLines.push(args.map((a) => String(a)).join(' '))
    }) as typeof console.error

    await expect(
      cleanupMessages(
        { sourceRoomId: 111, sourceMessageId: 'src-1', destRoomId: 222, destMessageId: 'dst-1' },
        'test-token',
      ),
    ).resolves.toBeUndefined()

    expect(loggedLines.some((l) => l.includes('"event":"dataset_cleanup_failed"'))).toBe(true)
    console.error = originalConsoleError
  })
})
```

- [ ] **Step 1.2: Run tests to confirm they fail (module not found)**

```bash
cd /path/to/chatwork-translation-bot
bun test packages/dataset-runner/src/services/message-cleaner.test.ts
```

Expected: error — `Cannot find module './message-cleaner'`

---

### Task 2: Implement `message-cleaner.ts`

- [ ] **Step 2.1: Create the implementation file**

```typescript
// packages/dataset-runner/src/services/message-cleaner.ts
import { deleteRoomMessage } from '@chatwork-bot/chatwork'

export interface MessageCleanupPair {
  sourceRoomId: number
  sourceMessageId: string
  destRoomId?: number
  destMessageId?: string
}

export async function cleanupMessages(pair: MessageCleanupPair, apiToken: string): Promise<void> {
  try {
    await deleteRoomMessage(pair.sourceRoomId, pair.sourceMessageId, apiToken)
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'warn',
        service: 'dataset-runner',
        event: 'dataset_cleanup_failed',
        target: 'source',
        roomId: pair.sourceRoomId,
        messageId: pair.sourceMessageId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }),
    )
  }

  if (pair.destRoomId === undefined || pair.destMessageId === undefined) return

  try {
    await deleteRoomMessage(pair.destRoomId, pair.destMessageId, apiToken)
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'warn',
        service: 'dataset-runner',
        event: 'dataset_cleanup_failed',
        target: 'destination',
        roomId: pair.destRoomId,
        messageId: pair.destMessageId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }),
    )
  }
}
```

- [ ] **Step 2.2: Run tests to confirm they pass**

```bash
bun test packages/dataset-runner/src/services/message-cleaner.test.ts
```

Expected: all 7 tests PASS

- [ ] **Step 2.3: Run typecheck**

```bash
bun run typecheck
```

Expected: no errors

- [ ] **Step 2.4: Commit**

```bash
git add packages/dataset-runner/src/services/message-cleaner.ts \
        packages/dataset-runner/src/services/message-cleaner.test.ts
git commit -m "feat(dataset-runner): add message-cleaner service for post-item cleanup"
```

---

## Chunk 2: Wire cleanup into `queue-runner.ts`

**File:** `packages/dataset-runner/src/services/queue-runner.ts`

> Read the full file before editing: `packages/dataset-runner/src/services/queue-runner.ts`

The file has three call sites where cleanup needs to be added. All changes are additive — no existing logic is removed.

### Task 3: Add import + success-path cleanup

- [ ] **Step 3.1: Add the import at the top of `queue-runner.ts`**

Add after the existing imports block (after the last `import` statement):

```typescript
import { cleanupMessages } from '~/services/message-cleaner'
```

- [ ] **Step 3.2: Add cleanup after success path**

Locate this block in `queue-runner.ts` (the success branch, after `clearDeliveryAck`):

```typescript
this.logEvent('info', 'dataset_ack_received', {
  sourceMessageId,
  datasetFile: file.fileName,
  datasetItemId: record.item.id,
  datasetLineNumber: record.lineNumber,
})
workingState = await this.markRecordSucceeded(file.fileName, workingState, record)
await clearDeliveryAck(this.config.inputDir, sourceMessageId)
this.status.updatedAt = new Date().toISOString()
state = workingState
if (await this.sleepOrShutdown(this.config.cooldownMs)) return
```

Replace with (add cleanup call after `clearDeliveryAck`; `ack` remains in-scope so ordering is safe):

```typescript
this.logEvent('info', 'dataset_ack_received', {
  sourceMessageId,
  datasetFile: file.fileName,
  datasetItemId: record.item.id,
  datasetLineNumber: record.lineNumber,
})
workingState = await this.markRecordSucceeded(file.fileName, workingState, record)
await clearDeliveryAck(this.config.inputDir, sourceMessageId)
await cleanupMessages(
  {
    sourceRoomId: record.item.originalRoomId ?? this.config.defaultOriginalRoomId,
    sourceMessageId,
    destRoomId: ack.destinationRoomId,
    destMessageId: ack.destinationMessageId,
  },
  this.config.apiToken,
)
this.status.updatedAt = new Date().toISOString()
state = workingState
if (await this.sleepOrShutdown(this.config.cooldownMs)) return
```

- [ ] **Step 3.3: Run typecheck to confirm no errors**

```bash
bun run typecheck
```

Expected: no errors

- [ ] **Step 3.4: Run existing tests to confirm nothing broken**

```bash
bun test packages/dataset-runner/
```

Expected: all existing tests pass (cleanup tests also pass)

- [ ] **Step 3.5: Commit**

```bash
git add packages/dataset-runner/src/services/queue-runner.ts
git commit -m "feat(dataset-runner): cleanup messages after successful item processing"
```

---

### Task 4: Add cleanup to hard-stop paths

There are two hard-stop paths that need cleanup (the third — send retry exhausted — never posted a message, so no cleanup needed).

- [ ] **Step 4.1: Add cleanup to ACK timeout hard-stop path**

Locate this block in `queue-runner.ts` (the `!ack` timeout branch):

```typescript
if (!ack) {
  this.logEvent('error', 'dataset_hard_stop', {
    reason: 'ack_timeout',
    sourceMessageId,
    datasetFile: file.fileName,
    datasetItemId: record.item.id,
    datasetLineNumber: record.lineNumber,
    timeoutMs: this.config.timeoutMs,
  })
  await this.markRecordFailed(file.fileName, workingState, record, {
    errorCode: 'CALLBACK_TIMEOUT',
    errorMessage: `No internal delivery ACK was received for ${sourceMessageId}`,
  })
  await clearDeliveryAck(this.config.inputDir, sourceMessageId)
  process.exit(1)
}
```

Replace with (cleanup source message before exit):

```typescript
if (!ack) {
  this.logEvent('error', 'dataset_hard_stop', {
    reason: 'ack_timeout',
    sourceMessageId,
    datasetFile: file.fileName,
    datasetItemId: record.item.id,
    datasetLineNumber: record.lineNumber,
    timeoutMs: this.config.timeoutMs,
  })
  await this.markRecordFailed(file.fileName, workingState, record, {
    errorCode: 'CALLBACK_TIMEOUT',
    errorMessage: `No internal delivery ACK was received for ${sourceMessageId}`,
  })
  await clearDeliveryAck(this.config.inputDir, sourceMessageId)
  await cleanupMessages(
    {
      sourceRoomId: record.item.originalRoomId ?? this.config.defaultOriginalRoomId,
      sourceMessageId,
    },
    this.config.apiToken,
  )
  process.exit(1)
}
```

- [ ] **Step 4.2: Add cleanup to translation delivery failed hard-stop path**

Locate this block (the `ack.status === 'failed'` branch):

```typescript
if (ack.status === 'failed') {
  this.logEvent('error', 'dataset_hard_stop', {
    reason: 'translation_delivery_failed',
    sourceMessageId,
    datasetFile: file.fileName,
    datasetItemId: record.item.id,
    datasetLineNumber: record.lineNumber,
    errorCode: ack.errorCode,
    errorMessage: ack.errorMessage,
  })
  await this.markRecordFailed(file.fileName, workingState, record, {
    errorCode: ack.errorCode ?? 'CALLBACK_DELIVERY_FAILED',
    errorMessage: ack.errorMessage ?? 'Translator reported destination delivery failure',
  })
  await clearDeliveryAck(this.config.inputDir, sourceMessageId)
  process.exit(1)
}
```

Replace with (cleanup both source + destination before exit):

```typescript
if (ack.status === 'failed') {
  this.logEvent('error', 'dataset_hard_stop', {
    reason: 'translation_delivery_failed',
    sourceMessageId,
    datasetFile: file.fileName,
    datasetItemId: record.item.id,
    datasetLineNumber: record.lineNumber,
    errorCode: ack.errorCode,
    errorMessage: ack.errorMessage,
  })
  await this.markRecordFailed(file.fileName, workingState, record, {
    errorCode: ack.errorCode ?? 'CALLBACK_DELIVERY_FAILED',
    errorMessage: ack.errorMessage ?? 'Translator reported destination delivery failure',
  })
  await clearDeliveryAck(this.config.inputDir, sourceMessageId)
  await cleanupMessages(
    {
      sourceRoomId: record.item.originalRoomId ?? this.config.defaultOriginalRoomId,
      sourceMessageId,
      destRoomId: ack.destinationRoomId,
      destMessageId: ack.destinationMessageId,
    },
    this.config.apiToken,
  )
  process.exit(1)
}
```

- [ ] **Step 4.3: Typecheck**

```bash
bun run typecheck
```

Expected: no errors

- [ ] **Step 4.4: Run all dataset-runner tests**

```bash
bun test packages/dataset-runner/
```

Expected: all tests pass

- [ ] **Step 4.5: Commit**

```bash
git add packages/dataset-runner/src/services/queue-runner.ts
git commit -m "feat(dataset-runner): cleanup messages on hard-stop paths (timeout + delivery failed)"
```

---

## Chunk 3: Auto-shutdown + completion summary

**File:** `packages/dataset-runner/src/services/queue-runner.ts`

### Task 5: Add `processedFilesCount` counter and `printCompletionSummary`

- [ ] **Step 5.1: Add `processedFilesCount` before the `for (;;)` loop**

In `queue-runner.ts`, locate the start of the `run()` method's `for (;;)` loop. Just before it, add:

```typescript
let processedFilesCount = 0
```

The full context should look like:

```typescript
      // ... (after applyStartupReset)

      let processedFilesCount = 0

      for (;;) {
        if (this.shouldStop()) return
        // ...
```

- [ ] **Step 5.2: Increment counter after archiving each file**

Locate the archive block (after `rename(pendingPath, archivePath)` and the source-map cleanup loop):

```typescript
console.error(JSON.stringify({ level: 'info', event: 'file-archived', fileName: file.fileName }))
```

Add the increment immediately after that `console.error` line:

```typescript
console.error(JSON.stringify({ level: 'info', event: 'file-archived', fileName: file.fileName }))
processedFilesCount += 1
```

- [ ] **Step 5.3: Add auto-shutdown in the `files.length === 0` branch**

Locate:

```typescript
if (files.length === 0) {
  this.status.mode = 'idle'
  if (await this.sleepOrShutdown(2000)) return
  continue
}
```

Replace with:

```typescript
if (files.length === 0) {
  this.status.mode = 'idle'

  if (processedFilesCount > 0) {
    this.printCompletionSummary()
    process.exit(0)
  }

  if (await this.sleepOrShutdown(2000)) return
  continue
}
```

- [ ] **Step 5.4: Add `printCompletionSummary` private method to `QueueRunner` class**

Add this method to the `QueueRunner` class (before or after `shutdown()`):

```typescript
  private printCompletionSummary(): void {
    const total = this.status.completedCount + this.status.failedCount
    console.error(
      JSON.stringify({
        level: 'info',
        service: 'dataset-runner',
        event: 'dataset_run_complete',
        total,
        succeeded: this.status.completedCount,
        failed: this.status.failedCount,
        timestamp: new Date().toISOString(),
      }),
    )

    const colWidth = 18
    const valWidth = 10
    const line = `╠${'═'.repeat(colWidth)}╦${'═'.repeat(valWidth)}╣`
    const top  = `╔${'═'.repeat(colWidth)}╦${'═'.repeat(valWidth)}╗`
    const bot  = `╚${'═'.repeat(colWidth)}╩${'═'.repeat(valWidth)}╝`
    const row = (label: string, value: string | number): string => {
      const l = String(label).padEnd(colWidth - 1)
      const v = String(value).padEnd(valWidth - 1)
      return `║ ${l}║ ${v}║`
    }

    console.error(top)
    console.error(row('Dataset Run Done', ''))
    console.error(line)
    console.error(row('Total processed', total))
    console.error(row('Succeeded', this.status.completedCount))
    console.error(row('Failed', this.status.failedCount))
    console.error(bot)
    console.error('→ Messages cleaned up. Shutting down...')
  }
```

- [ ] **Step 5.5: Typecheck**

```bash
bun run typecheck
```

Expected: no errors

- [ ] **Step 5.6: Run all tests**

```bash
bun test packages/dataset-runner/
```

Expected: all tests pass

- [ ] **Step 5.7: Run lint**

```bash
bun run lint
```

Expected: no lint errors

- [ ] **Step 5.8: Commit**

```bash
git add packages/dataset-runner/src/services/queue-runner.ts
git commit -m "feat(dataset-runner): auto-shutdown with summary table when queue empties"
```

---

## Final Verification

- [ ] **Run full test + typecheck + lint suite**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: all pass (Definition of Done from spec)

- [ ] **Verify DoD checklist from spec**

All items in `docs/superpowers/specs/2026-03-12-dataset-runner-auto-cleanup-shutdown-design.md` Section 7 should be checkable:

- `message-cleaner.ts` exports `cleanupMessages` ✓
- `message-cleaner.test.ts` passes — 7 test cases covering success + error paths ✓
- `queue-runner.ts` calls cleanup after each item success path ✓
- `queue-runner.ts` calls cleanup before `process.exit(1)` on ACK timeout (source only) ✓
- `queue-runner.ts` calls cleanup before `process.exit(1)` on translation failed (source + dest) ✓
- `queue-runner.ts` does NOT call cleanup on send-retry-exhausted path ✓
- `queue-runner.ts` prints summary + `process.exit(0)` when queue empties ✓
- `bun test` passes ✓
- `bun run typecheck` passes ✓
- `bun run lint` passes ✓

> Manual smoke test (not automated): run `bun run dev:dataset` and verify messages are deleted from both rooms, the Docker stack shuts down automatically after all items process, and the CLI returns exit code `0`.
