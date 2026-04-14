# FIFO Queue Redesign — Dual Isolated Queues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `@chatwork-bot/message-queue` to use two isolated FIFO queues per source room (standard + free), each with its own processor and concurrency, dispatched in parallel via fan-out on every incoming webhook message.

**Architecture:** `TranslationQueue` maintains two separate `Map<roomId, RoomQueue>` instances — one for standard (OpenAI) and one for free (Kagi). When `enqueue(roomId, command, traceId)` is called, the message is fan-out enqueued into both queues simultaneously if configs exist. Each queue is fully isolated with its own FIFO ordering, concurrency semaphore, and backlog.

**Tech Stack:** Bun v1.1+, TypeScript 5.4+ strict, `bun:test`, in-memory queues (no file persistence on new queues), `@chatwork-bot/core` for `TranslationIngressCommand`.

---

## File Map

| Action  | File                                                   |
| ------- | ------------------------------------------------------ |
| Modify  | `packages/message-queue/src/types.ts`                  |
| Modify  | `packages/message-queue/src/room-queue.ts`             |
| Rewrite | `packages/message-queue/src/translation-queue.ts`      |
| Modify  | `packages/message-queue/src/index.ts`                  |
| Modify  | `packages/message-queue/src/room-queue.test.ts`        |
| Rewrite | `packages/message-queue/src/translation-queue.test.ts` |
| Modify  | `packages/translator/src/index.ts`                     |
| Modify  | `packages/translator/src/env-schema.ts`                |
| Modify  | `.env`                                                 |
| Modify  | `.env.example`                                         |
| Modify  | `docker-compose.yml`                                   |

---

## Task 1: Update `types.ts` — new type contract

**Files:**

- Modify: `packages/message-queue/src/types.ts`

Remove `ResolveConcurrency`, add `HasStandardConfig` + `HasFreeConfig`, update `QueueHealthSnapshot` to split `rooms` into `standardRooms` + `freeRooms`.

- [ ] **Step 1: Replace `types.ts` content**

```typescript
// packages/message-queue/src/types.ts
import type { TranslationIngressCommand } from '@chatwork-bot/core'

export interface QueueItem {
  /** UUID, unique per queue item */
  id: string
  /** Chatwork source room ID — used as directory name on disk */
  sourceRoomId: number
  /** Chatwork message ID */
  sourceMessageId: string
  /** Trace ID for observability correlation */
  traceId: string
  /** Full command payload (not modified) */
  command: TranslationIngressCommand
  /** ISO 8601 timestamp when item entered the queue */
  enqueuedAt: string
}

export type EnqueueResult =
  | { accepted: true }
  | { accepted: false; reason: 'QUEUE_FULL' | 'WRITE_ERROR' }

export interface QueueRoomSnapshot {
  roomId: number
  /** Items waiting in in-memory list (not yet picked up by consumer) */
  pending: number
  /** Items currently being processed by processor callback */
  active: number
}

export interface QueueHealthSnapshot {
  totalPending: number
  totalActive: number
  /** Standard (OpenAI) room queues */
  standardRooms: QueueRoomSnapshot[]
  /** Free (Kagi) room queues */
  freeRooms: QueueRoomSnapshot[]
}

/**
 * Callback that runs the actual translation work for one queue item.
 * Should not throw — errors should be handled internally.
 * Returning a rejected promise is treated as a failed item (logged, skipped).
 */
export type Processor = (
  command: TranslationIngressCommand,
  opts: { traceId: string },
) => Promise<void>

/**
 * Returns true if the given source room has a standard (API-based) translation config.
 * Called on every enqueue — kept in sync with the live config store.
 */
export type HasStandardConfig = (roomId: number) => boolean

/**
 * Returns true if the given source room has a free (Kagi-based) translation config.
 * Called on every enqueue — kept in sync with the live config store.
 */
export type HasFreeConfig = (roomId: number) => boolean
```

- [ ] **Step 2: Run typecheck — expect errors (downstream consumers reference removed types)**

```bash
cd packages/message-queue && bun run typecheck 2>&1 | head -30
```

Expected: Errors referencing `ResolveConcurrency` and `rooms` — this confirms we removed the right things. We'll fix them in subsequent tasks.

---

## Task 2: Update `room-queue.ts` — optional persistence

**Files:**

- Modify: `packages/message-queue/src/room-queue.ts`

Make `persistence: QueuePersistence | null`. When `null`, all file I/O is skipped (in-memory only). This is a backwards-compatible change.

- [ ] **Step 1: Write the failing test for null persistence**

Add this test to `packages/message-queue/src/room-queue.test.ts`, inside the `describe('RoomQueue', () => {` block, after all existing describe blocks:

```typescript
describe('in-memory mode (persistence: null)', () => {
  it('accepts and processes items without file I/O when persistence is null', async () => {
    const processed: string[] = []
    const processor: Processor = (command) => {
      processed.push(command.sourceMessageId)
      return Promise.resolve()
    }

    const queue = new RoomQueue({
      roomId: ROOM_ID,
      concurrency: 1,
      maxDepth: 10,
      persistence: null,
      processor,
    })

    const result = await queue.enqueue(makeItem({ id: 'im-1', sourceMessageId: 'msg-im-1' }))
    expect(result).toEqual({ accepted: true })

    await waitFor(() => processed.includes('msg-im-1'))
    expect(processed).toEqual(['msg-im-1'])
  })

  it('still enforces maxDepth without persistence', async () => {
    let holdRelease!: () => void
    const blocked = new Promise<void>((resolve) => {
      holdRelease = resolve
    })

    const queue = new RoomQueue({
      roomId: ROOM_ID,
      concurrency: 1,
      maxDepth: 1,
      persistence: null,
      processor: async () => {
        await blocked
      },
    })

    const r1 = await queue.enqueue(makeItem({ id: 'im-a', sourceMessageId: 'msg-a' }))
    expect(r1).toEqual({ accepted: true })

    const r2 = await queue.enqueue(makeItem({ id: 'im-b', sourceMessageId: 'msg-b' }))
    expect(r2).toEqual({ accepted: false, reason: 'QUEUE_FULL' })

    holdRelease()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/message-queue && bun test src/room-queue.test.ts 2>&1 | tail -15
```

