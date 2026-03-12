import { chatworkApiClient } from '~/http/chatwork-api-client'
import type { ChatworkSendMessageResult } from '~/types/message'

export async function sendRoomMessage(
  roomId: number,
  message: string,
  token: string,
): Promise<ChatworkSendMessageResult> {
  return chatworkApiClient.sendRoomMessage(roomId, message, token)
}
