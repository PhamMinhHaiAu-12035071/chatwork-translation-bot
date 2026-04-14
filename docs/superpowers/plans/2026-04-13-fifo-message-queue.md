# FIFO Message Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-room FIFO message queue to the translator service so burst messages are buffered and processed sequentially instead of being dropped.

**Architecture:** New package `@chatwork-bot/message-queue` provides `TranslationQueue` (facade), `RoomQueue` (concurrency semaphore + consumer loop), and `QueuePersistence` (atomic file I/O). The translator router replaces its fire-and-forget `Promise.allSettled` with a single `queue.enqueue()` call; the queue consumer runs the same dual-dispatch logic asynchronously.

**Tech Stack:** Bun · TypeScript 5.4+ strict · `node:fs/promises` (mkdir, readdir, readFile, rename, rm, writeFile) · `@chatwork-bot/core` (TranslationIngressCommand type) · bun:test

**Design Spec:** `docs/superpowers/specs/2026-04-13-fifo-message-queue-design.md`

---

## File Map

### New files

| File                                                   | Responsibility                                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `packages/message-queue/package.json`                  | Package manifest, dep on `@chatwork-bot/core`                                                  |
| `packages/message-queue/tsconfig.json`                 | Extends `../../tsconfig.base.json`                                                             |
| `packages/message-queue/src/types.ts`                  | All shared types: QueueItem, EnqueueResult, QueueHealthSnapshot, Processor, ResolveConcurrency |
| `packages/message-queue/src/queue-persistence.ts`      | Atomic file I/O, FIFO ordering via epoch-prefixed filenames                                    |
| `packages/message-queue/src/queue-persistence.test.ts` | Unit tests for QueuePersistence (real file I/O, tmp dir)                                       |
| `packages/message-queue/src/room-queue.ts`             | In-memory FIFO queue + concurrency semaphore + consumer loop for one room                      |
| `packages/message-queue/src/room-queue.test.ts`        | Unit tests for RoomQueue                                                                       |
| `packages/message-queue/src/translation-queue.ts`      | Facade: manages `Map<roomId, RoomQueue>`, lifecycle (startup/shutdown)                         |
| `packages/message-queue/src/translation-queue.test.ts` | Unit tests for TranslationQueue                                                                |
| `packages/message-queue/src/index.ts`                  | Public exports                                                                                 |

### Modified files

| File                                                                   | Change                                                                             |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `packages/message-queue/` (tsconfig of translator)                     | `packages/translator/tsconfig.json` — add `message-queue` to `~/*` paths           |
| `packages/translator/src/env-schema.ts`                                | Add 3 queue env vars                                                               |
| `packages/translator/src/types/observability.ts`                       | Add `queue?: QueueHealthSnapshot` to `TranslatorStatusSnapshot`                    |
| `packages/translator/src/services/translator-observability-runtime.ts` | Add `registerQueueSnapshotProvider()` + update `getTranslatorStatusSnapshot()`     |
| `packages/translator/src/webhook/router.ts`                            | Add `initTranslationQueue()` + replace `Promise.allSettled` with `queue.enqueue()` |
| `packages/translator/src/index.ts`                                     | Bootstrap queue, startup, shutdown, inject into router/status                      |
| `docker-compose.yml`                                                   | `stop_grace_period: 35s` + 3 queue env vars + KAGI default 15000→120000            |

---

## Task 1: Scaffold `@chatwork-bot/message-queue` package

**Files:**

- Create: `packages/message-queue/package.json`
- Create: `packages/message-queue/tsconfig.json`
- Create: `packages/message-queue/src/index.ts` (empty placeholder)

- [ ] **Step 1.1: Create package.json**

```json
{
  "name": "@chatwork-bot/message-queue",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "main": "./src/index.ts",
  "scripts": {
    "lint": "eslint \"**/*.ts\"",
    "lint:fix": "eslint \"**/*.ts\" --fix",
    "format": "prettier --write \"**/*.{ts,tsx,json,md,yml,yaml}\"",
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  "dependencies": {
    "@chatwork-bot/core": "workspace:*"
  }
}
```

Save to: `packages/message-queue/package.json`