Expected: TypeScript error — `persistence: null` is not assignable to `QueuePersistence`.

- [ ] **Step 3: Update `room-queue.ts` to accept `persistence: null`**

Replace the full content of `packages/message-queue/src/room-queue.ts`:

```typescript
// packages/message-queue/src/room-queue.ts
import type { QueuePersistence } from './queue-persistence'
import type { EnqueueResult, Processor, QueueItem, QueueRoomSnapshot } from './types'

interface RoomQueueOptions {
  roomId: number
  concurrency: number
  maxDepth: number
  persistence: QueuePersistence | null
  processor: Processor
}

export class RoomQueue {
  private readonly roomId: number
  private readonly concurrency: number
  private readonly maxDepth: number
  private readonly persistence: QueuePersistence | null
  private readonly processor: Processor

  /** In-memory ordered list — front = oldest = next to process */
  private items: QueueItem[] = []
  /** Number of items currently being processed by processor callback */
  private activeCount = 0
  /** pending + active — maintained synchronously to avoid TOCTOU race */
  private depth = 0
  /** True while consumer loop is running */
  private running = false

  constructor(options: RoomQueueOptions) {
    this.roomId = options.roomId
    this.concurrency = options.concurrency
    this.maxDepth = options.maxDepth
    this.persistence = options.persistence
    this.processor = options.processor
  }

  async enqueue(item: QueueItem): Promise<EnqueueResult> {
    // SYNCHRONOUS: check and increment before any await — prevents TOCTOU race
    if (this.depth >= this.maxDepth) {
      return { accepted: false, reason: 'QUEUE_FULL' }
    }
    this.depth++
    this.items.push(item)

    // ASYNC: persist to disk only if persistence is configured
    if (this.persistence !== null) {
      try {
        await this.persistence.writeItem(this.roomId, item)
      } catch {
        this.depth--
        // Remove by ID instead of assuming it's still at the end
        const idx = this.items.findIndex((i) => i.id === item.id)
        if (idx !== -1) {
          this.items.splice(idx, 1)
        }
        return { accepted: false, reason: 'WRITE_ERROR' }
      }
    }

    this.startConsumerIfNeeded()
    return { accepted: true }
  }

  size(): number {
    return this.items.length
  }

  isProcessing(): boolean {
    return this.activeCount > 0
  }

  getSnapshot(): QueueRoomSnapshot {
    return {
      roomId: this.roomId,
      pending: this.items.length,
      active: this.activeCount,
    }
  }

  private startConsumerIfNeeded(): void {
    if (!this.running) {
      this.runConsumer().catch((err: unknown) => {
        console.error(
          JSON.stringify({
            level: 'error',
            service: 'translator',
            event: 'queue_consumer_crashed',
            timestamp: new Date().toISOString(),
            sourceRoomId: this.roomId,
            errorMessage: err instanceof Error ? err.message : String(err),
          }),
        )
        this.running = false
      })
    }
  }

  private async runConsumer(): Promise<void> {
    this.running = true

    try {
      while (this.items.length > 0) {
        const available = this.concurrency - this.activeCount
        if (available <= 0) {
          // Wait for any item to complete
          await new Promise<void>((resolve) => {
            const checkInterval = setInterval(() => {
              if (this.activeCount < this.concurrency || this.items.length === 0) {
                clearInterval(checkInterval)
                resolve()
              }
            }, 10)
          })
          continue
        }

        const batch = this.items.splice(0, available)
        this.activeCount += batch.length

        // Fire off processing without waiting - activeCount will decrement in finally blocks
        for (const item of batch) {
          void this.processItem(item)
        }
        // After dispatching batch, loop continues immediately - picks up items added during processing
      }
    } finally {
      this.running = false
    }
  }

  private async processItem(item: QueueItem): Promise<void> {
    this.logEvent('queue_item_processing', item)

    const startMs = Date.now()

    try {
      await this.processor(item.command, { traceId: item.traceId })
      this.logEvent('queue_item_processed', item, { durationMs: Date.now() - startMs })
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'translator',
          event: 'queue_item_failed',
          timestamp: new Date().toISOString(),
          traceId: item.traceId,
          sourceRoomId: this.roomId,
          itemId: item.id,
          errorCode: error instanceof Error ? error.name : 'UnknownError',
          errorMessage: error instanceof Error ? error.message : String(error),
        }),
      )
    } finally {
      this.activeCount--
      this.depth--
      if (this.persistence !== null) {
        try {
          await this.persistence.removeItem(this.roomId, item)
        } catch {
          // Best effort — file may already be gone
        }
      }
    }
  }

  private logEvent(event: string, item: QueueItem, extra: Record<string, unknown> = {}): void {
    console.log(
      JSON.stringify({
        level: 'debug',
        service: 'translator',
        event,
        timestamp: new Date().toISOString(),
        traceId: item.traceId,
        sourceRoomId: this.roomId,
        itemId: item.id,
        ...extra,
      }),
    )
  }
}
```

- [ ] **Step 4: Run room-queue tests to verify all pass**

```bash
cd packages/message-queue && bun test src/room-queue.test.ts 2>&1 | tail -10
```

Expected:

```
 11 pass
 0 fail
```

- [ ] **Step 5: Commit**

