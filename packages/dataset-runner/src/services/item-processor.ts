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

    return {
      status: 'sent',
      sourceMessageId: source.message_id,
    }
  } catch (error) {
    return {
      status: 'failed',
      errorCode: 'CHATWORK_API',
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  }
}
