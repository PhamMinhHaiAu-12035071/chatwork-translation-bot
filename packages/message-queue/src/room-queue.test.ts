// packages/message-queue/src/room-queue.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
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
  return async () => {
    // No-op processor for testing
  }
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
      let holdRelease!: () => void
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
      holdRelease()
    })

    it('persists item to disk on accept', async () => {
      const item = makeItem()

      // Block consumer so item stays on disk long enough to check
      let holdRelease!: () => void
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

      holdRelease()
    })
  })

  describe('consumer: FIFO processing order', () => {
    it('processes items in enqueue order (concurrency=1)', async () => {
      const processed: string[] = []
      const processor: Processor = (command) => {
        processed.push(command.sourceMessageId)
        return Promise.resolve()
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
      let holdRelease!: () => void
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

      holdRelease()
    })
  })

  describe('consumer: failure handling', () => {
    it('skips failed item and continues with next item', async () => {
      const processed: string[] = []
      let callCount = 0
      const processor: Processor = (command) => {
        callCount++
        if (command.sourceMessageId === 'msg-fail') {
          return Promise.reject(new Error('Simulated translation failure'))
        }
        processed.push(command.sourceMessageId)
        return Promise.resolve()
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
      const processor: Processor = (command) => {
        processed.push(command.sourceMessageId)
        return Promise.resolve()
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
      let holdRelease!: () => void
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

      holdRelease()
    })
  })

  describe('depth counting', () => {
    it('depth decreases after item is processed and removed', async () => {
      const processed: string[] = []
      const processor: Processor = (command) => {
        processed.push(command.sourceMessageId)
        return Promise.resolve()
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
})
