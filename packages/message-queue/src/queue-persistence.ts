// packages/message-queue/src/queue-persistence.ts
import { mkdir, open, readdir, readFile, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import type { QueueItem } from './types'

interface QueuePersistenceOptions {
  baseDir: string
}

function isEnoentError(err: unknown): boolean {
  return err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT'
}

const QueueItemSchema = z.object({
  id: z.string(),
  sourceRoomId: z.number(),
  sourceMessageId: z.string(),
  traceId: z.string(),
  command: z.any(), // TranslationIngressCommand from @chatwork-bot/core
  enqueuedAt: z.string(),
})

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
    return `${epoch.toString()}-${item.id}.json`
  }

  async writeItem(roomId: number, item: QueueItem): Promise<void> {
    const dir = this.roomDir(roomId)
    await mkdir(dir, { recursive: true })

    const filename = this.itemFilename(item)
    const finalPath = join(dir, filename)
    const tmpPath = `${finalPath}.tmp`

    // Write with explicit fsync for durability
    const handle = await open(tmpPath, 'w')
    try {
      await handle.writeFile(JSON.stringify(item), 'utf-8')
      await handle.sync() // Force fsync to disk
    } finally {
      await handle.close()
    }

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
      try {
        const content = await readFile(join(dir, filename), 'utf-8')
        const parsed = JSON.parse(content) as unknown
        const validated = QueueItemSchema.parse(parsed)
        items.push(validated as QueueItem)
      } catch (error) {
        console.error(
          JSON.stringify({
            level: 'error',
            service: 'translator',
            event: 'queue_persistence_corrupted_file',
            timestamp: new Date().toISOString(),
            filename,
            roomId,
            errorMessage: error instanceof Error ? error.message : String(error),
          }),
        )
        // Skip corrupted file instead of crashing
      }
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
