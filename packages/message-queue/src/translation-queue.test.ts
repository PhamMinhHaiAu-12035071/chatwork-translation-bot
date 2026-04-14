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
  return () => Promise.resolve()
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

  describe('enqueue - fan-out', () => {
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
        standardProcessor: (command) => {
          standardProcessed.push(command.sourceMessageId)
          return Promise.resolve()
        },
        freeProcessor: (command) => {
          freeProcessed.push(command.sourceMessageId)
          return Promise.resolve()
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
        standardProcessor: (command) => {
          standardProcessed.push(command.sourceMessageId)
          return Promise.resolve()
        },
        freeProcessor: (command) => {
          freeProcessed.push(command.sourceMessageId)
          return Promise.resolve()
        },
      })
      await queue.startup()

      await queue.enqueue(STANDARD_ROOM, makeCommand(STANDARD_ROOM, 'msg-std-only'), 'trace-1')

      await waitFor(() => standardProcessed.includes('msg-std-only'))
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
        standardProcessor: (command) => {
          standardProcessed.push(command.sourceMessageId)
          return Promise.resolve()
        },
        freeProcessor: (command) => {
          freeProcessed.push(command.sourceMessageId)
          return Promise.resolve()
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

  describe('isolation - standard and free process independently', () => {
    it('standard processor completes without waiting for free processor', async () => {
      const completionOrder: string[] = []
      let freeRelease!: () => void
      const freeBarrier = new Promise<void>((resolve) => {
        freeRelease = resolve
      })

      const queue = makeQueue({
        hasStandardConfig: () => true,
        hasFreeConfig: () => true,
        standardProcessor: () => {
          completionOrder.push('standard')
          return Promise.resolve()
        },
        freeProcessor: async () => {
          await freeBarrier
          completionOrder.push('free')
        },
      })
      await queue.startup()

      await queue.enqueue(STANDARD_ROOM, makeCommand(STANDARD_ROOM, 'msg-iso'), 'trace-iso')

      await waitFor(() => completionOrder.includes('standard'))

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
        standardProcessor: (command) => {
          processed.push(command.sourceMessageId)
          return Promise.resolve()
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
        freeProcessor: (command) => {
          processed.push(command.sourceMessageId)
          return Promise.resolve()
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
      expect(snapshot.totalActive).toBe(2)

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
