import { chatworkApiClient } from '~/http/chatwork-api-client'
import type { ChatworkMessage } from '~/types/message'

export async function getRoomMessage(
  roomId: number,
  messageId: string,
  token: string,
): Promise<ChatworkMessage> {
  return chatworkApiClient.getRoomMessage(roomId, messageId, token)
}
