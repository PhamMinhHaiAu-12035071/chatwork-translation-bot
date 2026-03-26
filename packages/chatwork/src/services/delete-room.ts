import { chatworkApiClient } from '~/http/chatwork-api-client'

export async function deleteRoom(roomId: number, token: string): Promise<void> {
  return chatworkApiClient.deleteRoom(roomId, token)
}
