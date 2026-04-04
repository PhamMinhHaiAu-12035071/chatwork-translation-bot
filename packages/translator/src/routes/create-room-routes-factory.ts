import type { z } from 'zod'
import {
  composeRoomDescription,
  createRoom as createChatworkRoom,
  deleteRoom as deleteChatworkRoom,
  updateRoom as updateChatworkRoom,
} from '@chatwork-bot/chatwork'
import { Elysia, t } from 'elysia'

// Shared utility functions
export function resolvePublicOrigin(request: Request): string {
  const fwdHost = request.headers.get('x-forwarded-host')
  const fwdProto = request.headers.get('x-forwarded-proto') ?? 'https'
  if (fwdHost) return `${fwdProto}://${fwdHost}`
  return new URL(request.url).origin
}

export function errorResponse(status: number, error: string, details?: unknown) {
  return {
    status,
    body: details === undefined ? { error } : { error, details },
  }
}

export function hasStatusCode(error: unknown, statusCode: number): boolean {
  return (
    error instanceof Error &&
    'statusCode' in error &&
    typeof error.statusCode === 'number' &&
    error.statusCode === statusCode
  )
}

// Base interfaces for type constraints
interface BaseStoreError extends Error {
  code: string
}

/**
 * Store interface for room configurations.
 *
 * @typeParam TConfig - Base config type (union of possible return types)
 *
 * Note: Stores may return different variants of TConfig from different operations.
 * For example, Standard rooms:
 * - list/getById return RoomConfigPublic (redacted)
 * - create returns RoomConfig (full)
 * - update/setEnabled return RoomConfigPublic (redacted)
 *
 * The factory uses transformMutationResponse to normalize outputs when needed.
 */
interface BaseRoomStore<TConfig> {
  list(): TConfig[]
  getById(id: string): TConfig | null
  getByOriginalRoomId(originalRoomId: number): TConfig | null
  create(params: unknown): Promise<TConfig>
  update(id: string, params: unknown): Promise<TConfig>
  delete(id: string): Promise<void>
  setEnabled(id: string, enabled: boolean): Promise<TConfig>
}

/**
 * Room config with required fields for route operations.
 * Both TListConfig and TFullConfig must extend this interface.
 */
interface BaseRoomConfig {
  destinationRoomId: number
  destinationRoomName: string
}

/**
 * Create request must have these fields for room creation.
 */
interface BaseCreateRequest {
  originalRoomId: number
  originalRoomName: string
  destinationRoomName: string
}

/**
 * Update request may have optional destinationRoomName for rename operations.
 * Using Record to allow any update fields - stores define their own update interfaces.
 */
type BaseUpdateRequest = Record<string, unknown>

interface RoomRoutesFactoryOptions<
  TConfig extends BaseRoomConfig,
  TCreateRequest extends BaseCreateRequest,
  TUpdateRequest extends BaseUpdateRequest,
  TStoreError extends BaseStoreError,
> {
  store: BaseRoomStore<TConfig>
  chatworkApiToken: string
  chatworkBotAccountId: number
  basePath: string
  entityName: string
  elysiaName: string
  createRequestSchema: z.ZodType<TCreateRequest>
  updateRequestSchema: z.ZodType<TUpdateRequest>
  StoreErrorClass: new (message: string, code: string) => TStoreError
  logEventPrefix: string
  transformMutationResponse?: (config: TConfig) => unknown
}

export function createRoomRoutesFactory<
  TConfig extends BaseRoomConfig,
  TCreateRequest extends BaseCreateRequest,
  TUpdateRequest extends BaseUpdateRequest,
  TStoreError extends BaseStoreError,