```bash
git add packages/message-queue/src/types.ts packages/message-queue/src/room-queue.ts packages/message-queue/src/room-queue.test.ts
git commit -m "feat(message-queue): split QueueHealthSnapshot into standardRooms/freeRooms, add HasStandardConfig/HasFreeConfig types, make RoomQueue persistence optional"
```

---

## Task 3: Rewrite `translation-queue.ts` — dual queues + fan-out

**Files:**

- Rewrite: `packages/message-queue/src/translation-queue.ts`
- Rewrite: `packages/message-queue/src/translation-queue.test.ts`

This is the core change. The `TranslationQueue` now manages two independent `Map<roomId, RoomQueue>` instances. Fan-out happens in `enqueue()`.

- [ ] **Step 1: Rewrite `translation-queue.test.ts` with new dual-queue tests**

```typescript
// packages/message-queue/src/translation-queue.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { TranslationQueue } from './translation-queue'
import type { HasFreeConfig, HasStandardConfig, Processor } from './types'
import type { TranslationIngressCommand } from '@chatwork-bot/core'

function makeCommand(
  sourceRoomId = 424846369,
  sourceMessageId = 'msg-1',
): TranslationIngressCommand {
  return {
    sourceSystem: 'chatwork',
    sourceEventId: 'evt-1',
    sourceEventType: 'message',
    sourceMessageId,
    sourceRoomId,
    senderAccountId: 12345,
    rawBody: 'Hello',
    translatableText: 'Hello',
    translationInputs: ['Hello'],
    sendTime: Date.now(),
    updateTime: Date.now(),
    audit: { receivedAt: new Date().toISOString(), rawSourceSnapshot: {} },
  }
}

function makeNoopProcessor(): Processor {
  return async () => {}
}

/** Wait up to maxMs for condition to become true, polling every 20ms */
async function waitFor(condition: () => boolean, maxMs = 2000): Promise<void> {
  const deadline = Date.now() + maxMs
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('waitFor timeout')
    await new Promise((r) => setTimeout(r, 20))
  }
}

const STANDARD_ROOM = 424846369
const FREE_ROOM = 424846369 // same source room, different queue type
const STANDARD_ONLY_ROOM = 111111111
const FREE_ONLY_ROOM = 222222222

describe('TranslationQueue (dual-queue)', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'translation-queue-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  function makeQueue(
    overrides: {
      standardProcessor?: Processor
      freeProcessor?: Processor
      hasStandardConfig?: HasStandardConfig
      hasFreeConfig?: HasFreeConfig
      standardConcurrency?: number
      freeConcurrency?: number
      maxDepth?: number
    } = {},
  ) {
    return new TranslationQueue({
      dataDir: tmpDir,
      maxDepth: overrides.maxDepth ?? 10,
      standardConcurrency: overrides.standardConcurrency ?? 100,
      freeConcurrency: overrides.freeConcurrency ?? 1,
      standardProcessor: overrides.standardProcessor ?? makeNoopProcessor(),
      freeProcessor: overrides.freeProcessor ?? makeNoopProcessor(),
      hasStandardConfig: overrides.hasStandardConfig ?? (() => true),
      hasFreeConfig: overrides.hasFreeConfig ?? (() => false),
    })
  }

  describe('startup', () => {
    it('starts clean when no pending files exist', async () => {
      const queue = makeQueue()
      await queue.startup()
      const snapshot = queue.getSnapshot()
      expect(snapshot.totalPending).toBe(0)
      expect(snapshot.totalActive).toBe(0)
    })
  })

  describe('enqueue — fan-out', () => {
    it('returns { accepted: true } for standard-only room', async () => {
      const queue = makeQueue({
        hasStandardConfig: (id) => id === STANDARD_ONLY_ROOM,
        hasFreeConfig: () => false,
      })
      await queue.startup()
      const result = await queue.enqueue(
        STANDARD_ONLY_ROOM,
        makeCommand(STANDARD_ONLY_ROOM, 'msg-1'),
        'trace-1',
      )
      expect(result).toEqual({ accepted: true })
    })

    it('returns { accepted: true } for free-only room', async () => {
      const queue = makeQueue({
        hasStandardConfig: () => false,
        hasFreeConfig: (id) => id === FREE_ONLY_ROOM,
      })
      await queue.startup()
      const result = await queue.enqueue(
        FREE_ONLY_ROOM,
        makeCommand(FREE_ONLY_ROOM, 'msg-1'),
        'trace-1',
      )
      expect(result).toEqual({ accepted: true })
    })

    it('dispatches to BOTH standard and free processors for a dual-config room', async () => {
      const standardProcessed: string[] = []
      const freeProcessed: string[] = []

      const queue = makeQueue({
        hasStandardConfig: () => true,
        hasFreeConfig: () => true,
        standardProcessor: async (command) => {
          standardProcessed.push(command.sourceMessageId)
        },
        freeProcessor: async (command) => {
          freeProcessed.push(command.sourceMessageId)
        },
      })
      await queue.startup()

      await queue.enqueue(STANDARD_ROOM, makeCommand(STANDARD_ROOM, 'msg-fanout'), 'trace-fanout')

      await waitFor(
        () => standardProcessed.includes('msg-fanout') && freeProcessed.includes('msg-fanout'),
      )

      expect(standardProcessed).toContain('msg-fanout')
      expect(freeProcessed).toContain('msg-fanout')
    })

    it('dispatches to standard only when room has no free config', async () => {
      const standardProcessed: string[] = []
      const freeProcessed: string[] = []

      const queue = makeQueue({
        hasStandardConfig: () => true,
        hasFreeConfig: () => false,
        standardProcessor: async (command) => {
          standardProcessed.push(command.sourceMessageId)
        },
        freeProcessor: async (command) => {
          freeProcessed.push(command.sourceMessageId)
        },
      })
      await queue.startup()

      await queue.enqueue(STANDARD_ROOM, makeCommand(STANDARD_ROOM, 'msg-std-only'), 'trace-1')

      await waitFor(() => standardProcessed.includes('msg-std-only'))
      // Give freeProcessor a chance to be called (it shouldn't be)
      await new Promise((r) => setTimeout(r, 50))

      expect(standardProcessed).toContain('msg-std-only')
      expect(freeProcessed).toHaveLength(0)
    })

    it('dispatches to free only when room has no standard config', async () => {
      const standardProcessed: string[] = []
      const freeProcessed: string[] = []

      const queue = makeQueue({
        hasStandardConfig: () => false,
        hasFreeConfig: () => true,
        standardProcessor: async (command) => {
          standardProcessed.push(command.sourceMessageId)
        },
        freeProcessor: async (command) => {
          freeProcessed.push(command.sourceMessageId)
        },
      })
      await queue.startup()

      await queue.enqueue(FREE_ONLY_ROOM, makeCommand(FREE_ONLY_ROOM, 'msg-free-only'), 'trace-1')

      await waitFor(() => freeProcessed.includes('msg-free-only'))
      await new Promise((r) => setTimeout(r, 50))

      expect(freeProcessed).toContain('msg-free-only')
      expect(standardProcessed).toHaveLength(0)
    })

    it('returns { accepted: false, reason: QUEUE_FULL } when backlog is full', async () => {
      let holdRelease!: () => void
      const barrier = new Promise<void>((resolve) => {
        holdRelease = resolve
      })

      const queue = makeQueue({
        hasStandardConfig: () => true,
        hasFreeConfig: () => false,
        standardProcessor: async () => {
          await barrier
        },
        maxDepth: 1,
      })
      await queue.startup()

      const r1 = await queue.enqueue(STANDARD_ROOM, makeCommand(STANDARD_ROOM, 'msg-1'), 'trace-1')
      expect(r1).toEqual({ accepted: true })

      const r2 = await queue.enqueue(STANDARD_ROOM, makeCommand(STANDARD_ROOM, 'msg-2'), 'trace-2')
      expect(r2).toEqual({ accepted: false, reason: 'QUEUE_FULL' })

      holdRelease()
    })

    it('returns { accepted: false } after shutdown', async () => {
      const queue = makeQueue()
      await queue.startup()
      await queue.shutdown()

      const result = await queue.enqueue(STANDARD_ROOM, makeCommand(), 'trace-1')
      expect(result).toEqual({ accepted: false, reason: 'QUEUE_FULL' })
    })
  })

  describe('isolation — standard and free process independently', () => {
    it('standard processor completes without waiting for free processor', async () => {
      const completionOrder: string[] = []
      let freeRelease!: () => void
      const freeBarrier = new Promise<void>((resolve) => {
        freeRelease = resolve
      })

      const queue = makeQueue({
        hasStandardConfig: () => true,
        hasFreeConfig: () => true,
        standardProcessor: async () => {
          completionOrder.push('standard')
        },
        freeProcessor: async () => {
          await freeBarrier
          completionOrder.push('free')
        },
      })
      await queue.startup()

      await queue.enqueue(STANDARD_ROOM, makeCommand(STANDARD_ROOM, 'msg-iso'), 'trace-iso')

      await waitFor(() => completionOrder.includes('standard'))

      // Standard completed — free is still blocked
      expect(completionOrder).toEqual(['standard'])

      freeRelease()
      await waitFor(() => completionOrder.includes('free'))
      expect(completionOrder).toEqual(['standard', 'free'])
    })
  })

  describe('FIFO ordering within each queue', () => {
    it('standard queue processes messages in enqueue order', async () => {
      const processed: string[] = []

      const queue = makeQueue({
        hasStandardConfig: () => true,
        hasFreeConfig: () => false,
        standardConcurrency: 1,
        standardProcessor: async (command) => {
          processed.push(command.sourceMessageId)
        },
      })
      await queue.startup()

      await queue.enqueue(STANDARD_ROOM, makeCommand(STANDARD_ROOM, 'msg-1'), 'trace-1')
      await queue.enqueue(STANDARD_ROOM, makeCommand(STANDARD_ROOM, 'msg-2'), 'trace-2')
      await queue.enqueue(STANDARD_ROOM, makeCommand(STANDARD_ROOM, 'msg-3'), 'trace-3')

      await waitFor(() => processed.length === 3)
      expect(processed).toEqual(['msg-1', 'msg-2', 'msg-3'])
    })

    it('free queue processes messages in enqueue order (concurrency=1)', async () => {
      const processed: string[] = []

      const queue = makeQueue({
        hasStandardConfig: () => false,
        hasFreeConfig: () => true,
        freeConcurrency: 1,
        freeProcessor: async (command) => {
          processed.push(command.sourceMessageId)
        },
      })
      await queue.startup()

      await queue.enqueue(FREE_ONLY_ROOM, makeCommand(FREE_ONLY_ROOM, 'free-1'), 'trace-1')
      await queue.enqueue(FREE_ONLY_ROOM, makeCommand(FREE_ONLY_ROOM, 'free-2'), 'trace-2')
      await queue.enqueue(FREE_ONLY_ROOM, makeCommand(FREE_ONLY_ROOM, 'free-3'), 'trace-3')

      await waitFor(() => processed.length === 3)
      expect(processed).toEqual(['free-1', 'free-2', 'free-3'])
    })
  })

  describe('getSnapshot', () => {
    it('returns standardRooms and freeRooms separately', async () => {
      let holdRelease!: () => void
      const barrier = new Promise<void>((resolve) => {
        holdRelease = resolve
      })

      const queue = makeQueue({
        hasStandardConfig: () => true,
        hasFreeConfig: () => true,
        standardProcessor: async () => {
          await barrier
        },
        freeProcessor: async () => {
          await barrier
        },
      })
      await queue.startup()

      await queue.enqueue(STANDARD_ROOM, makeCommand(STANDARD_ROOM, 'msg-snap'), 'trace-snap')

      await waitFor(() => queue.getSnapshot().totalActive >= 2)

      const snapshot = queue.getSnapshot()
      expect(snapshot.standardRooms).toHaveLength(1)
      expect(snapshot.freeRooms).toHaveLength(1)
      expect(snapshot.standardRooms[0]?.roomId).toBe(STANDARD_ROOM)
      expect(snapshot.freeRooms[0]?.roomId).toBe(STANDARD_ROOM)
      expect(snapshot.totalActive).toBe(2) // one active in each queue

      holdRelease()
    })

    it('counts totals across all rooms and both queue types', async () => {
      let holdRelease!: () => void
      const barrier = new Promise<void>((resolve) => {
        holdRelease = resolve
      })

      const queue = makeQueue({
        hasStandardConfig: () => true,
        hasFreeConfig: () => false,
        standardProcessor: async () => {
          await barrier
        },
      })
      await queue.startup()

      await queue.enqueue(STANDARD_ONLY_ROOM, makeCommand(STANDARD_ONLY_ROOM, 'msg-a'), 'trace-a')
      await queue.enqueue(111111112, makeCommand(111111112, 'msg-b'), 'trace-b')

      await waitFor(() => queue.getSnapshot().totalActive >= 1)

      const snapshot = queue.getSnapshot()
      expect(snapshot.totalActive + snapshot.totalPending).toBe(2)

      holdRelease()
    })
  })

  describe('shutdown', () => {
    it('waits for all active processing (standard + free) to complete', async () => {
      const completed: string[] = []
      let standardRelease!: () => void
      let freeRelease!: () => void
      const sBarrier = new Promise<void>((resolve) => {
        standardRelease = resolve
      })
      const fBarrier = new Promise<void>((resolve) => {
        freeRelease = resolve
      })

      const queue = makeQueue({
        hasStandardConfig: () => true,
        hasFreeConfig: () => true,
        standardProcessor: async (command) => {
          await sBarrier
          completed.push(`std:${command.sourceMessageId}`)
        },
        freeProcessor: async (command) => {
          await fBarrier
          completed.push(`free:${command.sourceMessageId}`)
        },
      })
      await queue.startup()

      await queue.enqueue(STANDARD_ROOM, makeCommand(STANDARD_ROOM, 'msg-shutdown'), 'trace-sd')

      const shutdownPromise = queue.shutdown()

      standardRelease()
      freeRelease()

      await shutdownPromise

      expect(completed).toContain('std:msg-shutdown')
      expect(completed).toContain('free:msg-shutdown')
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd packages/message-queue && bun test src/translation-queue.test.ts 2>&1 | tail -20
```

