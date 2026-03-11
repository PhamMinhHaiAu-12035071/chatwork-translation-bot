import type { IChatworkClient } from '@chatwork-bot/core'
import { writeAutomationSourceMapEntry } from '~/services/source-map'
import type { PendingDatasetRecord } from '~/types/dataset'

export type ItemProcessResult =
  | { status: 'sent'; sourceMessageId: string }
  | { status: 'failed'; errorCode: string; errorMessage: string; sourceMessageId?: string }

export async function processDatasetItem(
  record: PendingDatasetRecord,
  config: {
    inputDir: string
    chatworkClient: IChatworkClient
    defaultOriginalRoomId: number
  },
): Promise<ItemProcessResult> {
  const roomId = record.item.originalRoomId ?? config.defaultOriginalRoomId
  console.log(
    JSON.stringify({
      level: 'info',
      service: 'dataset-runner',
      event: 'dataset_item_send_started',
      timestamp: new Date().toISOString(),
      datasetFile: record.fileName,
      datasetItemId: record.item.id,
      datasetLineNumber: record.lineNumber,
      roomId,
    }),
  )

  try {
    const source = await config.chatworkClient.sendMessage({
      roomId,
      message: record.item.message,
    })

    await writeAutomationSourceMapEntry(config.inputDir, {
      sourceMessageId: source.message_id,
      datasetFile: record.fileName,
      datasetItemId: record.item.id,
      datasetLineNumber: record.lineNumber,
      sentAt: new Date().toISOString(),
    })

    console.log(
      JSON.stringify({
        level: 'info',
        service: 'dataset-runner',
        event: 'dataset_item_send_completed',
        timestamp: new Date().toISOString(),
        sourceMessageId: source.message_id,
        datasetFile: record.fileName,
        datasetItemId: record.item.id,
        datasetLineNumber: record.lineNumber,
        roomId,
      }),
    )

    return {
      status: 'sent',
      sourceMessageId: source.message_id,
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        service: 'dataset-runner',
        event: 'dataset_item_send_failed',
        timestamp: new Date().toISOString(),
        datasetFile: record.fileName,
        datasetItemId: record.item.id,
        datasetLineNumber: record.lineNumber,
        roomId,
        errorCode: 'CHATWORK_API',
        errorMessage: error instanceof Error ? error.message : String(error),
      }),
    )

    return {
      status: 'failed',
      errorCode: 'CHATWORK_API',
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  }
}