- [ ] **Step 1.2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": "../..",
    "rootDir": "src",
    "outDir": "dist",
    "paths": {
      "~/*": ["packages/message-queue/src/*", "packages/core/src/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

Save to: `packages/message-queue/tsconfig.json`

- [ ] **Step 1.3: Create empty src/index.ts**

```typescript
// Exports added in Task 6
export {}
```

Save to: `packages/message-queue/src/index.ts`

- [ ] **Step 1.4: Install workspace dependencies**

```bash
bun install
```

Expected: no errors, `@chatwork-bot/core` symlinked in `packages/message-queue/node_modules`.

- [ ] **Step 1.5: Commit**

```bash
git add packages/message-queue/
git commit -m "chore(message-queue): scaffold @chatwork-bot/message-queue package"
```

---

## Task 2: Define types

**Files:**

- Create: `packages/message-queue/src/types.ts`

No tests needed — types are compile-time only.

- [ ] **Step 2.1: Write types.ts**

```typescript
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
  rooms: QueueRoomSnapshot[]
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
 * Callback that determines how many items a room can process concurrently.
 * Called once when the RoomQueue for a room is first created (lazy).
 */
export type ResolveConcurrency = (roomId: number) => number
```

Save to: `packages/message-queue/src/types.ts`

- [ ] **Step 2.2: Verify typecheck passes**

```bash
bun run --cwd packages/message-queue typecheck
```

Expected: no errors.

- [ ] **Step 2.3: Commit**

```bash
git add packages/message-queue/src/types.ts
git commit -m "feat(message-queue): define QueueItem, EnqueueResult, QueueHealthSnapshot types"
```

---

## Task 3: Implement QueuePersistence (TDD)

**Files:**

- Create: `packages/message-queue/src/queue-persistence.test.ts`
- Create: `packages/message-queue/src/queue-persistence.ts`

- [ ] **Step 3.1: Write failing tests**

```typescript
// packages/message-queue/src/queue-persistence.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { QueuePersistence } from './queue-persistence'
import type { QueueItem } from './types'

function makeItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: 'test-uuid-1234',
    sourceRoomId: 424846369,
    sourceMessageId: 'msg-001',
    traceId: 'trace-001',
    enqueuedAt: '2026-04-13T10:00:00.000Z',
    command: {
      sourceSystem: 'chatwork',
      sourceEventId: 'evt-001',
      sourceEventType: 'message',
      sourceMessageId: 'msg-001',
      sourceRoomId: 424846369,
      senderAccountId: 12345,
      rawBody: '[To:99] /translate ja Hello',
      translatableText: 'Hello',
      translationInputs: ['Hello'],
      sendTime: 1744567864000,
      updateTime: 1744567864000,
      audit: {
        receivedAt: '2026-04-13T10:00:00.000Z',
        rawSourceSnapshot: {},
      },
    },
    ...overrides,
  }
}

describe('QueuePersistence', () => {
  let tmpDir: string
  let persistence: QueuePersistence

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'queue-persistence-test-'))
    persistence = new QueuePersistence({ baseDir: tmpDir })
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  describe('writeItem', () => {
    it('creates a JSON file in pending/{roomId}/ directory', async () => {
      const item = makeItem()
      await persistence.writeItem(424846369, item)

      const dir = join(tmpDir, 'pending', '424846369')
      const files = await readdir(dir)
      expect(files).toHaveLength(1)
      expect(files[0]).toMatch(/^\d+-test-uuid-1234\.json$/)
    })

    it('file content matches the QueueItem', async () => {
      const item = makeItem()
      await persistence.writeItem(424846369, item)

      const items = await persistence.readPendingItems(424846369)
      expect(items).toHaveLength(1)
      expect(items[0]).toEqual(item)
    })

    it('no .tmp file remains after write', async () => {
      const item = makeItem()
      await persistence.writeItem(424846369, item)

      const dir = join(tmpDir, 'pending', '424846369')
      const files = await readdir(dir)
      expect(files.some((f) => f.endsWith('.tmp'))).toBe(false)
    })

    it('creates subdirectory if it does not exist', async () => {
      const item = makeItem({ sourceRoomId: 999999 })
      await persistence.writeItem(999999, item)

      const dir = join(tmpDir, 'pending', '999999')
      const dirStat = await stat(dir)
      expect(dirStat.isDirectory()).toBe(true)
    })
  })

  describe('readPendingItems', () => {
    it('returns items in FIFO order (oldest first)', async () => {
      const item1 = makeItem({
        id: 'uuid-1',
        sourceMessageId: 'msg-1',
        enqueuedAt: '2026-04-13T10:00:00.000Z',
      })
      const item2 = makeItem({
        id: 'uuid-2',
        sourceMessageId: 'msg-2',
        enqueuedAt: '2026-04-13T10:00:01.000Z',
      })
      const item3 = makeItem({
        id: 'uuid-3',
        sourceMessageId: 'msg-3',
        enqueuedAt: '2026-04-13T10:00:02.000Z',
      })

      // Write in order
      await persistence.writeItem(424846369, item1)
      await persistence.writeItem(424846369, item2)
      await persistence.writeItem(424846369, item3)

      const items = await persistence.readPendingItems(424846369)
      expect(items).toHaveLength(3)
      expect(items[0]?.id).toBe('uuid-1')
      expect(items[1]?.id).toBe('uuid-2')
      expect(items[2]?.id).toBe('uuid-3')
    })

    it('returns empty array when room directory does not exist', async () => {
      const items = await persistence.readPendingItems(99999)
      expect(items).toEqual([])
    })

    it('returns empty array when room directory is empty', async () => {
      await mkdir(join(tmpDir, 'pending', '424846369'), { recursive: true })
      const items = await persistence.readPendingItems(424846369)
      expect(items).toEqual([])
    })
  })

  describe('removeItem', () => {
    it('deletes the file for the given item', async () => {
      const item = makeItem()
      await persistence.writeItem(424846369, item)

      await persistence.removeItem(424846369, item)

      const items = await persistence.readPendingItems(424846369)
      expect(items).toHaveLength(0)
    })

    it('does not throw if file does not exist', async () => {
      const item = makeItem()
      // Don't write it first
      await expect(persistence.removeItem(424846369, item)).resolves.toBeUndefined()
    })
  })

  describe('archiveAll', () => {
    it('moves all pending files to archived/{timestamp}/', async () => {
      await persistence.writeItem(424846369, makeItem({ id: 'uuid-a', sourceMessageId: 'a' }))
      await persistence.writeItem(
        433504432,
        makeItem({ id: 'uuid-b', sourceMessageId: 'b', sourceRoomId: 433504432 }),
      )

      await persistence.archiveAll()

      // Pending directories should be empty or gone
      const pendingRoomA = await persistence.readPendingItems(424846369)
      const pendingRoomB = await persistence.readPendingItems(433504432)
      expect(pendingRoomA).toHaveLength(0)
      expect(pendingRoomB).toHaveLength(0)

      // Archived directory should exist with files
      const archivedDir = join(tmpDir, 'archived')
      const archivedTimestamps = await readdir(archivedDir)
      expect(archivedTimestamps).toHaveLength(1)
    })

    it('is a no-op when pending/ does not exist', async () => {
      // Should not throw
      await expect(persistence.archiveAll()).resolves.toBeUndefined()
    })

    it('is a no-op when pending/ is empty', async () => {
      await mkdir(join(tmpDir, 'pending'), { recursive: true })
      await expect(persistence.archiveAll()).resolves.toBeUndefined()
    })
  })

  describe('listRoomDirs', () => {
    it('returns roomIds as numbers from pending/ subdirectories', async () => {
      await persistence.writeItem(424846369, makeItem({ id: 'a', sourceMessageId: 'a' }))
      await persistence.writeItem(
        433504432,
        makeItem({ id: 'b', sourceMessageId: 'b', sourceRoomId: 433504432 }),
      )

      const rooms = await persistence.listRoomDirs()
      expect(rooms.sort()).toEqual([424846369, 433504432].sort())
    })

    it('returns empty array when pending/ does not exist', async () => {
      const rooms = await persistence.listRoomDirs()
      expect(rooms).toEqual([])
    })
  })
})
```

- [ ] **Step 3.2: Run tests — verify all fail**

```bash
bun test packages/message-queue/src/queue-persistence.test.ts
```

Expected: all tests FAIL with "Cannot find module './queue-persistence'" or similar.

- [ ] **Step 3.3: Implement QueuePersistence**

```typescript
// packages/message-queue/src/queue-persistence.ts
import { mkdir, readdir, readFile, rename, rm, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { QueueItem } from './types'

interface QueuePersistenceOptions {
  baseDir: string
}

function isEnoentError(err: unknown): boolean {
  return err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT'
}

export class QueuePersistence {
  private readonly pendingDir: string
  private readonly archivedDir: string

  constructor(options: QueuePersistenceOptions) {
    this.pendingDir = join(options.baseDir, 'pending')
    this.archivedDir = join(options.baseDir, 'archived')
  }

  private roomDir(roomId: number): string {
    return join(this.pendingDir, String(roomId))
  }

  /** Filename: {epoch-ms}-{item.id}.json  — alphabetical sort = FIFO */
  private itemFilename(item: QueueItem): string {
    const epoch = new Date(item.enqueuedAt).getTime()
    return `${epoch}-${item.id}.json`
  }

  async writeItem(roomId: number, item: QueueItem): Promise<void> {
    const dir = this.roomDir(roomId)
    await mkdir(dir, { recursive: true })

    const filename = this.itemFilename(item)
    const finalPath = join(dir, filename)
    const tmpPath = `${finalPath}.tmp`

    await writeFile(tmpPath, JSON.stringify(item), 'utf-8')
    await rename(tmpPath, finalPath)
  }

  async readPendingItems(roomId: number): Promise<QueueItem[]> {
    const dir = this.roomDir(roomId)

    let filenames: string[]
    try {
      filenames = await readdir(dir)
    } catch (err) {
      if (isEnoentError(err)) return []
      throw err
    }

    const jsonFiles = filenames.filter((f) => f.endsWith('.json')).sort() // alphabetical = chronological (epoch prefix)

    const items: QueueItem[] = []
    for (const filename of jsonFiles) {
      const content = await readFile(join(dir, filename), 'utf-8')
      items.push(JSON.parse(content) as QueueItem)
    }

    return items
  }

  async removeItem(roomId: number, item: QueueItem): Promise<void> {
    const filename = this.itemFilename(item)
    const filePath = join(this.roomDir(roomId), filename)

    try {
      await unlink(filePath)
    } catch (err) {
      if (isEnoentError(err)) return
      throw err
    }
  }

  async archiveAll(): Promise<void> {
    // Check if pending/ exists
    let roomDirs: string[]
    try {
      roomDirs = await readdir(this.pendingDir)
    } catch (err) {
      if (isEnoentError(err)) return
      throw err
    }

    if (roomDirs.length === 0) return

    // Move pending/ → archived/{ISO timestamp}/
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const archiveTarget = join(this.archivedDir, timestamp)
    await mkdir(this.archivedDir, { recursive: true })
    await rename(this.pendingDir, archiveTarget)
  }

  async listRoomDirs(): Promise<number[]> {
    let entries: string[]
    try {
      entries = await readdir(this.pendingDir)
    } catch (err) {
      if (isEnoentError(err)) return []
      throw err
    }

    return entries.map((e) => parseInt(e, 10)).filter((n) => !isNaN(n))
  }
}
```

- [ ] **Step 3.4: Run tests — verify all pass**

```bash
bun test packages/message-queue/src/queue-persistence.test.ts
```

Expected: all tests PASS.

- [ ] **Step 3.5: Commit**

```bash
git add packages/message-queue/src/queue-persistence.ts packages/message-queue/src/queue-persistence.test.ts
git commit -m "feat(message-queue): implement QueuePersistence with atomic file I/O and FIFO ordering"
```

---

## Task 4: Implement RoomQueue (TDD)

**Files:**

- Create: `packages/message-queue/src/room-queue.test.ts`
- Create: `packages/message-queue/src/room-queue.ts`

- [ ] **Step 4.1: Write failing tests**

```typescript
// packages/message-queue/src/room-queue.test.ts
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { QueuePersistence } from './queue-persistence'
import { RoomQueue } from './room-queue'
import type { QueueItem, Processor } from './types'

const ROOM_ID = 424846369

function makeItem(overrides: Partial<QueueItem> = {}): QueueItem {
  const id = overrides.id ?? `uuid-${Math.random().toString(36).slice(2)}`
  const msgId = overrides.sourceMessageId ?? `msg-${id}`
  return {
    id,
    sourceRoomId: ROOM_ID,
    sourceMessageId: msgId,
    traceId: 'trace-test',
    enqueuedAt: new Date().toISOString(),
    command: {
      sourceSystem: 'chatwork',
      sourceEventId: 'evt-1',
      sourceEventType: 'message',
      sourceMessageId: msgId,
      sourceRoomId: ROOM_ID,
      senderAccountId: 12345,
      rawBody: 'Hello',
      translatableText: 'Hello',
      translationInputs: ['Hello'],
      sendTime: Date.now(),
      updateTime: Date.now(),
      audit: { receivedAt: new Date().toISOString(), rawSourceSnapshot: {} },
    },
    ...overrides,
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

describe('RoomQueue', () => {
  let tmpDir: string
  let persistence: QueuePersistence

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'room-queue-test-'))
    persistence = new QueuePersistence({ baseDir: tmpDir })
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  describe('enqueue', () => {
    it('returns { accepted: true } when below maxDepth', async () => {
      const queue = new RoomQueue({
        roomId: ROOM_ID,
        concurrency: 1,
        maxDepth: 10,
        persistence,
        processor: makeNoopProcessor(),
      })
      const result = await queue.enqueue(makeItem())
      expect(result).toEqual({ accepted: true })
    })

    it('returns { accepted: false, reason: QUEUE_FULL } when at maxDepth', async () => {
      // maxDepth=1, enqueue 1 item (fills queue), then try another
      let holdRelease: () => void
      const blocked = new Promise<void>((resolve) => {
        holdRelease = resolve
      })
      const blockingProcessor: Processor = async () => {
        await blocked
      }

      const queue = new RoomQueue({
        roomId: ROOM_ID,
        concurrency: 1,
        maxDepth: 1,
        persistence,
        processor: blockingProcessor,
      })

      // First item fills the queue (depth=1=maxDepth)
      const r1 = await queue.enqueue(makeItem({ id: 'item-1', sourceMessageId: 'msg-1' }))
      expect(r1).toEqual({ accepted: true })

      // Second item should be rejected
      const r2 = await queue.enqueue(makeItem({ id: 'item-2', sourceMessageId: 'msg-2' }))
      expect(r2).toEqual({ accepted: false, reason: 'QUEUE_FULL' })

      // Cleanup
      holdRelease!()
    })

    it('persists item to disk on accept', async () => {
      const queue = new RoomQueue({
        roomId: ROOM_ID,
        concurrency: 1,
        maxDepth: 10,
        persistence,
        processor: makeNoopProcessor(),
      })
      const item = makeItem()

      // Block consumer so item stays on disk long enough to check
      let holdRelease: () => void
      const blocked = new Promise<void>((resolve) => {
        holdRelease = resolve
      })
      const blockingProcessor: Processor = async () => {
        await blocked
      }

      const blockingQueue = new RoomQueue({
        roomId: ROOM_ID,
        concurrency: 1,
        maxDepth: 10,
        persistence,
        processor: blockingProcessor,
      })
      await blockingQueue.enqueue(item)

      const onDisk = await persistence.readPendingItems(ROOM_ID)
      expect(onDisk.some((i) => i.id === item.id)).toBe(true)

      holdRelease!()
    })
  })

  describe('consumer: FIFO processing order', () => {
    it('processes items in enqueue order (concurrency=1)', async () => {
      const processed: string[] = []
      const processor: Processor = async (command) => {
        processed.push(command.sourceMessageId)
      }

      const queue = new RoomQueue({
        roomId: ROOM_ID,
        concurrency: 1,
        maxDepth: 10,
        persistence,
        processor,
      })

      await queue.enqueue(
        makeItem({ id: 'a', sourceMessageId: 'msg-a', enqueuedAt: new Date(1000).toISOString() }),
      )
      await queue.enqueue(
        makeItem({ id: 'b', sourceMessageId: 'msg-b', enqueuedAt: new Date(2000).toISOString() }),
      )
      await queue.enqueue(
        makeItem({ id: 'c', sourceMessageId: 'msg-c', enqueuedAt: new Date(3000).toISOString() }),
      )

      await waitFor(() => processed.length === 3)
      expect(processed).toEqual(['msg-a', 'msg-b', 'msg-c'])
    })
  })

  describe('consumer: concurrency', () => {
    it('processes up to concurrency items simultaneously', async () => {
      let concurrent = 0
      let maxConcurrent = 0
      let holdRelease: () => void
      const barrier = new Promise<void>((resolve) => {
        holdRelease = resolve
      })

      const processor: Processor = async () => {
        concurrent++
        maxConcurrent = Math.max(maxConcurrent, concurrent)
        await barrier
        concurrent--
      }

      const queue = new RoomQueue({
        roomId: ROOM_ID,
        concurrency: 3,
        maxDepth: 10,
        persistence,
        processor,
      })

      await queue.enqueue(makeItem({ id: 'i1', sourceMessageId: 'msg-1' }))
      await queue.enqueue(makeItem({ id: 'i2', sourceMessageId: 'msg-2' }))
      await queue.enqueue(makeItem({ id: 'i3', sourceMessageId: 'msg-3' }))

      await waitFor(() => maxConcurrent >= 3 || concurrent >= 3)
      expect(maxConcurrent).toBe(3)

      holdRelease!()
    })
  })

  describe('consumer: failure handling', () => {
    it('skips failed item and continues with next item', async () => {
      const processed: string[] = []
      let callCount = 0
      const processor: Processor = async (command) => {
        callCount++
        if (command.sourceMessageId === 'msg-fail') {
          throw new Error('Simulated translation failure')
        }
        processed.push(command.sourceMessageId)
      }

      const queue = new RoomQueue({
        roomId: ROOM_ID,
        concurrency: 1,
        maxDepth: 10,
        persistence,
        processor,
      })

      await queue.enqueue(
        makeItem({
          id: 'ok1',
          sourceMessageId: 'msg-ok1',
          enqueuedAt: new Date(1000).toISOString(),
        }),
      )
      await queue.enqueue(
        makeItem({
          id: 'fail',
          sourceMessageId: 'msg-fail',
          enqueuedAt: new Date(2000).toISOString(),
        }),
      )
      await queue.enqueue(
        makeItem({
          id: 'ok2',
          sourceMessageId: 'msg-ok2',
          enqueuedAt: new Date(3000).toISOString(),
        }),
      )

      await waitFor(() => callCount === 3)
      expect(processed).toEqual(['msg-ok1', 'msg-ok2'])
    })
  })

  describe('consumer: auto-stop and restart', () => {
    it('consumer stops when queue empties', async () => {
      const queue = new RoomQueue({
        roomId: ROOM_ID,
        concurrency: 1,
        maxDepth: 10,
        persistence,
        processor: makeNoopProcessor(),
      })

      await queue.enqueue(makeItem())
      await waitFor(() => !queue.isProcessing() && queue.size() === 0)

      expect(queue.isProcessing()).toBe(false)
      expect(queue.size()).toBe(0)
    })

    it('consumer restarts when item added after idle', async () => {
      const processed: string[] = []
      const processor: Processor = async (command) => {
        processed.push(command.sourceMessageId)
      }

      const queue = new RoomQueue({
        roomId: ROOM_ID,
        concurrency: 1,
        maxDepth: 10,
        persistence,
        processor,
      })

      // First item — consumer runs, processes, stops
      await queue.enqueue(makeItem({ id: 'first', sourceMessageId: 'msg-first' }))
      await waitFor(() => processed.includes('msg-first'))

      // Small delay to ensure consumer fully stopped
      await new Promise((r) => setTimeout(r, 50))

      // Second item — consumer should restart
      await queue.enqueue(makeItem({ id: 'second', sourceMessageId: 'msg-second' }))
      await waitFor(() => processed.includes('msg-second'))

      expect(processed).toEqual(['msg-first', 'msg-second'])
    })
  })

  describe('getSnapshot', () => {
    it('returns accurate pending and active counts', async () => {
      let holdRelease: () => void
      const barrier = new Promise<void>((resolve) => {
        holdRelease = resolve
      })
      const slowProcessor: Processor = async () => {
        await barrier
      }

      const queue = new RoomQueue({
        roomId: ROOM_ID,
        concurrency: 1,
        maxDepth: 10,
        persistence,
        processor: slowProcessor,
      })

      await queue.enqueue(makeItem({ id: 'p1', sourceMessageId: 'msg-p1' }))
      await queue.enqueue(makeItem({ id: 'p2', sourceMessageId: 'msg-p2' }))

      // Wait for first item to be picked up by consumer (active=1, pending=1)
      await waitFor(() => queue.isProcessing())

      const snapshot = queue.getSnapshot()
      expect(snapshot.roomId).toBe(ROOM_ID)
      expect(snapshot.active).toBe(1)
      expect(snapshot.pending).toBe(1)

      holdRelease!()
    })
  })

  describe('depth counting', () => {
    it('depth decreases after item is processed and removed', async () => {
      const processed: string[] = []
      const processor: Processor = async (command) => {
        processed.push(command.sourceMessageId)
      }

      const queue = new RoomQueue({
        roomId: ROOM_ID,
        concurrency: 1,
        maxDepth: 2,
        persistence,
        processor,
      })

      await queue.enqueue(makeItem({ id: 'item1', sourceMessageId: 'msg-1' }))
      await waitFor(() => processed.includes('msg-1'))

      // After processing, depth should be 0 — can accept more items
      const result = await queue.enqueue(makeItem({ id: 'item2', sourceMessageId: 'msg-2' }))
      expect(result).toEqual({ accepted: true })
    })
  })
})
```

- [ ] **Step 4.2: Run tests — verify all fail**

```bash
bun test packages/message-queue/src/room-queue.test.ts
```

Expected: all tests FAIL with "Cannot find module './room-queue'".

- [ ] **Step 4.3: Implement RoomQueue**

```typescript
// packages/message-queue/src/room-queue.ts
import type { QueuePersistence } from './queue-persistence'
import type { EnqueueResult, Processor, QueueItem, QueueRoomSnapshot } from './types'

interface RoomQueueOptions {
  roomId: number
  concurrency: number
  maxDepth: number
  persistence: QueuePersistence
  processor: Processor
}

export class RoomQueue {
  private readonly roomId: number
  private readonly concurrency: number
  private readonly maxDepth: number
  private readonly persistence: QueuePersistence
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

    // ASYNC: persist to disk; rollback in-memory state on failure
    try {
      await this.persistence.writeItem(this.roomId, item)
    } catch {
      this.depth--
      this.items.pop()
      return { accepted: false, reason: 'WRITE_ERROR' }
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
      void this.runConsumer()
    }
  }

  private async runConsumer(): Promise<void> {
    this.running = true

    while (this.items.length > 0) {
      const available = this.concurrency - this.activeCount
      if (available <= 0) {
        // All concurrency slots in use — wait for current batch to complete
        await new Promise<void>((resolve) => setTimeout(resolve, 10))
        continue
      }

      const batch = this.items.splice(0, available)
      this.activeCount += batch.length

      await Promise.allSettled(batch.map((item) => this.processItem(item)))
      // After batch, loop checks items.length again — picks up items added during processing
    }

    this.running = false
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
      try {
        await this.persistence.removeItem(this.roomId, item)
      } catch {
        // Best effort — file may already be gone
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

- [ ] **Step 4.4: Run tests — verify all pass**

```bash
bun test packages/message-queue/src/room-queue.test.ts
```

Expected: all tests PASS.

- [ ] **Step 4.5: Commit**

```bash
git add packages/message-queue/src/room-queue.ts packages/message-queue/src/room-queue.test.ts
git commit -m "feat(message-queue): implement RoomQueue with FIFO consumer loop and concurrency semaphore"
```

---

## Task 5: Implement TranslationQueue (TDD)

**Files:**

- Create: `packages/message-queue/src/translation-queue.test.ts`
- Create: `packages/message-queue/src/translation-queue.ts`

- [ ] **Step 5.1: Write failing tests**

```typescript
// packages/message-queue/src/translation-queue.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { TranslationQueue } from './translation-queue'
import type { Processor, ResolveConcurrency } from './types'
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

function makeConstantConcurrency(n: number): ResolveConcurrency {
  return () => n
}

/** Wait up to maxMs for condition to become true, polling every 20ms */
async function waitFor(condition: () => boolean, maxMs = 2000): Promise<void> {
  const deadline = Date.now() + maxMs
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('waitFor timeout')
    await new Promise((r) => setTimeout(r, 20))
  }
}

describe('TranslationQueue', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'translation-queue-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  function makeQueue(
    overrides: {
      processor?: Processor
      resolveConcurrency?: ResolveConcurrency
      maxDepth?: number
    } = {},
  ) {
    return new TranslationQueue({
      dataDir: tmpDir,
      maxDepth: overrides.maxDepth ?? 10,
      processor: overrides.processor ?? makeNoopProcessor(),
      resolveConcurrency: overrides.resolveConcurrency ?? makeConstantConcurrency(1),
    })
  }

  describe('startup', () => {
    it('archives existing pending files from previous session', async () => {
      // Pre-populate pending dir to simulate crashed session
      const queue1 = makeQueue()
      await queue1.startup()
      await queue1.enqueue(424846369, makeCommand(424846369, 'old-msg'), 'trace-old')

      // Wait for processing to add to disk (startup queued it)
      // Actually: enqueue adds to disk, let's verify it was written then archived
      const queue2 = makeQueue()
      await queue2.startup() // Should archive old-msg

      // Pending should be empty for new session
      const snapshot = queue2.getSnapshot()
      expect(snapshot.totalPending).toBe(0)
      expect(snapshot.totalActive).toBe(0)

      // Archived dir should have the old file
      const archivedDir = join(tmpDir, 'archived')
      const timestamps = await readdir(archivedDir).catch(() => [])
      expect(timestamps.length).toBeGreaterThan(0)
    })

    it('starts clean when no pending files exist', async () => {
      const queue = makeQueue()
      await queue.startup()
      const snapshot = queue.getSnapshot()
      expect(snapshot.totalPending).toBe(0)
      expect(snapshot.totalActive).toBe(0)
    })
  })

  describe('enqueue', () => {
    it('returns { accepted: true } for a new message', async () => {
      const queue = makeQueue()
      await queue.startup()
      const result = await queue.enqueue(424846369, makeCommand(), 'trace-1')
      expect(result).toEqual({ accepted: true })
    })

    it('lazy-creates separate RoomQueue per room', async () => {
      const processed: number[] = []
      const processor: Processor = async (command) => {
        processed.push(command.sourceRoomId)
      }
      const queue = makeQueue({ processor })
      await queue.startup()

      await queue.enqueue(424846369, makeCommand(424846369, 'msg-a'), 'trace-a')
      await queue.enqueue(433504432, makeCommand(433504432, 'msg-b'), 'trace-b')

      await waitFor(() => processed.length === 2)

      const snapshot = queue.getSnapshot()
      expect(snapshot.rooms).toHaveLength(2)
      expect(snapshot.rooms.map((r) => r.roomId).sort()).toEqual([424846369, 433504432].sort())
    })

    it('returns { accepted: false, reason: QUEUE_FULL } when room queue is full', async () => {
      let holdRelease: () => void
      const barrier = new Promise<void>((resolve) => {
        holdRelease = resolve
      })
      const blockingProcessor: Processor = async () => {
        await barrier
      }

      const queue = makeQueue({ processor: blockingProcessor, maxDepth: 1 })
      await queue.startup()

      const r1 = await queue.enqueue(424846369, makeCommand(424846369, 'msg-1'), 'trace-1')
      expect(r1).toEqual({ accepted: true })

      const r2 = await queue.enqueue(424846369, makeCommand(424846369, 'msg-2'), 'trace-2')
      expect(r2).toEqual({ accepted: false, reason: 'QUEUE_FULL' })

      holdRelease!()
    })

    it('returns { accepted: false } after shutdown (no longer accepting)', async () => {
      const queue = makeQueue()
      await queue.startup()
      await queue.shutdown()

      const result = await queue.enqueue(424846369, makeCommand(), 'trace-1')
      expect(result).toEqual({ accepted: false, reason: 'QUEUE_FULL' })
    })
  })

  describe('shutdown', () => {
    it('waits for active processing to complete before resolving', async () => {
      const completed: string[] = []
      let holdRelease: () => void
      const barrier = new Promise<void>((resolve) => {
        holdRelease = resolve
      })

      const processor: Processor = async (command) => {
        await barrier
        completed.push(command.sourceMessageId)
      }

      const queue = makeQueue({ processor })
      await queue.startup()

      await queue.enqueue(424846369, makeCommand(424846369, 'msg-1'), 'trace-1')

      // Start shutdown while processing is ongoing
      const shutdownPromise = queue.shutdown()

      // Release the barrier so the processor can finish
      holdRelease!()

      await shutdownPromise
      expect(completed).toContain('msg-1')
    })
  })

  describe('getSnapshot', () => {
    it('returns accurate totals across rooms', async () => {
      let holdRelease: () => void
      const barrier = new Promise<void>((resolve) => {
        holdRelease = resolve
      })
      const slowProcessor: Processor = async () => {
        await barrier
      }

      const queue = makeQueue({ processor: slowProcessor })
      await queue.startup()

      await queue.enqueue(424846369, makeCommand(424846369, 'msg-a'), 'trace-a')
      await queue.enqueue(433504432, makeCommand(433504432, 'msg-b'), 'trace-b')

      await waitFor(() => queue.getSnapshot().totalActive >= 1)

      const snapshot = queue.getSnapshot()
      expect(snapshot.totalActive + snapshot.totalPending).toBe(2)

      holdRelease!()
    })
  })
})
```

- [ ] **Step 5.2: Run tests — verify all fail**

```bash
bun test packages/message-queue/src/translation-queue.test.ts
```

Expected: all tests FAIL with "Cannot find module './translation-queue'".

- [ ] **Step 5.3: Implement TranslationQueue**

```typescript
// packages/message-queue/src/translation-queue.ts
import { QueuePersistence } from './queue-persistence'
import { RoomQueue } from './room-queue'
import type { EnqueueResult, Processor, QueueHealthSnapshot, ResolveConcurrency } from './types'
import type { TranslationIngressCommand } from '@chatwork-bot/core'

