import { createRoomRoutesFactory } from '~/routes/create-room-routes-factory'
import { RoomConfigStoreError } from '~/services/room-config-store'
import {
  CreateRoomRequestSchema,
  UpdateRoomRequestSchema,
  redactRoomConfig,
  type RoomConfig,
  type RoomConfigPublic,
  type CreateRoomRequest,
  type UpdateRoomRequest,
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
  return createRoomRoutesFactory<
    RoomConfig | RoomConfigPublic, // TConfig (union of possible store return types)
    CreateRoomRequest, // TCreateRequest (validated input)
    UpdateRoomRequest, // TUpdateRequest (validated input)
    RoomConfigStoreError // TStoreError
  >({
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
    transformMutationResponse: (config) => redactRoomConfig(config as RoomConfig),
  })
}
