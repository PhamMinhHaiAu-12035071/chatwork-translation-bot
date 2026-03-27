import type {
  ChatworkMe,
  ChatworkMember,
  ChatworkMessage,
  ChatworkSendMessageResult,
} from '~/types/message'
import type { CreateRoomParams, CreateRoomResult, Room, UpdateRoomParams } from '~/types/room'

export interface IChatworkApiClient {
  getMe(token: string): Promise<ChatworkMe>

  sendRoomMessage(
    roomId: number,
    message: string,
    token: string,
  ): Promise<ChatworkSendMessageResult>

  deleteRoomMessage(roomId: number, messageId: string, token: string): Promise<void>

  deleteRoom(roomId: number, token: string): Promise<void>

  getRoomMembers(roomId: number, token: string): Promise<ChatworkMember[]>

  getRoomMessage(roomId: number, messageId: string, token: string): Promise<ChatworkMessage>

  listRoomMessages(roomId: number, token: string, force?: boolean): Promise<ChatworkMessage[]>

  getRoom(roomId: number, token: string): Promise<Room>

  createRoom(params: CreateRoomParams, token: string): Promise<CreateRoomResult>

  updateRoom(roomId: number, params: UpdateRoomParams, token: string): Promise<void>
}
