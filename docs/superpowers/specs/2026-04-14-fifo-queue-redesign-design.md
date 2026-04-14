# FIFO Queue Redesign — Dual Isolated Queues per Source Room

**Date:** 2026-04-14  
**Status:** Approved  
**Context:** The current single-queue-per-source-room design cannot satisfy the 5 gold business logic criteria. A complete redesign of `@chatwork-bot/message-queue` is required.

---

## Problem Statement

The current architecture uses one `RoomQueue` per source room with a single processor that calls `Promise.allSettled([handleTranslateRequest, handleFreeTranslateRequest])`. This design has a fundamental flaw: it forces both standard and free translations through the same queue, making true isolation impossible. The `resolveConcurrency` callback tries to resolve this by picking ONE concurrency value for the shared queue, creating a trade-off between Kagi backpressure and standard throughput.

---

## 5 Gold Business Logic Criteria

| #   | Criterion                        | Requirement                                                                    |
| --- | -------------------------------- | ------------------------------------------------------------------------------ |
| 1   | Max destinations per source room | 1 standard + 1 free (2 total)                                                  |
| 2   | Simultaneous processing          | Standard and free MUST process the same message concurrently and independently |
| 3   | Rate limit                       | Max 100 concurrent per-queue; backlog up to 1000; reject when backlog full     |
| 4   | FIFO ordering                    | First message in = first processed; message length is irrelevant               |
| 5   | Queue isolation                  | Standard and free finish independently; each maintains internal FIFO order     |

---

## Architecture

### High-Level Flow

```
Webhook → POST /internal/translate
           ↓
    TranslationQueue.enqueue(roomId, command, traceId)
           ↓
    [Fan-out Dispatcher]
    hasStandardConfig(roomId)?  hasFreeConfig(roomId)?
           ↓                           ↓
  StandardQueue[roomId]         FreeQueue[roomId]
  [concurrency=100, FIFO]       [concurrency=1*, FIFO]
           ↓                           ↓
  handleTranslateRequest   handleFreeTranslateRequest
           ↓                           ↓
       OpenAI API                 Kagi sidecar
           ↓                           ↓
    Standard room              Free room
    (fast, ~2–5s)              (slow, ~70s)
```

\*See Kagi Concurrency Constraint below.

### Key Properties

- **Two separate `RoomQueue` instances per source room**: `standardQueues: Map<roomId, RoomQueue>` and `freeQueues: Map<roomId, RoomQueue>`
- **Fan-out on enqueue**: a single webhook triggers enqueue into both queues simultaneously (if both configs exist)
- **Fully isolated**: each queue has its own processor, concurrency, and backlog — they share no state
- **FIFO guaranteed within each queue**: `RoomQueue` processes items in insertion order, regardless of message length

---

## Kagi Concurrency Constraint

> **Critical trade-off that must be understood before setting `QUEUE_FREE_CONCURRENCY`.**

The Kagi sidecar processes **1 translation at a time** (browser automation) with an internal queue of `KAGI_MAX_QUEUE_DEPTH=10`. If `FreeQueue` dispatches more than 10 concurrent requests, the excess requests receive a `queue wait exceeded` error (the backpressure bug observed in session debugging where 5/6 messages failed).

Therefore:

| Config                       | Value | Reason                                                                  |
| ---------------------------- | ----- | ----------------------------------------------------------------------- |
| `QUEUE_STANDARD_CONCURRENCY` | 100   | OpenAI API supports true parallelism                                    |
| `QUEUE_FREE_CONCURRENCY`     | 10    | Must not exceed `KAGI_MAX_QUEUE_DEPTH` to prevent backpressure failures |

The user's intent of "shared config" is satisfied by using the same conceptual cap (100 for standard), while free is bounded by the physical constraint of Kagi's sidecar. Setting `QUEUE_FREE_CONCURRENCY=100` would cause ~90 of every 100 free messages to fail with timeout errors. Setting it to 10 ensures all accepted messages are eventually processed.

**Recommendation**: set `QUEUE_FREE_CONCURRENCY=10` (matches `KAGI_MAX_QUEUE_DEPTH`). Both env vars remain independently configurable.

---

## Package Changes: `@chatwork-bot/message-queue`

### `types.ts` — Changes

**Remove:**

- `ResolveConcurrency` type

**Add:**

```typescript
// Determines whether a source room has a standard translation config
export type HasStandardConfig = (roomId: number) => boolean

// Determines whether a source room has a free translation config
export type HasFreeConfig = (roomId: number) => boolean
```

**Update `QueueHealthSnapshot`:**

```typescript
export interface QueueHealthSnapshot {
  totalPending: number
  totalActive: number
  standardRooms: QueueRoomSnapshot[]
  freeRooms: QueueRoomSnapshot[]
}
```

### `room-queue.ts` — Changes

Make `persistence` optional. When `null`, all file I/O is skipped (in-memory only mode).

```typescript
interface RoomQueueOptions {
  roomId: number
  concurrency: number
  maxDepth: number
  persistence: QueuePersistence | null // null = in-memory only
  processor: Processor
}
```

All `await this.persistence.*` calls wrapped with null check. This is a backwards-compatible change — existing code passing a `QueuePersistence` instance is unaffected.

### `translation-queue.ts` — Full Redesign

**Old constructor options:**

```typescript
{
  ;(dataDir, maxDepth, processor, resolveConcurrency)
}
```

**New constructor options:**