Expected: Multiple TypeScript errors — `TranslationQueueOptions` doesn't match new interface yet.

- [ ] **Step 3: Rewrite `translation-queue.ts` with dual-queue implementation**

```typescript
// packages/message-queue/src/translation-queue.ts
import { QueuePersistence } from './queue-persistence'
import { RoomQueue } from './room-queue'
import type {
  EnqueueResult,
  HasFreeConfig,
  HasStandardConfig,
  Processor,
  QueueHealthSnapshot,
} from './types'
import type { TranslationIngressCommand } from '@chatwork-bot/core'

interface TranslationQueueOptions {
  /** Base directory for queue file persistence (used only for startup archive check) */
  dataDir: string
  /** Maximum total items (pending + active) per room per queue type before rejecting */
  maxDepth: number
  /** Max concurrent standard (OpenAI) translations per source room */
  standardConcurrency: number
  /** Max concurrent free (Kagi) translations per source room */
  freeConcurrency: number
  /** Processor for standard translations */
  standardProcessor: Processor
  /** Processor for free translations */
  freeProcessor: Processor
  /** Returns true if the source room has a standard translation config */
  hasStandardConfig: HasStandardConfig
  /** Returns true if the source room has a free translation config */
  hasFreeConfig: HasFreeConfig
}

export class TranslationQueue {
  private readonly persistence: QueuePersistence
  private readonly maxDepth: number
  private readonly standardConcurrency: number
  private readonly freeConcurrency: number
  private readonly standardProcessor: Processor
  private readonly freeProcessor: Processor
  private readonly hasStandardConfig: HasStandardConfig
  private readonly hasFreeConfig: HasFreeConfig

  /** Standard (OpenAI) room queues — one per source roomId */
  private readonly standardRooms = new Map<number, RoomQueue>()
  /** Free (Kagi) room queues — one per source roomId */
  private readonly freeRooms = new Map<number, RoomQueue>()

  private accepting = true

  constructor(options: TranslationQueueOptions) {
    this.persistence = new QueuePersistence({ baseDir: options.dataDir })
    this.maxDepth = options.maxDepth
    this.standardConcurrency = options.standardConcurrency
    this.freeConcurrency = options.freeConcurrency
    this.standardProcessor = options.standardProcessor
    this.freeProcessor = options.freeProcessor
    this.hasStandardConfig = options.hasStandardConfig
    this.hasFreeConfig = options.hasFreeConfig
  }

  /** Archive any pending files from a previous process session. Call before accepting messages. */
  async startup(): Promise<void> {
    try {
      const pendingCount = await this.countPendingFiles()
      await this.persistence.archiveAll()

      if (pendingCount > 0) {
        console.log(
          JSON.stringify({
            level: 'info',
            service: 'translator',
            event: 'queue_archived_on_startup',
            timestamp: new Date().toISOString(),
            archivedCount: pendingCount,
          }),
        )
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'translator',
          event: 'queue_startup_failed',
          timestamp: new Date().toISOString(),
          errorMessage: error instanceof Error ? error.message : String(error),
        }),
      )
      // Continue with empty queue — prioritize availability over preserving old messages
    }
  }

  /**
   * Fan-out enqueue: dispatches the command to the standard queue, the free queue,
   * or both, depending on which configs exist for the source room.
   *
   * Returns immediately — never blocks on translation.
   * Returns { accepted: true } if at least one queue accepted the item.
   * Returns { accepted: false, reason: 'QUEUE_FULL' } only if ALL applicable queues rejected.
   */
  async enqueue(
    roomId: number,
    command: TranslationIngressCommand,
    traceId: string,
  ): Promise<EnqueueResult> {
    if (!this.accepting) {
      return { accepted: false, reason: 'QUEUE_FULL' }
    }

    const item = {
      id: crypto.randomUUID(),
      sourceRoomId: roomId,
      sourceMessageId: command.sourceMessageId,
      traceId,
      command,
      enqueuedAt: new Date().toISOString(),
    }

    let anyAccepted = false
    let lastRejectedReason: 'QUEUE_FULL' | 'WRITE_ERROR' = 'QUEUE_FULL'

    if (this.hasStandardConfig(roomId)) {
      const queue = this.getOrCreateStandardQueue(roomId)
      const result = await queue.enqueue({ ...item, id: crypto.randomUUID() })

      if (result.accepted) {
        anyAccepted = true
        this.logEnqueued(roomId, item.id, traceId, 'standard', queue.size())
      } else {
        lastRejectedReason = result.reason
        this.logRejected(roomId, traceId, result.reason, 'standard')
      }
    }

    if (this.hasFreeConfig(roomId)) {
      const queue = this.getOrCreateFreeQueue(roomId)
      const result = await queue.enqueue({ ...item, id: crypto.randomUUID() })

      if (result.accepted) {
        anyAccepted = true
        this.logEnqueued(roomId, item.id, traceId, 'free', queue.size())
      } else {
        lastRejectedReason = result.reason
        this.logRejected(roomId, traceId, result.reason, 'free')
      }
    }

    if (!anyAccepted) {
      return { accepted: false, reason: lastRejectedReason }
    }

    console.log(
      JSON.stringify({
        level: 'info',
        service: 'translator',
        event: 'queue_item_enqueued',
        timestamp: new Date().toISOString(),
        traceId,
        sourceRoomId: roomId,
        sourceMessageId: command.sourceMessageId,
      }),
    )

    return { accepted: true }
  }

  /**
   * Graceful shutdown: stop accepting new items, wait up to 30s for active processing.
   * Docker stop_grace_period: 35s gives 5s buffer after this resolves.
   */
  async shutdown(): Promise<void> {
    this.accepting = false

    console.log(
      JSON.stringify({
        level: 'info',
        service: 'translator',
        event: 'queue_shutdown_initiated',
        timestamp: new Date().toISOString(),
      }),
    )

    const SHUTDOWN_TIMEOUT_MS = 30_000
    const POLL_INTERVAL_MS = 100
    const deadline = Date.now() + SHUTDOWN_TIMEOUT_MS

    while (Date.now() < deadline) {
      const snapshot = this.getSnapshot()
      if (snapshot.totalActive === 0 && snapshot.totalPending === 0) {
        console.log(
          JSON.stringify({
            level: 'info',
            service: 'translator',
            event: 'queue_shutdown_clean',
            timestamp: new Date().toISOString(),
          }),
        )
        return
      }
      await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    }

    // Timeout reached — log abandoned messages
    const finalSnapshot = this.getSnapshot()
    if (finalSnapshot.totalActive > 0 || finalSnapshot.totalPending > 0) {
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'translator',
          event: 'queue_shutdown_timeout',
          timestamp: new Date().toISOString(),
          abandonedActive: finalSnapshot.totalActive,
          abandonedPending: finalSnapshot.totalPending,
          standardRooms: finalSnapshot.standardRooms,
          freeRooms: finalSnapshot.freeRooms,
        }),
      )
    }
  }

  getSnapshot(): QueueHealthSnapshot {
    const standardRooms = Array.from(this.standardRooms.values()).map((rq) => rq.getSnapshot())
    const freeRooms = Array.from(this.freeRooms.values()).map((rq) => rq.getSnapshot())
    const allRooms = [...standardRooms, ...freeRooms]
    return {
      totalPending: allRooms.reduce((sum, r) => sum + r.pending, 0),
      totalActive: allRooms.reduce((sum, r) => sum + r.active, 0),
      standardRooms,
      freeRooms,
    }
  }

  private getOrCreateStandardQueue(roomId: number): RoomQueue {
    const existing = this.standardRooms.get(roomId)
    if (existing !== undefined) return existing

    const queue = new RoomQueue({
      roomId,
      concurrency: this.standardConcurrency,
      maxDepth: this.maxDepth,
      persistence: null,
      processor: this.standardProcessor,
    })
    this.standardRooms.set(roomId, queue)
    this.logQueueCreated(roomId, 'standard', this.standardConcurrency)
    return queue
  }

  private getOrCreateFreeQueue(roomId: number): RoomQueue {
    const existing = this.freeRooms.get(roomId)
    if (existing !== undefined) return existing

    const queue = new RoomQueue({
      roomId,
      concurrency: this.freeConcurrency,
      maxDepth: this.maxDepth,
      persistence: null,
      processor: this.freeProcessor,
    })
    this.freeRooms.set(roomId, queue)
    this.logQueueCreated(roomId, 'free', this.freeConcurrency)
    return queue
  }

  private logQueueCreated(
    roomId: number,
    queueType: 'standard' | 'free',
    concurrency: number,
  ): void {
    console.log(
      JSON.stringify({
        level: 'debug',
        service: 'translator',
        event: 'queue_consumer_started',
        timestamp: new Date().toISOString(),
        sourceRoomId: roomId,
        queueType,
        concurrency,
      }),
    )
  }

  private logEnqueued(
    roomId: number,
    itemId: string,
    traceId: string,
    queueType: 'standard' | 'free',
    depth: number,
  ): void {
    console.log(
      JSON.stringify({
        level: 'info',
        service: 'translator',
        event: 'queue_item_enqueued_to_lane',
        timestamp: new Date().toISOString(),
        traceId,
        sourceRoomId: roomId,
        itemId,
        queueType,
        queueDepth: depth,
      }),
    )
  }

  private logRejected(
    roomId: number,
    traceId: string,
    reason: string,
    queueType: 'standard' | 'free',
  ): void {
    console.warn(
      JSON.stringify({
        level: 'warn',
        service: 'translator',
        event: 'queue_item_rejected',
        timestamp: new Date().toISOString(),
        traceId,
        sourceRoomId: roomId,
        queueType,
        reason,
      }),
    )
  }

  private async countPendingFiles(): Promise<number> {
    const roomIds = await this.persistence.listRoomDirs()
    let total = 0
    for (const roomId of roomIds) {
      const items = await this.persistence.readPendingItems(roomId)
      total += items.length
    }
    return total
  }
}
```

