import { createRoomRoutesFactory } from '~/routes/create-room-routes-factory'
import { FreeRoomConfigStoreError } from '~/services/free-room-config-store'
import {
  CreateFreeRoomRequestSchema,
  UpdateFreeRoomRequestSchema,
  type FreeRoomConfig,
  type CreateFreeRoomRequest,
  type UpdateFreeRoomRequest,
} from '~/types/free-room-config'
import type { FreeRoomConfigStore } from '~/services/free-room-config-store'

interface FreeRoomsRoutesOptions {
  store: FreeRoomConfigStore
  chatworkApiToken: string
  chatworkBotAccountId: number
}

export function createFreeRoomsRoutes({
  store,
  chatworkApiToken,
  chatworkBotAccountId,
}: FreeRoomsRoutesOptions) {
  return createRoomRoutesFactory<
    FreeRoomConfig, // TConfig (always same type for free rooms)
    CreateFreeRoomRequest, // TCreateRequest (validated input)
    UpdateFreeRoomRequest, // TUpdateRequest (validated input)
    FreeRoomConfigStoreError // TStoreError
  >({
    store,
    chatworkApiToken,
    chatworkBotAccountId,
    basePath: 'free-rooms',
    entityName: 'Free room',
    elysiaName: 'translator:free-rooms',
    createRequestSchema: CreateFreeRoomRequestSchema,
    updateRequestSchema: UpdateFreeRoomRequestSchema,
    StoreErrorClass: FreeRoomConfigStoreError,
    logEventPrefix: 'free_room',
  })
}