```typescript
interface TranslationQueueOptions {
  dataDir: string
  maxDepth: number
  standardConcurrency: number
  freeConcurrency: number
  standardProcessor: Processor
  freeProcessor: Processor
  hasStandardConfig: HasStandardConfig
  hasFreeConfig: HasFreeConfig
}
```

**Internal state:**

```typescript
// Before: single map
private readonly rooms = new Map<number, RoomQueue>()

// After: two maps
private readonly standardRooms = new Map<number, RoomQueue>()
private readonly freeRooms = new Map<number, RoomQueue>()
```

**`enqueue()` fan-out logic:**

```typescript
async enqueue(roomId, command, traceId): Promise<EnqueueResult> {
  const results: EnqueueResult[] = []

  if (this.hasStandardConfig(roomId)) {
    const q = this.getOrCreateStandardQueue(roomId)
    results.push(await q.enqueue(item))
  }

  if (this.hasFreeConfig(roomId)) {
    const q = this.getOrCreateFreeQueue(roomId)
    results.push(await q.enqueue(item))
  }

  // accepted if at least one queue accepted (each queue is independently responsible)
  const accepted = results.some((r) => r.accepted)
  return accepted ? { accepted: true } : { accepted: false, reason: 'QUEUE_FULL' }
}
```

**`getSnapshot()`:**

```typescript
getSnapshot(): QueueHealthSnapshot {
  const standardRooms = Array.from(this.standardRooms.values()).map((rq) => rq.getSnapshot())
  const freeRooms = Array.from(this.freeRooms.values()).map((rq) => rq.getSnapshot())
  return {
    totalPending: [...standardRooms, ...freeRooms].reduce((s, r) => s + r.pending, 0),
    totalActive: [...standardRooms, ...freeRooms].reduce((s, r) => s + r.active, 0),
    standardRooms,
    freeRooms,
  }
}
```

---

## Translator Changes: `packages/translator/src/index.ts`

**Remove:**

- `resolveConcurrency` callback with free-first logic
- `Promise.allSettled([handleTranslateRequest, handleFreeTranslateRequest])` in processor

**Replace with:**

```typescript
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

---

## Environment Variable Changes

| Variable                     | Old Default | New Default | Reason                                               |
| ---------------------------- | ----------- | ----------- | ---------------------------------------------------- |
| `QUEUE_STANDARD_CONCURRENCY` | 1000        | 100         | Rate limit cap per user's Criterion 3                |
| `QUEUE_FREE_CONCURRENCY`     | 1           | 10          | Match `KAGI_MAX_QUEUE_DEPTH` to prevent backpressure |

Update in: `.env`, `.env.example`, `docker-compose.yml`, `env-schema.ts`.

---

## FIFO Guarantee

**How FIFO is preserved within each queue:**

1. `RoomQueue.items` is a JavaScript array — items are pushed to the back and spliced from the front
2. `runConsumer()` always takes `batch = this.items.splice(0, available)` — earliest items first
3. Items are dispatched to the processor in insertion order (FIFO dispatch)
4. Concurrent execution means completion order is not guaranteed, but the Chatwork _delivery_ order depends on when each translation finishes, which is independent of enqueue order

**For standard (concurrency=100):** Up to 100 OpenAI calls run in parallel. Dispatch order is FIFO; completion order varies by OpenAI latency. Messages arrive at the destination in the order they complete — this is acceptable because translations are independent.

**For free (concurrency=10):** Up to 10 requests dispatched to Kagi simultaneously. Since Kagi processes 1 at a time internally, they complete in near-FIFO order (Kagi's own internal queue is also FIFO). Effective delivery order is preserved.

---

## No Changes Needed

- `packages/translator/src/webhook/router.ts` — still calls `translationQueue.enqueue(roomId, command, traceId)`, no change
- `packages/message-queue/src/queue-persistence.ts` — used unchanged, just optional
- `packages/translator/src/webhook/handler.ts` — no change
- `packages/translator/src/webhook/free-handler.ts` — no change

---

## Tests

### `translation-queue.test.ts` — Update required

- Remove tests for `resolveConcurrency`
- Add tests for fan-out: message to room with both configs → both queues receive it
- Add tests for partial room: message to standard-only room → only standard queue receives it
- Add tests for snapshot structure (`standardRooms`, `freeRooms`)

### `room-queue.test.ts` — Update required

- Add test for `persistence: null` (in-memory mode) — no file I/O calls

---

## Migration Path

This is a breaking change to `TranslationQueueOptions`. Only `translator/src/index.ts` constructs `TranslationQueue` (one callsite). No other packages instantiate it. Migration scope is confined.

1. Update `types.ts`
2. Update `room-queue.ts` (optional persistence)
3. Redesign `translation-queue.ts`
4. Update `translator/src/index.ts`
5. Update env vars (`.env`, `.env.example`, `docker-compose.yml`, `env-schema.ts`)
6. Update tests

---

## Summary

| Criterion                  | Solution                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| 1: Max 2 destinations      | `hasStandardConfig` + `hasFreeConfig` callbacks control which queues are created                    |
| 2: Simultaneous processing | Fan-out enqueues into both queues at the same time — they run completely independently              |
| 3: Rate limit 100          | `standardConcurrency=100`, `freeConcurrency=10`; backlog up to `maxDepth=1000`                      |
| 4: FIFO ordering           | `RoomQueue.items` array, always splice from front — FIFO dispatch within each queue                 |
| 5: Queue isolation         | Two separate `RoomQueue` instances, separate processors, separate `Map` entries — zero shared state |
