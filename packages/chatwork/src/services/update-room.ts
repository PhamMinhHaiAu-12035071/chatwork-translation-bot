import { chatworkApiClient } from '~/http/chatwork-api-client'
import type { UpdateRoomParams } from '~/types/room'

export async function updateRoom(
  roomId: number,
  params: UpdateRoomParams,
  token: string,
): Promise<void> {
  return chatworkApiClient.updateRoom(roomId, params, token)
}
