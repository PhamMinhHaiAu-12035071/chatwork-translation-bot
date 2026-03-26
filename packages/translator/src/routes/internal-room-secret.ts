import { Elysia } from 'elysia'
import type { RoomConfigStore } from '~/services/room-config-store'

interface InternalRoomSecretRouteOptions {
  store: RoomConfigStore
  internalApiSecret: string
}

function errorResponse(status: number, error: string) {
  return { status, body: { error } }
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
        const response = errorResponse(401, 'Unauthorized')
        set.status = response.status
        return response.body
      }

      const roomIdRaw = query['room_id']
      if (!roomIdRaw) {
        const response = errorResponse(400, 'Missing room_id query parameter')
        set.status = response.status
        return response.body
      }

      const roomId = Number.parseInt(roomIdRaw, 10)
      if (Number.isNaN(roomId)) {
        const response = errorResponse(400, 'room_id must be a number')
        set.status = response.status
        return response.body
      }

      const room = store.getByOriginalRoomId(roomId)
      if (!room?.enabled) {
        const response = errorResponse(404, `No room configured for room_id ${roomId.toString()}`)
        set.status = response.status
        return response.body
      }

      const secret = await store.decryptWebhookSecret(room.encryptedWebhookSecret)
      return { secret }
    },
  )
}