- [ ] **Step 4: Run translation-queue tests to verify they pass**

```bash
cd packages/message-queue && bun test src/translation-queue.test.ts 2>&1 | tail -15
```

Expected:

```
 XX pass
 0 fail
```

- [ ] **Step 5: Run all message-queue tests**

```bash
cd packages/message-queue && bun test 2>&1 | tail -10
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add packages/message-queue/src/translation-queue.ts packages/message-queue/src/translation-queue.test.ts
git commit -m "feat(message-queue): redesign TranslationQueue with dual isolated queues and fan-out dispatch"
```

---

## Task 4: Update `index.ts` exports

**Files:**

- Modify: `packages/message-queue/src/index.ts`

Remove `ResolveConcurrency`, export the two new config callback types.

- [ ] **Step 1: Update `index.ts`**

Replace the full content of `packages/message-queue/src/index.ts`:

```typescript
// packages/message-queue/src/index.ts
export { TranslationQueue } from './translation-queue'
export type {
  EnqueueResult,
  QueueHealthSnapshot,
  QueueItem,
  QueueRoomSnapshot,
  Processor,
  HasStandardConfig,
  HasFreeConfig,
} from './types'
```

- [ ] **Step 2: Run typecheck for the package**

```bash
cd packages/message-queue && bun run typecheck 2>&1 | tail -10
```

