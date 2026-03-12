import { appendFile, mkdir, readdir, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { AckCoordinator } from '~/services/ack-coordinator'
import { listPendingDatasetFiles, loadDatasetRecords } from '~/services/dataset-loader'
import { clearDeliveryAck, readDeliveryAck, writeDeliveryAck } from '~/services/ack-store'
import { processDatasetItem } from '~/services/item-processor'
import { applyStartupReset } from '~/services/reset-planner'
import {
  acquireRunnerLock,
  readDatasetState,
  releaseRunnerLock,
  startRunnerLockHeartbeat,
  writeDatasetState,
} from '~/services/state-store'
import type { DeliveryAckRecord } from '~/services/ack-store'
import type { DatasetFileState, RunnerStatusSnapshot } from '~/types/status'

type PendingRecord = Awaited<ReturnType<typeof loadDatasetRecords>>[number]

export class QueueRunner {
  private readonly status: RunnerStatusSnapshot
  private readonly ackCoordinator = new AckCoordinator()
  private readonly shutdownSignal: Promise<void>
  private shutdownRequested = false
  private resolveShutdown!: () => void

  constructor(
    private readonly config: {
      autorun: boolean
      inputDir: string
      outputBaseDir: string
      defaultOriginalRoomId: number
      apiToken: string
      cooldownMs: number
      maxRetries: number
      timeoutMs: number
      resetMode: 'resume' | 'from-start' | 'from-line'
      resetFile?: string
      resetLine?: number
      resetConfirm?: string
      clearFailed: boolean
      clearOutput: boolean
    },
  ) {
    this.shutdownSignal = new Promise<void>((resolve) => {
      this.resolveShutdown = resolve
    })

    this.status = {
      mode: 'idle',
      autorun: config.autorun,
      pendingFiles: 0,
      completedCount: 0,
      failedCount: 0,
      updatedAt: new Date().toISOString(),
    }
  }

  getStatus(): RunnerStatusSnapshot {
    return this.status
  }

  async handleDeliveryAck(ack: DeliveryAckRecord): Promise<void> {
    let persisted: DeliveryAckRecord
    try {
      persisted = await writeDeliveryAck(this.config.inputDir, ack)
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'divergent-ack',
          sourceMessageId: ack.sourceMessageId,
          receivedStatus: ack.status,
          error: String(error),
        }),
      )
      throw error
    }
    this.ackCoordinator.notify(persisted)
  }

  private backoffMs(sendAttempt: number): number {
    return 2000 * 2 ** (sendAttempt - 1)
  }

  private ackHeartbeatMs(): number {
    return Math.min(30_000, Math.max(1_000, Math.floor(this.config.timeoutMs / 3)))
  }

  private shouldStop(): boolean {
    return this.shutdownRequested
  }

  private logEvent(
    level: 'info' | 'warn' | 'error',
    event: string,
    extra: Record<string, unknown> = {},
  ): void {
    console[level === 'error' ? 'error' : 'log'](
      JSON.stringify({
        level,
        service: 'dataset-runner',
        event,
        timestamp: new Date().toISOString(),
        ...extra,
      }),
    )
  }

  private async sleepOrShutdown(ms: number): Promise<boolean> {
    if (this.shouldStop()) return true

    await Promise.race([Bun.sleep(ms), this.shutdownSignal])
    return this.shouldStop()
  }

  private async waitForTerminalAck(
    sourceMessageId: string,
    meta: { fileName: string; itemId: string; lineNumber: number },
  ): Promise<DeliveryAckRecord | null> {
    const durableAck = await readDeliveryAck(this.config.inputDir, sourceMessageId)
    if (durableAck) return durableAck

    const startedAt = Date.now()
    const heartbeat = setInterval(() => {
      if (this.shutdownRequested) return

      this.logEvent('warn', 'dataset_ack_wait_heartbeat', {
        sourceMessageId,
        datasetFile: meta.fileName,
        datasetItemId: meta.itemId,
        datasetLineNumber: meta.lineNumber,
        elapsedMs: Date.now() - startedAt,
        timeoutMs: this.config.timeoutMs,
      })
    }, this.ackHeartbeatMs())

    heartbeat.unref()

    try {
      return await Promise.race([
        this.ackCoordinator.waitForAck(sourceMessageId, this.config.timeoutMs),
        this.shutdownSignal.then(() => null),
      ])
    } catch {
      if (this.shouldStop()) return null
      return await readDeliveryAck(this.config.inputDir, sourceMessageId)
    } finally {
      clearInterval(heartbeat)
    }
  }

  private async markRecordSucceeded(
    fileName: string,
    state: DatasetFileState,
    record: PendingRecord,
  ): Promise<DatasetFileState> {
    const { inFlight: _inFlight, ...rest } = state
    const nextState: DatasetFileState = {
      ...rest,
      nextLineNumber: record.lineNumber + 1,
      completedItemIds: [...state.completedItemIds, record.item.id],
      updatedAt: new Date().toISOString(),
    }

    await writeDatasetState(this.config.inputDir, fileName, nextState)
    this.status.completedCount += 1
    delete this.status.lastErrorCode
    delete this.status.activeSourceMessageId
    this.status.waitingForAck = false
    return nextState
  }

  private async markRecordFailed(
    fileName: string,
    state: DatasetFileState,
    record: PendingRecord,
    failure: { errorCode: string; errorMessage: string },
  ): Promise<DatasetFileState> {
    await mkdir(join(this.config.inputDir, 'failed'), { recursive: true })
    await appendFile(
      join(this.config.inputDir, 'failed', `${fileName.replace(/\.jsonl$/, '')}.failed.jsonl`),
      `${JSON.stringify({
        ...record.item,
        lineNumber: record.lineNumber,
        errorCode: failure.errorCode,
        errorMessage: failure.errorMessage,
      })}\n`,
    )

    const { inFlight: _inFlight, ...rest } = state
    const nextState: DatasetFileState = {
      ...rest,
      nextLineNumber: record.lineNumber + 1,
      failedItemIds: [...state.failedItemIds, record.item.id],
      updatedAt: new Date().toISOString(),
    }

    await writeDatasetState(this.config.inputDir, fileName, nextState)
    this.status.failedCount += 1
    this.status.lastErrorCode = failure.errorCode
    delete this.status.activeSourceMessageId
    this.status.waitingForAck = false
    return nextState
  }

  async run(): Promise<void> {
    if (!this.config.autorun) return

    const lock = await acquireRunnerLock(this.config.inputDir, 30_000)
    const lockHeartbeat = startRunnerLockHeartbeat(lock, 5_000)

    try {
      const resetSummary = await applyStartupReset({
        inputDir: this.config.inputDir,
        outputDir: this.config.outputBaseDir,
        mode: this.config.resetMode,
        ...(this.config.resetFile !== undefined ? { fileName: this.config.resetFile } : {}),
        ...(this.config.resetLine !== undefined ? { lineNumber: this.config.resetLine } : {}),
        ...(this.config.resetConfirm !== undefined
          ? { confirmToken: this.config.resetConfirm }
          : {}),
        clearFailed: this.config.clearFailed,
        clearOutput: this.config.clearOutput,
      })

      if (resetSummary) {
        this.status.lastResetMode = resetSummary.mode
        this.status.lastResetAt = resetSummary.appliedAt
      }

      for (;;) {
        if (this.shouldStop()) return

        const files = await listPendingDatasetFiles(this.config.inputDir)
        this.status.pendingFiles = files.length
        this.status.updatedAt = new Date().toISOString()

        if (files.length === 0) {
          this.status.mode = 'idle'
          if (await this.sleepOrShutdown(2000)) return
          continue
        }

        this.status.mode = 'running'

        for (const file of files) {
          if (this.shouldStop()) return

          let state = (await readDatasetState(this.config.inputDir, file.fileName)) ?? {
            fileName: file.fileName,
            nextLineNumber: 1,
            completedItemIds: [],
            failedItemIds: [],
            updatedAt: new Date().toISOString(),
          }

          const records = await loadDatasetRecords(file)
          const pending = records.filter((record) => record.lineNumber >= state.nextLineNumber)

          for (const record of pending) {
            if (this.shouldStop()) return

            let workingState = state
            this.status.activeFile = file.fileName
            this.status.activeItemId = record.item.id
            this.status.activeLineNumber = record.lineNumber
            delete this.status.activeSourceMessageId
            this.status.waitingForAck = false
            this.status.updatedAt = new Date().toISOString()

            const resumedSourceMessageId =
              workingState.inFlight?.itemId === record.item.id &&
              workingState.inFlight.phase === 'awaiting-ack'
                ? workingState.inFlight.sourceMessageId
                : undefined

            let sourceMessageId = resumedSourceMessageId

            if (!sourceMessageId) {
              let sendAttempt = 1

              while (sendAttempt <= this.config.maxRetries && !sourceMessageId) {
                workingState = {
                  ...workingState,
                  inFlight: {
                    lineNumber: record.lineNumber,
                    itemId: record.item.id,
                    phase: 'sending',
                    attempt: sendAttempt,
                    startedAt: new Date().toISOString(),
                  },
                  updatedAt: new Date().toISOString(),
                }

                await writeDatasetState(this.config.inputDir, file.fileName, workingState)

                const result = await processDatasetItem(record, {
                  inputDir: this.config.inputDir,
                  apiToken: this.config.apiToken,
                  defaultOriginalRoomId: this.config.defaultOriginalRoomId,
                })

                if (result.status === 'sent') {
                  sourceMessageId = result.sourceMessageId
                  break
                }

                sendAttempt += 1
                if (sendAttempt <= this.config.maxRetries) {
                  if (await this.sleepOrShutdown(this.backoffMs(sendAttempt))) return
                }
              }
            }

            if (!sourceMessageId) {
              this.logEvent('error', 'dataset_hard_stop', {
                reason: 'chatwork_api_retry_exhausted',
                datasetFile: file.fileName,
                datasetItemId: record.item.id,
                datasetLineNumber: record.lineNumber,
                maxRetries: this.config.maxRetries,
              })
              await this.markRecordFailed(file.fileName, workingState, record, {
                errorCode: 'CHATWORK_API',
                errorMessage: 'Source-room send failed after retry exhaustion',
              })
              process.exit(1)
            }

            workingState = {
              ...workingState,
              inFlight: {
                lineNumber: record.lineNumber,
                itemId: record.item.id,
                phase: 'awaiting-ack',
                attempt: workingState.inFlight?.attempt ?? 1,
                sourceMessageId,
                startedAt: workingState.inFlight?.startedAt ?? new Date().toISOString(),
              },
              updatedAt: new Date().toISOString(),
            }
            await writeDatasetState(this.config.inputDir, file.fileName, workingState)

            this.status.activeSourceMessageId = sourceMessageId
            this.status.waitingForAck = true
            this.logEvent('info', 'dataset_ack_wait_started', {
              sourceMessageId,
              datasetFile: file.fileName,
              datasetItemId: record.item.id,
              datasetLineNumber: record.lineNumber,
              timeoutMs: this.config.timeoutMs,
            })

            const ack = await this.waitForTerminalAck(sourceMessageId, {
              fileName: file.fileName,
              itemId: record.item.id,
              lineNumber: record.lineNumber,
            })
            if (this.shouldStop()) return

            if (!ack) {
              this.logEvent('error', 'dataset_hard_stop', {
                reason: 'ack_timeout',
                sourceMessageId,
                datasetFile: file.fileName,
                datasetItemId: record.item.id,
                datasetLineNumber: record.lineNumber,
                timeoutMs: this.config.timeoutMs,
              })
              await this.markRecordFailed(file.fileName, workingState, record, {
                errorCode: 'CALLBACK_TIMEOUT',
                errorMessage: `No internal delivery ACK was received for ${sourceMessageId}`,
              })
              await clearDeliveryAck(this.config.inputDir, sourceMessageId)
              process.exit(1)
            }

            if (ack.status === 'failed') {
              this.logEvent('error', 'dataset_hard_stop', {
                reason: 'translation_delivery_failed',
                sourceMessageId,
                datasetFile: file.fileName,
                datasetItemId: record.item.id,
                datasetLineNumber: record.lineNumber,
                errorCode: ack.errorCode,
                errorMessage: ack.errorMessage,
              })
              await this.markRecordFailed(file.fileName, workingState, record, {
                errorCode: ack.errorCode ?? 'CALLBACK_DELIVERY_FAILED',
                errorMessage:
                  ack.errorMessage ?? 'Translator reported destination delivery failure',
              })
              await clearDeliveryAck(this.config.inputDir, sourceMessageId)
              process.exit(1)
            }

            this.logEvent('info', 'dataset_ack_received', {
              sourceMessageId,
              datasetFile: file.fileName,
              datasetItemId: record.item.id,
              datasetLineNumber: record.lineNumber,
            })
            workingState = await this.markRecordSucceeded(file.fileName, workingState, record)
            await clearDeliveryAck(this.config.inputDir, sourceMessageId)
            this.status.updatedAt = new Date().toISOString()
            state = workingState
            if (await this.sleepOrShutdown(this.config.cooldownMs)) return
          }

          // Archive the file unconditionally — failed items are captured in the DLQ.
          // The pending file is always moved to archive/ after all records are processed,
          // even if some or all records failed.
          // Archive the file and clean up source-map entries for this file
          const pendingPath = join(this.config.inputDir, 'pending', file.fileName)
          const archivePath = join(this.config.inputDir, 'archive', file.fileName)
          await mkdir(join(this.config.inputDir, 'archive'), { recursive: true })
          await rename(pendingPath, archivePath)

          // Scan source-map/ and delete entries where datasetFile === file.fileName
          const sourceMapDir = join(this.config.inputDir, 'state', 'source-map')
          try {
            const sourceMapFiles = await readdir(sourceMapDir)
            for (const smFile of sourceMapFiles) {
              const smPath = join(sourceMapDir, smFile)
              const sm = (await Bun.file(smPath).json()) as { datasetFile?: string }
              if (sm.datasetFile === file.fileName) {
                await rm(smPath, { force: true })
              }
            }
          } catch {
            // source-map dir may not exist if no automation messages were sent
          }

          console.error(
            JSON.stringify({ level: 'info', event: 'file-archived', fileName: file.fileName }),
          )
        }
      }
    } finally {
      await lockHeartbeat.stop()
      await releaseRunnerLock(lock)
    }
  }

  shutdown(): void {
    if (this.shouldStop()) return

    this.shutdownRequested = true
    this.resolveShutdown()
    console.error(JSON.stringify({ level: 'info', event: 'shutdown-requested' }))
  }
}
