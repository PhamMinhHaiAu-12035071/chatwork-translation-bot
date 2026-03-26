import { Elysia } from 'elysia'
import type { RoomConfigStore } from '~/services/room-config-store'

interface InternalRoomSecretRouteOptions {
  store: RoomConfigStore
  internalApiSecret: string
}

export function createInternalRoomSecretRoute({
  store,
  internalApiSecret,
}: InternalRoomSecretRouteOptions) {
  return new Elysia({ name: 'translator:internal-room-secret' }).get(
    '/internal/room-secret',
    async ({ headers, query, set }) => {
      const providedSecret = headers['x-internal-secret']
      if (!providedSecret || providedSecret !== internalApiSecret) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const roomIdRaw = query['room_id']
      if (!roomIdRaw) {
        set.status = 400
        return { error: 'Missing room_id query parameter' }
      }

      const roomId = Number.parseInt(roomIdRaw, 10)
      if (Number.isNaN(roomId)) {
        set.status = 400
        return { error: 'room_id must be a number' }
      }

      const room = store.getByOriginalRoomId(roomId)
      if (room === null || !room.enabled) {
        set.status = 404
        return { error: `No room configured for room_id ${roomId.toString()}` }
      }

      const secret = await store.decryptWebhookSecret(room.encryptedWebhookSecret)
      return { secret }
    },
  )
}