interface TranslationQueueOptions {
  /** Base directory for queue file persistence (will contain pending/ and archived/) */
  dataDir: string
  /** Maximum total items (pending + active) per room before rejecting new items */
  maxDepth: number
  /** Dual-dispatch processor callback — runs the actual translation work */
  processor: Processor
  /** Returns concurrency limit for a given roomId — called once per room at lazy creation */
  resolveConcurrency: ResolveConcurrency
}

export class TranslationQueue {
  private readonly persistence: QueuePersistence
  private readonly maxDepth: number
  private readonly processor: Processor
  private readonly resolveConcurrency: ResolveConcurrency

  private readonly rooms = new Map<number, RoomQueue>()
  private accepting = true

  constructor(options: TranslationQueueOptions) {
    this.persistence = new QueuePersistence({ baseDir: options.dataDir })
    this.maxDepth = options.maxDepth
    this.processor = options.processor
    this.resolveConcurrency = options.resolveConcurrency
  }

  /** Archive any pending files from a previous process session. Call before accepting messages. */
  async startup(): Promise<void> {
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
  }

  /** Enqueue a command for processing. Returns immediately — never blocks on translation. */
  async enqueue(
    roomId: number,
    command: TranslationIngressCommand,
    traceId: string,
  ): Promise<EnqueueResult> {
    if (!this.accepting) {
      return { accepted: false, reason: 'QUEUE_FULL' }
    }

    const roomQueue = this.getOrCreateRoomQueue(roomId)
    const item = {
      id: crypto.randomUUID(),
      sourceRoomId: roomId,
      sourceMessageId: command.sourceMessageId,
      traceId,
      command,
      enqueuedAt: new Date().toISOString(),
    }

    const result = await roomQueue.enqueue(item)

    if (result.accepted) {
      console.log(
        JSON.stringify({
          level: 'info',
          service: 'translator',
          event: 'queue_item_enqueued',
          timestamp: new Date().toISOString(),
          traceId,
          sourceRoomId: roomId,
          itemId: item.id,
          queueDepth: roomQueue.size() + (roomQueue.isProcessing() ? 1 : 0),
        }),
      )
    } else {
      console.warn(
        JSON.stringify({
          level: 'warn',
          service: 'translator',
          event: 'queue_item_rejected',
          timestamp: new Date().toISOString(),
          traceId,
          sourceRoomId: roomId,
          reason: result.reason,
        }),
      )
    }

    return result
  }

