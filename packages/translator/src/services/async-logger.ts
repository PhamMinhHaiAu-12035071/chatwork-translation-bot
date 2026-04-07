export interface LogEntry {
  level: 'info' | 'warn' | 'error'
  message: string
  [key: string]: unknown
}

export interface AsyncLoggerConfig {
  maxBufferSize?: number
  flushIntervalMs?: number
  writer?: (output: string) => Promise<void> | void
}

export class AsyncLogger {
  private buffer: LogEntry[] = []
  private flushTimer: Timer | null = null
  private readonly maxBufferSize: number
  private readonly flushIntervalMs: number
  private readonly writer: (output: string) => Promise<void> | void
  private isShuttingDown = false

  constructor(config: AsyncLoggerConfig = {}) {
    this.maxBufferSize = config.maxBufferSize ?? 50
    this.flushIntervalMs = config.flushIntervalMs ?? 100
    this.writer =
      config.writer ??
      (async (output) => {
        await Bun.write(Bun.stdout, output)
      })
  }

  log(entry: LogEntry): void {
    if (this.isShuttingDown) {
      console.warn('Logger is shutting down, log entry dropped')
      return
    }

    this.buffer.push(entry)

    if (this.buffer.length >= this.maxBufferSize) {
      void this.flushAsync()
    } else {
      this.flushTimer ??= setTimeout(() => void this.flushAsync(), this.flushIntervalMs)
    }
  }

  private async flushAsync(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }

    if (this.buffer.length === 0) return

    const batch = this.buffer.splice(0, this.buffer.length)
    const output = batch.map((e) => JSON.stringify(e)).join('\n') + '\n'

    try {
      await this.writer(output)
    } catch (error) {
      console.error('AsyncLogger flush failed:', error)
    }
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true
    await this.flushAsync()
  }
}

// Singleton instance
export const asyncLogger = new AsyncLogger()
