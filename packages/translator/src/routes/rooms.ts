import { createRoomRoutesFactory } from '~/routes/create-room-routes-factory'
import { RoomConfigStoreError } from '~/services/room-config-store'
import {
  CreateRoomRequestSchema,
  UpdateRoomRequestSchema,
  redactRoomConfig,
} from '~/types/room-config'
import type { RoomConfigStore } from '~/services/room-config-store'

interface RoomsRoutesOptions {
  store: RoomConfigStore
  chatworkApiToken: string
  chatworkBotAccountId: number
}

export function createRoomsRoutes({
  store,
  chatworkApiToken,
  chatworkBotAccountId,
}: RoomsRoutesOptions) {
  return createRoomRoutesFactory({
    store,
    chatworkApiToken,
    chatworkBotAccountId,
    basePath: 'rooms',
    entityName: 'Room',
    elysiaName: 'translator:rooms',
    createRequestSchema: CreateRoomRequestSchema,
    updateRequestSchema: UpdateRoomRequestSchema,
    StoreErrorClass: RoomConfigStoreError,
    logEventPrefix: 'room',
    transformMutationResponse: redactRoomConfig,
  })
}
