import { appendFile, mkdir, readdir, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { ChatworkClient } from '@chatwork-bot/core'
import { AckCoordinator } from '~/services/ack-coordinator'
import { listPendingDatasetFiles, loadDatasetRecords } from '~/services/dataset-loader'
import { clearDeliveryAck, readDeliveryAck, writeDeliveryAck } from '~/services/ack-store'
import { processDatasetItem } from '~/services/item-processor'
import { applyStartupReset } from '~/services/reset-planner'
import {
  acquireRunnerLock,
  heartbeatRunnerLock,
  readDatasetState,
  releaseRunnerLock,
  writeDatasetState,
} from '~/services/state-store'
import type { DeliveryAckRecord } from '~/services/ack-store'
import type { DatasetFileState, RunnerStatusSnapshot } from '~/types/status'

type PendingRecord = Awaited<ReturnType<typeof loadDatasetRecords>>[number]

export class QueueRunner {
  private readonly status: RunnerStatusSnapshot
  private readonly ackCoordinator = new AckCoordinator()

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
      clearFailed: boolean
      clearOutput: boolean
    },
  ) {
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

  private async waitForTerminalAck(sourceMessageId: string): Promise<DeliveryAckRecord | null> {
    const durableAck = await readDeliveryAck(this.config.inputDir, sourceMessageId)
    if (durableAck) return durableAck

    try {
      return await this.ackCoordinator.waitForAck(sourceMessageId, this.config.timeoutMs)
    } catch {
      return await readDeliveryAck(this.config.inputDir, sourceMessageId)
    }
  }

  private async markRecordSucceeded(
    fileName: string,
    state: DatasetFileState,
    record: PendingRecord,
  ): Promise<DatasetFileState> {
    const nextState: DatasetFileState = {
      ...state,
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

    const nextState: DatasetFileState = {
      ...state,
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

    const lock = await acquireRunnerLock(
      this.config.inputDir,
      Math.max(this.config.timeoutMs, 60_000),
    )
    const client = new ChatworkClient({ apiToken: this.config.apiToken })

    try {
      const resetSummary = await applyStartupReset({
        inputDir: this.config.inputDir,
        outputDir: this.config.outputBaseDir,
        mode: this.config.resetMode,
        ...(this.config.resetFile !== undefined ? { fileName: this.config.resetFile } : {}),
        ...(this.config.resetLine !== undefined ? { lineNumber: this.config.resetLine } : {}),
        clearFailed: this.config.clearFailed,
        clearOutput: this.config.clearOutput,
      })

      if (resetSummary) {
        this.status.lastResetMode = resetSummary.mode
        this.status.lastResetAt = resetSummary.appliedAt
      }

      for (;;) {
        await heartbeatRunnerLock(lock)
        const files = await listPendingDatasetFiles(this.config.inputDir)
        this.status.pendingFiles = files.length
        this.status.updatedAt = new Date().toISOString()

        if (files.length === 0) {
          this.status.mode = 'idle'
          await Bun.sleep(2000)
          continue
        }

        this.status.mode = 'running'

        for (const file of files) {
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
                  chatworkClient: client,
                  defaultOriginalRoomId: this.config.defaultOriginalRoomId,
                })

                if (result.status === 'sent') {
                  sourceMessageId = result.sourceMessageId
                  break
                }

                sendAttempt += 1
                if (sendAttempt <= this.config.maxRetries) {
                  await Bun.sleep(this.backoffMs(sendAttempt - 1))
                }
              }
            }

            if (!sourceMessageId) {
              workingState = await this.markRecordFailed(file.fileName, workingState, record, {
                errorCode: 'CHATWORK_API',
                errorMessage: 'Source-room send failed after retry exhaustion',
              })
              state = workingState
              continue
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

            const ack = await this.waitForTerminalAck(sourceMessageId)

            if (!ack) {
              workingState = await this.markRecordFailed(file.fileName, workingState, record, {
                errorCode: 'CALLBACK_TIMEOUT',
                errorMessage: `No internal delivery ACK was received for ${sourceMessageId}`,
              })
              await clearDeliveryAck(this.config.inputDir, sourceMessageId)
              state = workingState
              continue
            }

            if (ack.status === 'failed') {
              workingState = await this.markRecordFailed(file.fileName, workingState, record, {
                errorCode: ack.errorCode ?? 'CALLBACK_DELIVERY_FAILED',
                errorMessage:
                  ack.errorMessage ?? 'Translator reported destination delivery failure',
              })
              await clearDeliveryAck(this.config.inputDir, sourceMessageId)
              state = workingState
              continue
            }

            workingState = await this.markRecordSucceeded(file.fileName, workingState, record)
            await clearDeliveryAck(this.config.inputDir, sourceMessageId)
            this.status.updatedAt = new Date().toISOString()
            state = workingState
            await Bun.sleep(this.config.cooldownMs)
          }

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
      await releaseRunnerLock(lock)
    }
  }

  shutdown(): void {
    console.error(JSON.stringify({ level: 'info', event: 'shutdown-requested' }))
  }
}
