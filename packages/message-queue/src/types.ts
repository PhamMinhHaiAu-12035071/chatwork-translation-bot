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
