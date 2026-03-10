export interface RunnerStatusSnapshot {
  mode: 'idle' | 'running'
  autorun: boolean
  pendingFiles: number
  activeFile?: string
  activeItemId?: string
  activeLineNumber?: number
  activeSourceMessageId?: string
  waitingForAck?: boolean
  completedCount: number
  failedCount: number
  lastResetMode?: 'from-start' | 'from-line'
  lastResetAt?: string
  lastErrorCode?: string
  updatedAt: string
}

export interface DatasetFileState {
  fileName: string
  nextLineNumber: number
  completedItemIds: string[]
  failedItemIds: string[]
  inFlight?: {
    lineNumber: number
    itemId: string
    phase: 'sending' | 'awaiting-ack'
    attempt: number
    sourceMessageId?: string
    startedAt: string
  }
  updatedAt: string
}
