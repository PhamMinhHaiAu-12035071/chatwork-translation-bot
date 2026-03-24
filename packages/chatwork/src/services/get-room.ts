import { chatworkApiClient } from '~/http/chatwork-api-client'
import type { Room } from '~/types/room'

export async function getRoom(roomId: number, token: string): Promise<Room> {
  return chatworkApiClient.getRoom(roomId, token)
}
