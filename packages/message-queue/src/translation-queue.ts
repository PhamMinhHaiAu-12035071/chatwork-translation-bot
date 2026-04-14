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
      totalPending: allRooms.reduce((sum, room) => sum + room.pending, 0),
      totalActive: allRooms.reduce((sum, room) => sum + room.active, 0),
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
