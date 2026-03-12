import { chatworkApiClient } from '~/http/chatwork-api-client'

export async function deleteRoomMessage(
  roomId: number,
  messageId: string,
  token: string,
): Promise<void> {
  return chatworkApiClient.deleteRoomMessage(roomId, messageId, token)
}
