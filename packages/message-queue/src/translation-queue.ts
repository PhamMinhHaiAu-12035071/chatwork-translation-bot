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
          rooms: finalSnapshot.rooms,
        }),
      )
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
