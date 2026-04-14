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
      // Remove by ID instead of assuming it's still at the end
      const idx = this.items.findIndex((i) => i.id === item.id)
      if (idx !== -1) {
        this.items.splice(idx, 1)
      }
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