  /**
   * Graceful shutdown: stop accepting new items, wait up to 30s for active processing.
   * Docker stop_grace_period: 35s gives 5s buffer after this resolves.
   */
  async shutdown(): Promise<void> {
    this.accepting = false

    const SHUTDOWN_TIMEOUT_MS = 30_000
    const POLL_INTERVAL_MS = 100
    const deadline = Date.now() + SHUTDOWN_TIMEOUT_MS

    while (Date.now() < deadline) {
      const snapshot = this.getSnapshot()
      if (snapshot.totalActive === 0 && snapshot.totalPending === 0) break
      await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    }
  }

  getSnapshot(): QueueHealthSnapshot {
    const rooms = Array.from(this.rooms.values()).map((rq) => rq.getSnapshot())
    return {
      totalPending: rooms.reduce((sum, r) => sum + r.pending, 0),
      totalActive: rooms.reduce((sum, r) => sum + r.active, 0),
      rooms,
    }
  }

  private getOrCreateRoomQueue(roomId: number): RoomQueue {
    const existing = this.rooms.get(roomId)
    if (existing !== undefined) return existing

    const concurrency = this.resolveConcurrency(roomId)
    const queue = new RoomQueue({
      roomId,
      concurrency,
      maxDepth: this.maxDepth,
      persistence: this.persistence,
      processor: this.processor,
    })

    this.rooms.set(roomId, queue)

    console.log(
      JSON.stringify({
        level: 'debug',
        service: 'translator',
        event: 'queue_consumer_started',
        timestamp: new Date().toISOString(),
        sourceRoomId: roomId,
        concurrency,
      }),
    )

    return queue
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

- [ ] **Step 5.4: Run tests — verify all pass**

```bash
bun test packages/message-queue/src/translation-queue.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5.5: Run all package tests**

```bash
bun test packages/message-queue/
```

Expected: all tests PASS across all 3 test files.

- [ ] **Step 5.6: Commit**

```bash
git add packages/message-queue/src/translation-queue.ts packages/message-queue/src/translation-queue.test.ts
git commit -m "feat(message-queue): implement TranslationQueue facade with startup/shutdown lifecycle"
```

---

## Task 6: Wire up package exports

**Files:**

- Modify: `packages/message-queue/src/index.ts`

- [ ] **Step 6.1: Update index.ts**

```typescript
// packages/message-queue/src/index.ts
export { TranslationQueue } from './translation-queue'
export type {
  EnqueueResult,
  QueueHealthSnapshot,
  QueueItem,
  QueueRoomSnapshot,
  Processor,
  ResolveConcurrency,
} from './types'
```

- [ ] **Step 6.2: Verify typecheck**

```bash
bun run --cwd packages/message-queue typecheck
```

Expected: no errors.

- [ ] **Step 6.3: Commit**

```bash
git add packages/message-queue/src/index.ts
git commit -m "feat(message-queue): export public API from package index"
```

---

## Task 7: Update translator tsconfig to include message-queue

**Files:**

- Modify: `packages/translator/tsconfig.json`

- [ ] **Step 7.1: Add message-queue to paths**

In `packages/translator/tsconfig.json`, add `"packages/message-queue/src/*"` to the `~/*` paths array:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": "../..",
    "rootDir": "src",
    "outDir": "dist",
    "paths": {
      "~/*": [
        "packages/translator/src/*",
        "packages/core/src/*",
        "packages/chatwork/src/*",
        "packages/translation-prompt/src/*",
        "packages/message-queue/src/*"
      ]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 7.2: Verify typecheck**

```bash
bun run --cwd packages/translator typecheck
```

Expected: no errors.

- [ ] **Step 7.3: Commit**

```bash
git add packages/translator/tsconfig.json
git commit -m "chore(translator): add @chatwork-bot/message-queue to tsconfig paths"
```

---

## Task 8: Add queue env variables to translator env-schema

**Files:**

- Modify: `packages/translator/src/env-schema.ts`

- [ ] **Step 8.1: Add 3 queue env vars to translatorEnvSchema**

In `packages/translator/src/env-schema.ts`, add these 3 lines inside `translatorEnvSchema` (e.g., after the `ENABLE_KEYWORD_CACHE` line):

```typescript
  // Message queue configuration
  QUEUE_MAX_DEPTH_PER_ROOM: z.coerce.number().int().positive().default(10),
  QUEUE_STANDARD_CONCURRENCY: z.coerce.number().int().positive().default(3),
  QUEUE_FREE_CONCURRENCY: z.coerce.number().int().positive().default(1),
```

- [ ] **Step 8.2: Verify typecheck**

```bash
bun run --cwd packages/translator typecheck
```

Expected: no errors.

- [ ] **Step 8.3: Commit**

```bash
git add packages/translator/src/env-schema.ts
git commit -m "feat(translator): add QUEUE_MAX_DEPTH_PER_ROOM, QUEUE_STANDARD_CONCURRENCY, QUEUE_FREE_CONCURRENCY env vars"
```

---

## Task 9: Extend TranslatorStatusSnapshot with queue field

**Files:**

- Modify: `packages/translator/src/types/observability.ts`
- Modify: `packages/translator/src/services/translator-observability-runtime.ts`

- [ ] **Step 9.1: Add queue field to TranslatorStatusSnapshot**

In `packages/translator/src/types/observability.ts`, update `TranslatorStatusSnapshot`:

```typescript
import type { QueueHealthSnapshot } from '@chatwork-bot/message-queue'

export interface TranslatorStatusSnapshot {
  status: 'ok'
  updatedAt: string
  activeRequests: ActiveTranslatorRequest[]
  recentResults: TranslatorRecentResult[]
  queue?: QueueHealthSnapshot
}
```

Add the import at the top of the file (after existing imports).

- [ ] **Step 9.2: Add registerQueueSnapshotProvider to observability-runtime**

In `packages/translator/src/services/translator-observability-runtime.ts`, add after the `translatorStatusStore` declaration:

```typescript
import type { QueueHealthSnapshot } from '@chatwork-bot/message-queue'

let queueSnapshotProvider: (() => QueueHealthSnapshot) | null = null

export function registerQueueSnapshotProvider(fn: () => QueueHealthSnapshot): void {
  queueSnapshotProvider = fn
}
```

And update `getTranslatorStatusSnapshot()` to include queue:

```typescript
export function getTranslatorStatusSnapshot(): TranslatorStatusSnapshot {
  const snapshot = translatorStatusStore.getSnapshot()
  return queueSnapshotProvider !== null ? { ...snapshot, queue: queueSnapshotProvider() } : snapshot
}
```

> Note: `translatorStatusStore.getSnapshot()` returns `TranslatorStatusSnapshot` without `queue`. The spread + conditional queue field is backward-compatible.

- [ ] **Step 9.3: Verify typecheck**

```bash
bun run --cwd packages/translator typecheck
```

Expected: no errors.

- [ ] **Step 9.4: Commit**

```bash
git add packages/translator/src/types/observability.ts packages/translator/src/services/translator-observability-runtime.ts
git commit -m "feat(translator): add queue health snapshot to /status endpoint"
```

---

## Task 10: Update router to use TranslationQueue

**Files:**

- Modify: `packages/translator/src/webhook/router.ts`

- [ ] **Step 10.1: Rewrite router.ts**

Replace entire `packages/translator/src/webhook/router.ts` with:

```typescript
import { Elysia, t } from 'elysia'
import { TranslationIngressCommandSchema } from '@chatwork-bot/core'
import type { TranslationQueue } from '@chatwork-bot/message-queue'

let translationQueue: TranslationQueue | null = null

export function initTranslationQueue(queue: TranslationQueue): void {
  translationQueue = queue
}

export const translateRoutes = new Elysia({ name: 'translator:webhook' }).post(
  '/internal/translate',
  async ({ body, headers }) => {
    const traceId = headers['x-trace-id'] ?? crypto.randomUUID()

    console.log(
      JSON.stringify({
        level: 'info',
        service: 'translator',
        event: 'translation_ingress_received',
        timestamp: new Date().toISOString(),
        traceId,
        sourceMessageId: body.command.sourceMessageId,
        sourceRoomId: body.command.sourceRoomId,
      }),
    )

    if (translationQueue === null) {
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'translator',
          event: 'translation_queue_not_initialized',
          timestamp: new Date().toISOString(),
          traceId,
        }),
      )
      return 'OK'
    }

    const result = await translationQueue.enqueue(body.command.sourceRoomId, body.command, traceId)

    if (!result.accepted) {
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'translator',
          event: 'translation_ingress_dispatch_failed',
          timestamp: new Date().toISOString(),
          traceId,
          sourceMessageId: body.command.sourceMessageId,
          sourceRoomId: body.command.sourceRoomId,
          errorCode: 'BACKPRESSURE',
          errorMessage: `Queue rejected message: ${result.reason}`,
        }),
      )
    }

    return 'OK'
  },
  {
    body: t.Object({
      command: TranslationIngressCommandSchema,
    }),
  },
)
```

- [ ] **Step 10.2: Verify typecheck**

```bash
bun run --cwd packages/translator typecheck
```

Expected: no errors.

- [ ] **Step 10.3: Commit**

```bash
git add packages/translator/src/webhook/router.ts
git commit -m "feat(translator): replace fire-and-forget dispatch with FIFO queue.enqueue()"
```

---

## Task 11: Bootstrap TranslationQueue in translator index.ts

**Files:**

- Modify: `packages/translator/src/index.ts`

- [ ] **Step 11.1: Update index.ts**

Replace entire `packages/translator/src/index.ts` with:

```typescript
import { KagiClient } from '@chatwork-bot/provider-kagi'
import { TranslationQueue } from '@chatwork-bot/message-queue'
import { join } from 'node:path'
import { env } from './env'
import { registerAllProviders } from '~/bootstrap/register-providers'
import { runStartupGuards } from '~/bootstrap/startup-guards'
import { logStartupBanner } from '~/bootstrap/startup-banner'
import { FreeTranslationBackend } from '~/services/free-translation-backend'
import { FreeRoomConfigStore } from '~/services/free-room-config-store'
import {
  DEFAULT_TRANSLATOR_PIPELINE_TIMEOUT_MS,
  hasExplicitPipelineTimeoutOverride,
  resolvePipelineTimeout,
} from '~/services/pipeline-timeout'
import { RoomConfigStore } from '~/services/room-config-store'
import { asyncLogger } from '~/services/async-logger'
import { registerQueueSnapshotProvider } from '~/services/translator-observability-runtime'
import { initFreeTranslateHandler, handleFreeTranslateRequest } from '~/webhook/free-handler'
import { initTranslateHandler, handleTranslateRequest } from '~/webhook/handler'
import { initTranslationQueue } from '~/webhook/router'
import { createServer } from './server'

registerAllProviders()
await runStartupGuards()

const store = new RoomConfigStore({
  dataDir: env.ROOM_CONFIG_DATA_DIR,
  encryptionKeyHex: env.ROOM_CONFIG_ENCRYPTION_KEY,
})
await store.init()

const freeStore = new FreeRoomConfigStore({
  dataDir: env.ROOM_CONFIG_DATA_DIR,
})
await freeStore.init()

initTranslateHandler({
  store,
  chatworkApiToken: env.CHATWORK_API_TOKEN,
})
initFreeTranslateHandler({
  store: freeStore,
  chatworkApiToken: env.CHATWORK_API_TOKEN,
  backend: new FreeTranslationBackend({
    client: new KagiClient(env.KAGI_TRANSLATOR_URL),
    defaultMaxEncodedPayloadChars: env.KAGI_MAX_ENCODED_PAYLOAD_CHARS,
    defaultMaxSegmentCount: env.KAGI_MAX_SEGMENT_COUNT,
  }),
})

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
    if (freeStore.getByOriginalRoomId(roomId) !== null) return env.QUEUE_FREE_CONCURRENCY
    if (store.getByOriginalRoomId(roomId) !== null) return env.QUEUE_STANDARD_CONCURRENCY
    return env.QUEUE_STANDARD_CONCURRENCY
  },
})
await queue.startup()

// Inject queue into router and status endpoint
initTranslationQueue(queue)
registerQueueSnapshotProvider(() => queue.getSnapshot())

const { effectiveTimeoutMs, timeoutSource } = resolvePipelineTimeout({
  envTimeoutMs: env.TRANSLATOR_PIPELINE_TIMEOUT_MS,
  hasEnvOverride: hasExplicitPipelineTimeoutOverride(),
  providerTimeoutMs: DEFAULT_TRANSLATOR_PIPELINE_TIMEOUT_MS,
})

const server = createServer({ store, freeStore })

server.listen(env.PORT)

console.log(`[translator] AI Translation Service started on port ${env.PORT.toString()}`)
logStartupBanner({
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  effectiveTimeoutMs,
  timeoutSource,
  roomCount: store.list().length,
})
console.log(`[translator] Health check: http://localhost:${env.PORT.toString()}/health`)
console.log(`[translator] Status endpoint: http://localhost:${env.PORT.toString()}/status`)
console.log(`[translator] Room config API: http://localhost:${env.PORT.toString()}/api/rooms`)
console.log(`[translator] Free Room API: http://localhost:${env.PORT.toString()}/api/free-rooms`)
console.log(`[translator] Providers API: http://localhost:${env.PORT.toString()}/api/providers`)
if (env.NODE_ENV === 'development') {
  console.log(`[translator] Swagger UI: http://localhost:${env.PORT.toString()}/docs`)
}

async function shutdown() {
  console.log('\n[translator] Shutting down gracefully...')

  // Drain queue first (30s timeout)
  await queue.shutdown()

  // Flush logs
  await asyncLogger.shutdown()

  // Close HTTP connection pool
  const { httpAgent } = await import('@chatwork-bot/chatwork')
  await httpAgent?.close()

  // Stop accepting new requests
  void server.stop()

  console.log('[translator] Server stopped cleanly')
  process.exit(0)
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())
```

> **Note on imports**: `handleTranslateRequest` and `handleFreeTranslateRequest` must be exported from their respective handler files. Check if they are currently exported — if not, add named exports alongside the existing `init*` exports.

- [ ] **Step 11.2: Check handler exports**

Run:

```bash
grep -n "^export function\|^export const\|^export async" packages/translator/src/webhook/handler.ts packages/translator/src/webhook/free-handler.ts
```

If `handleTranslateRequest` / `handleFreeTranslateRequest` are not exported, add `export` keyword to their function declarations. They are used in the processor callback in index.ts.

- [ ] **Step 11.3: Verify typecheck**

```bash
bun run --cwd packages/translator typecheck
```

Expected: no errors. If there are import errors for handler functions, fix exports per Step 11.2.

- [ ] **Step 11.4: Run all translator tests**

```bash
bun test packages/translator/
```

Expected: all tests PASS (existing tests should not be broken).

- [ ] **Step 11.5: Commit**

```bash
git add packages/translator/src/index.ts packages/translator/src/webhook/handler.ts packages/translator/src/webhook/free-handler.ts
git commit -m "feat(translator): bootstrap TranslationQueue in startup, inject into router and status"
```

---

## Task 12: Update docker-compose.yml

**Files:**

- Modify: `docker-compose.yml`

- [ ] **Step 12.1: Add stop_grace_period + queue env vars to translator service**

In `docker-compose.yml`, find the `translator:` service and add `stop_grace_period: 35s` and the 3 queue env vars.

The translator service section should include:

```yaml
translator:
  stop_grace_period: 35s # Allow 35s for graceful shutdown (queue drains in 30s)
  environment:
    # ... existing env vars ...
    QUEUE_MAX_DEPTH_PER_ROOM: ${QUEUE_MAX_DEPTH_PER_ROOM:-10}
    QUEUE_STANDARD_CONCURRENCY: ${QUEUE_STANDARD_CONCURRENCY:-3}
    QUEUE_FREE_CONCURRENCY: ${QUEUE_FREE_CONCURRENCY:-1}
```

- [ ] **Step 12.2: Update KAGI_MAX_QUEUE_WAIT_MS default**

In the kagi-sidecar (or kagi-translator) service, change:

```yaml
KAGI_MAX_QUEUE_WAIT_MS: ${KAGI_MAX_QUEUE_WAIT_MS:-15000}
```

to:

```yaml
KAGI_MAX_QUEUE_WAIT_MS: ${KAGI_MAX_QUEUE_WAIT_MS:-120000}
```

- [ ] **Step 12.3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(infra): add queue env vars, stop_grace_period, increase KAGI_MAX_QUEUE_WAIT_MS to 120s"
```

---

## Task 13: Full quality gate

- [ ] **Step 13.1: Run all tests**

```bash
bun run test
```

Expected: all tests PASS, including new message-queue tests.

- [ ] **Step 13.2: Run typecheck across all packages**

```bash
bun run typecheck
```

Expected: no errors.

- [ ] **Step 13.3: Run lint**

```bash
bun run lint
```

Expected: no errors. If there are lint errors, fix them before continuing.

- [ ] **Step 13.4: Verify Definition of Done**

Manually verify or add to automated test:

- Gửi 6 messages liên tiếp vào free room trong 20s → tất cả 6 bản dịch xuất hiện đúng thứ tự (6/6)
- `GET /status` → response includes `queue: { totalPending, totalActive, rooms: [...] }`
- Translator restart → pending files archived, new session starts clean
- Log stream shows `queue_item_enqueued`, `queue_item_processing`, `queue_item_processed` events

- [ ] **Step 13.5: Final commit**

```bash
git commit -m "feat(message-queue): FIFO queue implementation complete — resolves burst message loss"
```

---

## Self-Review Checklist

### Spec Coverage

| Spec Section                                               | Covered by Task                                           |
| ---------------------------------------------------------- | --------------------------------------------------------- |
| QueueItem type                                             | Task 2                                                    |
| QueuePersistence (atomic write, FIFO, archive)             | Task 3                                                    |
| RoomQueue (concurrency, consumer loop, FIFO)               | Task 4                                                    |
| TranslationQueue (facade, lifecycle)                       | Task 5                                                    |
| Package exports                                            | Task 6                                                    |
| tsconfig paths                                             | Task 7                                                    |
| Env schema (3 vars)                                        | Task 8                                                    |
| /status integration (QueueHealthSnapshot)                  | Task 9                                                    |
| Router (queue.enqueue, initTranslationQueue)               | Task 10                                                   |
| Bootstrap (index.ts, shutdown hook)                        | Task 11                                                   |
| docker-compose (stop_grace_period, env vars, Kagi timeout) | Task 12                                                   |
| Observability (log events)                                 | Task 4 (RoomQueue logs) + Task 5 (enqueued/rejected logs) |
| Testing (real file I/O, unit tests)                        | Tasks 3, 4, 5                                             |
| Failure modes: QUEUE_FULL, WRITE_ERROR                     | Tasks 3, 4, 5                                             |
| Failure modes: processor throw → skip                      | Task 4                                                    |
| Graceful shutdown (30s)                                    | Task 5, Task 11                                           |
| Acceptance criteria 1-8                                    | Tasks 3-13                                                |

### Type Consistency

| Type / Method                         | Defined in                        | Used in             |
| ------------------------------------- | --------------------------------- | ------------------- |
| `QueueItem`                           | Task 2 (types.ts)                 | Tasks 3, 4, 5       |
| `EnqueueResult`                       | Task 2 (types.ts)                 | Tasks 4, 5, 10      |
| `Processor`                           | Task 2 (types.ts)                 | Tasks 4, 5, 11      |
| `ResolveConcurrency`                  | Task 2 (types.ts)                 | Tasks 5, 11         |
| `QueueHealthSnapshot`                 | Task 2 (types.ts)                 | Tasks 5, 9          |
| `QueueRoomSnapshot`                   | Task 2 (types.ts)                 | Tasks 4, 5          |
| `QueuePersistence`                    | Task 3                            | Tasks 4, 5          |
| `RoomQueue`                           | Task 4                            | Task 5              |
| `TranslationQueue`                    | Task 5                            | Tasks 10, 11        |
| `initTranslationQueue`                | Task 10 (router.ts)               | Task 11 (index.ts)  |
| `registerQueueSnapshotProvider`       | Task 9 (observability-runtime.ts) | Task 11 (index.ts)  |
| `removeItem(roomId, item: QueueItem)` | Task 3 (persistence)              | Task 4 (room-queue) |
