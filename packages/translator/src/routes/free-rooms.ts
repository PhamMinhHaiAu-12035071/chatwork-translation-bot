import {
  createRoom as createChatworkRoom,
  deleteRoom as deleteChatworkRoom,
  updateRoom as updateChatworkRoom,
} from '@chatwork-bot/chatwork'
import { Elysia, t } from 'elysia'
import { FreeRoomConfigStoreError } from '~/services/free-room-config-store'
import { CreateFreeRoomRequestSchema, UpdateFreeRoomRequestSchema } from '~/types/free-room-config'
import type { FreeRoomConfigStore } from '~/services/free-room-config-store'

interface FreeRoomsRoutesOptions {
  store: FreeRoomConfigStore
  chatworkApiToken: string
  chatworkBotAccountId: number
}

function resolvePublicOrigin(request: Request): string {
  const fwdHost = request.headers.get('x-forwarded-host')
  const fwdProto = request.headers.get('x-forwarded-proto') ?? 'https'
  if (fwdHost) return `${fwdProto}://${fwdHost}`
  return new URL(request.url).origin
}

function errorResponse(status: number, error: string, details?: unknown) {
  return {
    status,
    body: details === undefined ? { error } : { error, details },
  }
}

function hasStatusCode(error: unknown, statusCode: number): boolean {
  return (
    error instanceof Error &&
    'statusCode' in error &&
    typeof error.statusCode === 'number' &&
    error.statusCode === statusCode
  )
}

export function createFreeRoomsRoutes({
  store,
  chatworkApiToken,
  chatworkBotAccountId,
}: FreeRoomsRoutesOptions) {
  return new Elysia({ name: 'translator:free-rooms' })
    .get('/api/free-rooms', () => {
      return { success: true, data: store.list() }
    })
    .get('/api/free-rooms/:id', ({ params, set }) => {
      const room = store.getById(params.id)
      if (room === null) {
        set.status = 404
        return { error: 'Room not found' }
      }

      return { success: true, data: room }
    })
    .post(
      '/api/free-rooms',
      async ({ body, request, set }) => {
        const parsed = CreateFreeRoomRequestSchema.safeParse(body)
        if (!parsed.success) {
          const response = errorResponse(400, 'Invalid request body', parsed.error.issues)
          set.status = response.status
          return response.body
        }

        const data = parsed.data
        const existing = store.getByOriginalRoomId(data.originalRoomId)
        if (existing !== null) {
          const response = errorResponse(
            409,
            `originalRoomId ${data.originalRoomId.toString()} already exists`,
          )
          set.status = response.status
          return response.body
        }

        const duplicateName = store
          .list()
          .some((room) => room.destinationRoomName === data.destinationRoomName)
        if (duplicateName) {
          console.warn(
            JSON.stringify({
              level: 'warn',
              service: 'translator',
              event: 'duplicate_free_destination_room_name',
              destinationRoomName: data.destinationRoomName,
            }),
          )
        }

        let destinationRoomId: number
        try {
          const created = await createChatworkRoom(
            {
              name: data.destinationRoomName,
              members_admin_ids: chatworkBotAccountId.toString(),
            },
            chatworkApiToken,
          )
          destinationRoomId = created.room_id
        } catch (error) {
          const response = errorResponse(
            502,
            'Failed to create destination room on Chatwork',
            error instanceof Error ? error.message : String(error),
          )
          set.status = response.status
          return response.body
        }

        const room = await store.create({ ...data, destinationRoomId })
        const webhookUrl = `${resolvePublicOrigin(request)}/webhook`

        set.status = 201
        return { success: true, data: room, webhookUrl }
      },
      { body: t.Unknown() },
    )
    .put(
      '/api/free-rooms/:id',
      async ({ body, params, set }) => {
        const parsed = UpdateFreeRoomRequestSchema.safeParse(body)
        if (!parsed.success) {
          const response = errorResponse(400, 'Invalid request body', parsed.error.issues)
          set.status = response.status
          return response.body
        }

        const existing = store.getById(params.id)
        if (existing === null) {
          const response = errorResponse(404, 'Room not found')
          set.status = response.status
          return response.body
        }

        const nextDestinationRoomName = parsed.data.destinationRoomName
        const shouldRenameChatworkRoom =
          nextDestinationRoomName !== undefined &&
          nextDestinationRoomName !== existing.destinationRoomName

        if (shouldRenameChatworkRoom) {
          try {
            await updateChatworkRoom(
              existing.destinationRoomId,
              { name: nextDestinationRoomName },
              chatworkApiToken,
            )
          } catch (error) {
            const response = errorResponse(
              502,
              'Failed to update destination room on Chatwork',
              error instanceof Error ? error.message : String(error),
            )
            set.status = response.status
            return response.body
          }
        }

        try {
          const room = await store.update(params.id, parsed.data)
          return { success: true, data: room }
        } catch (error) {
          if (error instanceof FreeRoomConfigStoreError && error.code === 'NOT_FOUND') {
            const response = errorResponse(404, 'Room not found')
            set.status = response.status
            return response.body
          }

          throw error
        }
      },
      { body: t.Unknown() },
    )
    .delete('/api/free-rooms/:id', async ({ params, set }) => {
      const room = store.getById(params.id)
      if (room === null) {
        const response = errorResponse(404, 'Room not found')
        set.status = response.status
        return response.body
      }

      let outcome: 'deleted' | 'already_deleted' = 'deleted'

      try {
        await deleteChatworkRoom(room.destinationRoomId, chatworkApiToken)
      } catch (error) {
        if (hasStatusCode(error, 404)) {
          outcome = 'already_deleted'
        } else {
          const response = errorResponse(
            502,
            'Failed to delete destination room on Chatwork',
            error instanceof Error ? error.message : String(error),
          )
          set.status = response.status
          return response.body
        }
      }

      try {
        await store.delete(params.id)
      } catch (error) {
        console.error(
          JSON.stringify({
            level: 'error',
            service: 'translator',
            event: 'free_room_delete_local_cleanup_failed',
            roomId: params.id,
            destinationRoomId: room.destinationRoomId,
            outcome,
            error: error instanceof Error ? error.message : String(error),
          }),
        )

        if (error instanceof FreeRoomConfigStoreError && error.code === 'NOT_FOUND') {
          return { success: true, data: { outcome } }
        }

        const response = errorResponse(
          500,
          'Chatwork room was deleted, but local room cleanup failed',
          error instanceof Error ? error.message : String(error),
        )
        set.status = response.status
        return response.body
      }

      return { success: true, data: { outcome } }
    })
    .post('/api/free-rooms/:id/enable', async ({ params, set }) => {
      try {
        const room = await store.setEnabled(params.id, true)
        return { success: true, data: room }
      } catch (error) {
        if (error instanceof FreeRoomConfigStoreError && error.code === 'NOT_FOUND') {
          const response = errorResponse(404, 'Room not found')
          set.status = response.status
          return response.body
        }

        throw error
      }
    })
    .post('/api/free-rooms/:id/disable', async ({ params, set }) => {
      try {
        const room = await store.setEnabled(params.id, false)
        return { success: true, data: room }
      } catch (error) {
        if (error instanceof FreeRoomConfigStoreError && error.code === 'NOT_FOUND') {
          const response = errorResponse(404, 'Room not found')
          set.status = response.status
          return response.body
        }

        throw error
      }
    })
}