Expected: `Done` with no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/message-queue/src/index.ts
git commit -m "feat(message-queue): update exports — remove ResolveConcurrency, add HasStandardConfig/HasFreeConfig"
```

---

## Task 5: Update `translator/src/index.ts` — wire dual-queue to real handlers

**Files:**

- Modify: `packages/translator/src/index.ts`

Replace the `TranslationQueue` instantiation to use `standardProcessor`, `freeProcessor`, `hasStandardConfig`, `hasFreeConfig`, `standardConcurrency`, `freeConcurrency`.

- [ ] **Step 1: Update the `TranslationQueue` block in `packages/translator/src/index.ts`**

Find the block:

```typescript
// Initialize FIFO message queue
const queue = new TranslationQueue({
  dataDir: join(env.ROOM_CONFIG_DATA_DIR, 'queue'),
  maxDepth: env.QUEUE_MAX_DEPTH_PER_ROOM,
  processor: async (command, opts) => {
    await Promise.allSettled([
      handleTranslateRequest(command, opts),
      handleFreeTranslateRequest(command, opts),
    ])
  },
  resolveConcurrency: (roomId) => {
    // Free check FIRST: Kagi runs browser automation — strictly 1 translation at a time.
    // Any source room with a free config must use concurrency=1 to prevent Kagi backpressure,
    // regardless of whether a standard config also exists for the same room.
    // Standard-only rooms get full concurrency for maximum throughput.
    if (freeStore.getByOriginalRoomId(roomId) !== null) return env.QUEUE_FREE_CONCURRENCY
    if (store.getByOriginalRoomId(roomId) !== null) return env.QUEUE_STANDARD_CONCURRENCY
    return env.QUEUE_STANDARD_CONCURRENCY
  },
})
```

Replace with:

```typescript
// Initialize FIFO message queue — dual isolated queues (standard + free) per source room.
// Fan-out: each incoming message is independently enqueued into both queues (if configs exist).
// Standard queue: parallel OpenAI API calls up to standardConcurrency.
// Free queue: Kagi browser automation — freeConcurrency must not exceed KAGI_MAX_QUEUE_DEPTH.
const queue = new TranslationQueue({
  dataDir: join(env.ROOM_CONFIG_DATA_DIR, 'queue'),
  maxDepth: env.QUEUE_MAX_DEPTH_PER_ROOM,
  standardConcurrency: env.QUEUE_STANDARD_CONCURRENCY,
  freeConcurrency: env.QUEUE_FREE_CONCURRENCY,
  standardProcessor: async (command, opts) => {
    await handleTranslateRequest(command, opts)
  },
  freeProcessor: async (command, opts) => {
    await handleFreeTranslateRequest(command, opts)
  },
  hasStandardConfig: (roomId) => store.getByOriginalRoomId(roomId) !== null,
  hasFreeConfig: (roomId) => freeStore.getByOriginalRoomId(roomId) !== null,
})
```

- [ ] **Step 2: Run typecheck for translator package**

```bash
cd packages/translator && bun run typecheck 2>&1 | tail -10
```

Expected: `Done` with no errors.

- [ ] **Step 3: Run all tests**

```bash
bun test packages --pass-with-no-tests 2>&1 | tail -10
```

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add packages/translator/src/index.ts
git commit -m "feat(translator): wire dual-queue — separate standard/free processors with independent concurrency"
```

