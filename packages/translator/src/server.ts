import type { FreeRoomConfigStore } from './services/free-room-config-store'
import type { RoomConfigStore } from './services/room-config-store'
import { createApp } from './app'

interface ServerOptions {
  store: RoomConfigStore
  freeStore: FreeRoomConfigStore
}

export function createServer({ store, freeStore }: ServerOptions) {
  return createApp({ store, freeStore })
}
