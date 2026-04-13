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
  return async () => {
    // No-op processor for testing
  }
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
      const processor: Processor = (command) => {
        processed.push(command.sourceRoomId)
        return Promise.resolve()
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
      let holdRelease!: () => void
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

      holdRelease()
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
      let holdRelease!: () => void
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
      holdRelease()

      await shutdownPromise
      expect(completed).toContain('msg-1')
    })
  })

  describe('getSnapshot', () => {
    it('returns accurate totals across rooms', async () => {
      let holdRelease!: () => void
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

      holdRelease()
    })
  })
})