---

## Task 6: Update env defaults — `env-schema.ts`, `.env`, `.env.example`, `docker-compose.yml`

**Files:**

- Modify: `packages/translator/src/env-schema.ts`
- Modify: `.env`
- Modify: `.env.example`
- Modify: `docker-compose.yml`

Update concurrency defaults: `QUEUE_STANDARD_CONCURRENCY` 1000→100, `QUEUE_FREE_CONCURRENCY` 1→10.

**Why 10 for free:** Kagi sidecar has `KAGI_MAX_QUEUE_DEPTH=10`. Setting `freeConcurrency` above this causes the excess requests to wait 15s and fail (backpressure). Matching it to 10 ensures all dispatched messages are accepted by Kagi.

- [ ] **Step 1: Update `env-schema.ts` defaults**

In `packages/translator/src/env-schema.ts`, find:

```typescript
  QUEUE_STANDARD_CONCURRENCY: z.coerce.number().int().positive().default(1_000),
  QUEUE_FREE_CONCURRENCY: z.coerce.number().int().positive().default(1),
```

Replace with:

```typescript
  QUEUE_STANDARD_CONCURRENCY: z.coerce.number().int().positive().default(100),
  QUEUE_FREE_CONCURRENCY: z.coerce.number().int().positive().default(10),
```