>({
  store,
  chatworkApiToken,
  chatworkBotAccountId,
  basePath,
  entityName,
  elysiaName,
  createRequestSchema,
  updateRequestSchema,
  StoreErrorClass,
  logEventPrefix,
  transformMutationResponse,
}: RoomRoutesFactoryOptions<TConfig, TCreateRequest, TUpdateRequest, TStoreError>) {
  return new Elysia({ name: elysiaName })
    .get(`/api/${basePath}`, () => {
      return { success: true, data: store.list() }
    })
    .get(`/api/${basePath}/:id`, ({ params, set }) => {
      const room = store.getById(params.id)
      if (room === null) {
        set.status = 404
        return { error: `${entityName} not found` }
      }

      return { success: true, data: room }
    })
    .post(
      `/api/${basePath}`,
      async ({ body, request, set }) => {
        const parsed = createRequestSchema.safeParse(body)
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
              event: `${logEventPrefix}_duplicate_destination_room_name`,
              destinationRoomName: data.destinationRoomName,
            }),
          )
        }

        const description = composeRoomDescription(data.originalRoomName)

        let destinationRoomId: number
        try {
          const created = await createChatworkRoom(
            {
              name: data.destinationRoomName,
              members_admin_ids: chatworkBotAccountId.toString(),
              description,
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
        const responseData = transformMutationResponse ? transformMutationResponse(room) : room

        set.status = 201
        return { success: true, data: responseData, webhookUrl }
      },
      { body: t.Unknown() },
    )
    .put(
      `/api/${basePath}/:id`,
      async ({ body, params, set }) => {
        const parsed = updateRequestSchema.safeParse(body)
        if (!parsed.success) {
          const response = errorResponse(400, 'Invalid request body', parsed.error.issues)
          set.status = response.status
          return response.body
        }

        const existing = store.getById(params.id)
        if (existing === null) {
          const response = errorResponse(404, `${entityName} not found`)
          set.status = response.status
          return response.body
        }

        const nextDestinationRoomName = parsed.data['destinationRoomName'] as string | undefined
        const shouldRenameChatworkRoom =
          nextDestinationRoomName !== undefined &&
          // eslint-disable-next-line @typescript-eslint/dot-notation
          nextDestinationRoomName !== existing['destinationRoomName']

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
          const responseData = transformMutationResponse ? transformMutationResponse(room) : room
          return { success: true, data: responseData }
        } catch (error) {
          if (error instanceof StoreErrorClass && error.code === 'NOT_FOUND') {
            const response = errorResponse(404, `${entityName} not found`)
            set.status = response.status
            return response.body
          }

          throw error
        }
      },
      { body: t.Unknown() },
    )
    .delete(`/api/${basePath}/:id`, async ({ params, set }) => {
      const room = store.getById(params.id)
      if (room === null) {
        const response = errorResponse(404, `${entityName} not found`)
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
            event: `${logEventPrefix}_delete_local_cleanup_failed`,
            roomId: params.id,
            destinationRoomId: room.destinationRoomId,
            outcome,
            error: error instanceof Error ? error.message : String(error),
          }),
        )

        if (error instanceof StoreErrorClass && error.code === 'NOT_FOUND') {
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
    .post(`/api/${basePath}/:id/enable`, async ({ params, set }) => {
      try {
        const room = await store.setEnabled(params.id, true)
        const responseData = transformMutationResponse ? transformMutationResponse(room) : room
        return { success: true, data: responseData }
      } catch (error) {
        if (error instanceof StoreErrorClass && error.code === 'NOT_FOUND') {
          const response = errorResponse(404, `${entityName} not found`)
          set.status = response.status
          return response.body
        }

        throw error
      }
    })
    .post(`/api/${basePath}/:id/disable`, async ({ params, set }) => {
      try {
        const room = await store.setEnabled(params.id, false)
        const responseData = transformMutationResponse ? transformMutationResponse(room) : room
        return { success: true, data: responseData }
      } catch (error) {
        if (error instanceof StoreErrorClass && error.code === 'NOT_FOUND') {
          const response = errorResponse(404, `${entityName} not found`)
          set.status = response.status
          return response.body
        }

        throw error
      }
    })
}
