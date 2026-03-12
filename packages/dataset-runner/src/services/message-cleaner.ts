import { deleteRoomMessage } from '@chatwork-bot/chatwork'

export interface MessageCleanupPair {
  sourceRoomId: number
  sourceMessageId: string
  destRoomId?: number
  destMessageId?: string
}

export async function cleanupMessages(pair: MessageCleanupPair, apiToken: string): Promise<void> {
  try {
    await deleteRoomMessage(pair.sourceRoomId, pair.sourceMessageId, apiToken)
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'warn',
        service: 'dataset-runner',
        event: 'dataset_cleanup_failed',
        target: 'source',
        roomId: pair.sourceRoomId,
        messageId: pair.sourceMessageId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }),
    )
  }

  if (pair.destRoomId === undefined || pair.destMessageId === undefined) return

  try {
    await deleteRoomMessage(pair.destRoomId, pair.destMessageId, apiToken)
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'warn',
        service: 'dataset-runner',
        event: 'dataset_cleanup_failed',
        target: 'destination',
        roomId: pair.destRoomId,
        messageId: pair.destMessageId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }),
    )
  }
}
