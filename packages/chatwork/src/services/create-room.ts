import { chatworkApiClient } from '~/http/chatwork-api-client'
import type { CreateRoomParams, CreateRoomResult } from '~/types/room'

export async function createRoom(
  params: CreateRoomParams,
  token: string,
): Promise<CreateRoomResult> {
  return chatworkApiClient.createRoom(params, token)
}
