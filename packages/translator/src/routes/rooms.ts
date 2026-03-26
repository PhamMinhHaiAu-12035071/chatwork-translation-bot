import { createRoom as createChatworkRoom } from '@chatwork-bot/chatwork'
import { Elysia, t } from 'elysia'
import { RoomConfigStoreError } from '~/services/room-config-store'
import { redactRoomConfig } from '~/types/room-config'
import { CreateRoomRequestSchema, UpdateRoomRequestSchema } from '~/types/room-config'
import type { RoomConfigStore } from '~/services/room-config-store'

interface RoomsRoutesOptions {
  store: RoomConfigStore
  chatworkApiToken: string
}

export function createRoomsRoutes({ store, chatworkApiToken }: RoomsRoutesOptions) {
  return new Elysia({ name: 'translator:rooms' })
    .get('/api/rooms', () => {
      return { success: true, data: store.list() }
    })
    .get('/api/rooms/:id', ({ params, set }) => {
      const room = store.getById(params.id)
      if (room === null) {
        set.status = 404
        return { error: 'Room not found' }
      }

      return { success: true, data: room }
    })
    .post(
      '/api/rooms',
      async ({ body, request, set }) => {
        const parsed = CreateRoomRequestSchema.safeParse(body)
        if (!parsed.success) {
          set.status = 400
          return { error: 'Invalid request body', details: parsed.error.issues }
        }

        const data = parsed.data
        const existing = store.getByOriginalRoomId(data.originalRoomId)
        if (existing !== null) {
          set.status = 409
          return { error: `originalRoomId ${data.originalRoomId.toString()} already exists` }
        }

        const duplicateName = store
          .list()
          .some((room) => room.destinationRoomName === data.destinationRoomName)
        if (duplicateName) {
          console.warn(
            JSON.stringify({
              level: 'warn',
              service: 'translator',
              event: 'duplicate_destination_room_name',
              destinationRoomName: data.destinationRoomName,
            }),
          )
        }

        let destinationRoomId: number
        try {
          const created = await createChatworkRoom(
            {
              name: data.destinationRoomName,
              members_admin_ids: '0',
            },
            chatworkApiToken,
          )
          destinationRoomId = created.room_id
        } catch (error) {
          set.status = 502
          return {
            error: 'Failed to create destination room on Chatwork',
            details: error instanceof Error ? error.message : String(error),
          }
        }

        const room = await store.create({ ...data, destinationRoomId })
        const webhookUrl = `${new URL(request.url).origin}/webhook`

        set.status = 201
        return { success: true, data: redactRoomConfig(room), webhookUrl }
      },
      { body: t.Unknown() },
    )
    .put(
      '/api/rooms/:id',
      async ({ body, params, set }) => {
        const parsed = UpdateRoomRequestSchema.safeParse(body)
        if (!parsed.success) {
          set.status = 400
          return { error: 'Invalid request body', details: parsed.error.issues }
        }

        try {
          const room = await store.update(params.id, parsed.data)
          return { success: true, data: room }
        } catch (error) {
          if (error instanceof RoomConfigStoreError && error.code === 'NOT_FOUND') {
            set.status = 404
            return { error: 'Room not found' }
          }

          throw error
        }
      },
      { body: t.Unknown() },
    )
    .delete('/api/rooms/:id', async ({ params, set }) => {
      try {
        await store.delete(params.id)
        set.status = 204
        return undefined
      } catch (error) {
        if (error instanceof RoomConfigStoreError && error.code === 'NOT_FOUND') {
          set.status = 404
          return { error: 'Room not found' }
        }

        throw error
      }
    })
    .post('/api/rooms/:id/enable', async ({ params, set }) => {
      try {
        const room = await store.setEnabled(params.id, true)
        return { success: true, data: room }
      } catch (error) {
        if (error instanceof RoomConfigStoreError && error.code === 'NOT_FOUND') {
          set.status = 404
          return { error: 'Room not found' }
        }

        throw error
      }
    })
    .post('/api/rooms/:id/disable', async ({ params, set }) => {
      try {
        const room = await store.setEnabled(params.id, false)
        return { success: true, data: room }
      } catch (error) {
        if (error instanceof RoomConfigStoreError && error.code === 'NOT_FOUND') {
          set.status = 404
          return { error: 'Room not found' }
        }

        throw error
      }
    })
}
