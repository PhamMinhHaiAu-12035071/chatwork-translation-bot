import { Elysia } from 'elysia'
import type { RoomConfigStore } from '~/services/room-config-store'

interface InternalRoomSecretRouteOptions {
  store: RoomConfigStore
  internalApiSecret: string
}

type RoomSecretLogLevel = 'info' | 'warn' | 'error'

function errorResponse(status: number, error: string) {
  return { status, body: { error } }
}

function logRoomSecretEvent(
  level: RoomSecretLogLevel,
  event: string,
  context: Record<string, unknown>,
): void {
  const line = JSON.stringify({
    level,
    service: 'translator',
    event,
    timestamp: new Date().toISOString(),
    requestSource: 'webhook',
    ...context,
  })

  if (level === 'error') {
    console.error(line)
    return
  }

  if (level === 'warn') {
    console.warn(line)
    return
  }

  console.log(line)
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
      if (room === null) {
        logRoomSecretEvent('warn', 'room_secret_lookup_not_found', {
          roomId,
        })
        const response = errorResponse(404, `No room configured for room_id ${roomId.toString()}`)
        set.status = response.status
        return response.body
      }

      if (!room.enabled) {
        logRoomSecretEvent('info', 'room_secret_lookup_room_disabled', {
          roomId,
          roomConfigId: room.id,
          nextExpectedAction: 'enable_room',
        })
        const response = errorResponse(404, `No room configured for room_id ${roomId.toString()}`)
        set.status = response.status
        return response.body
      }

      const secret = await store.decryptWebhookSecret(room.encryptedWebhookSecret)
      logRoomSecretEvent('info', 'room_secret_lookup_resolved', {
        roomId,
        roomConfigId: room.id,
        enabled: room.enabled,
      })
      return { secret }
    },
  )
}
