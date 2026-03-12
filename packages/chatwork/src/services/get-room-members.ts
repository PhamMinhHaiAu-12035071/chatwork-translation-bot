import { chatworkApiClient } from '~/http/chatwork-api-client'
import type { ChatworkMember } from '~/types/message'

export async function getRoomMembers(roomId: number, token: string): Promise<ChatworkMember[]> {
  return chatworkApiClient.getRoomMembers(roomId, token)
}