- [ ] **Step 2: Update `.env`**

Find and replace:

```
QUEUE_STANDARD_CONCURRENCY=1000
QUEUE_FREE_CONCURRENCY=1
```

With:

```
QUEUE_STANDARD_CONCURRENCY=100
QUEUE_FREE_CONCURRENCY=10
```

- [ ] **Step 3: Update `.env.example`**

Find in the `# === FIFO Message Queue ===` section:

```
QUEUE_STANDARD_CONCURRENCY=1000
QUEUE_FREE_CONCURRENCY=1
```

Replace with:

```
QUEUE_STANDARD_CONCURRENCY=100
QUEUE_FREE_CONCURRENCY=10
```

Also update the comments to reflect the new semantics:

```
# === FIFO Message Queue ===
# Standard rooms: up to 100 concurrent OpenAI translations per source room.
# Free rooms: up to 10 concurrent dispatches to the Kagi sidecar per source room.
#   IMPORTANT: QUEUE_FREE_CONCURRENCY must not exceed KAGI_MAX_QUEUE_DEPTH (default 10).
#   Exceeding Kagi's internal queue depth causes requests to wait 15s and fail (backpressure).
# If a source room has both standard and free configs, each uses its own concurrency limit.
# Messages beyond maxDepth per room are rejected (backpressure signal to the caller).
QUEUE_MAX_DEPTH_PER_ROOM=1000
QUEUE_STANDARD_CONCURRENCY=100
QUEUE_FREE_CONCURRENCY=10
```

- [ ] **Step 4: Update `docker-compose.yml`**

Find the `QUEUE_STANDARD_CONCURRENCY` and `QUEUE_FREE_CONCURRENCY` lines in `docker-compose.yml`. They use `${VAR:-default}` syntax. Update the defaults:

```yaml
QUEUE_STANDARD_CONCURRENCY: ${QUEUE_STANDARD_CONCURRENCY:-100}
QUEUE_FREE_CONCURRENCY: ${QUEUE_FREE_CONCURRENCY:-10}
```

(Search for `:-1000` and `:-1` respectively to find the right lines.)

- [ ] **Step 5: Run typecheck to verify env schema compiles**

```bash
cd packages/translator && bun run typecheck 2>&1 | tail -5
```

Expected: `Done`.

- [ ] **Step 6: Commit**

```bash
git add packages/translator/src/env-schema.ts .env .env.example docker-compose.yml
git commit -m "feat(translator): update queue concurrency defaults — standard=100, free=10 (matches KAGI_MAX_QUEUE_DEPTH)"
```

---

## Task 7: Full regression check

- [ ] **Step 1: Run full test suite**

```bash
bun test packages scripts --pass-with-no-tests 2>&1 | tail -10
```

Expected:

```
 NNN pass
 0 fail
```

- [ ] **Step 2: Run typecheck across all packages**

```bash
bun run typecheck 2>&1 | tail -15
```

Expected: All packages `Done` with no errors.

- [ ] **Step 3: Run lint**

```bash
bun run lint 2>&1 | tail -10
```

Expected: No errors.

- [ ] **Step 4: Final commit (if any leftover changes)**

```bash
git status
# If clean, nothing to do. If dirty, commit remaining changes:
git add -A
git commit -m "chore(repo): post-queue-redesign cleanup"
```

---

## Verification Checklist (Manual)

After all tasks complete, verify the 5 gold criteria hold in a live run (`bun run dev`):

| Criterion             | Verification                                                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1: Max 2 destinations | Send a message to a room with both standard + free config → check logs show 2 `queue_item_enqueued_to_lane` events (one `queueType: standard`, one `queueType: free`) |
| 2: Simultaneous       | Check logs — `queue_item_processing` for standard and free appear at nearly the same timestamp                                                                        |
| 3: Rate limit 100     | Send 101 messages to a standard room with `maxDepth=100` → 101st is rejected with `QUEUE_FULL`                                                                        |
| 4: FIFO ordering      | Send 5 messages to a free room (concurrency=1) → delivery order in destination room matches send order                                                                |
| 5: Isolation          | Block the free processor (e.g., Kagi down) → standard translations complete normally; standard room receives translations while free room waits                       |
