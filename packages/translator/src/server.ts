import type { RoomConfigStore } from './services/room-config-store'
import { createApp } from './app'

interface ServerOptions {
  store: RoomConfigStore
}

export function createServer({ store }: ServerOptions) {
  return createApp({ store })
}
