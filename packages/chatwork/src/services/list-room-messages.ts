import { chatworkApiClient } from '~/http/chatwork-api-client'
import type { ChatworkMessage } from '~/types/message'

export async function listRoomMessages(
  roomId: number,
  token: string,
  force?: boolean,
): Promise<ChatworkMessage[]> {
  return chatworkApiClient.listRoomMessages(roomId, token, force)
}
