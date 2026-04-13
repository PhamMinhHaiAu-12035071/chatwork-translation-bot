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
      await persistence.removeItem(424846369, item)
      // If we get here without throwing, the test passes
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
      await persistence.archiveAll()
      // If we get here without throwing, the test passes
    })

    it('is a no-op when pending/ is empty', async () => {
      await mkdir(join(tmpDir, 'pending'), { recursive: true })
      await persistence.archiveAll()
      // If we get here without throwing, the test passes
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
