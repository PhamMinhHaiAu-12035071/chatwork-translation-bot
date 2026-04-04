import { ApiError } from '~/lib/api-client'
import type { ApiResponse, DeleteRoomResult, ProtectedKeyword } from '~/lib/api-types'
import type { FreeRoomKagiStyle } from '~/lib/free-room-schemas'

const BASE = '/api/free-rooms'

export interface FreeRoomConfigPublic {
  id: string
  originalRoomId: number
  originalRoomName: string
  destinationRoomId: number
  destinationRoomName: string
  kagiStyle: FreeRoomKagiStyle
  context: string | null
  protectedKeywords?: ProtectedKeyword[]
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateFreeRoomInput {
  originalRoomId: number
  originalRoomName: string
  destinationRoomName: string
  kagiStyle: FreeRoomKagiStyle
  context?: string | null
  protectedKeywords?: ProtectedKeyword[]
}

export interface UpdateFreeRoomInput {
  destinationRoomName?: string
  kagiStyle?: FreeRoomKagiStyle
  context?: string | null
  protectedKeywords?: ProtectedKeyword[] | null
}

async function request<T>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
  const response = await fetch(`${BASE}${path}`, {
    method,
    ...(body !== undefined
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  })

  if (response.status === 204) {
    return { success: true } as ApiResponse<T>
  }

  let json: ApiResponse<T>
  try {
    json = (await response.json()) as ApiResponse<T>
  } catch {
    throw new ApiError(`HTTP ${response.status.toString()}: non-JSON response`, response.status)
  }

  if (!response.ok) {
    throw new ApiError(json.error ?? `HTTP ${response.status.toString()}`, response.status)
  }

  return json
}

export const freeRoomApiClient = {
  listFreeRooms(): Promise<ApiResponse<FreeRoomConfigPublic[]>> {
    return request<FreeRoomConfigPublic[]>('GET', '')
  },

  getFreeRoom(id: string): Promise<ApiResponse<FreeRoomConfigPublic>> {
    return request<FreeRoomConfigPublic>('GET', `/${id}`)
  },

  createFreeRoom(input: CreateFreeRoomInput): Promise<ApiResponse<FreeRoomConfigPublic>> {
    return request<FreeRoomConfigPublic>('POST', '', input)
  },

  updateFreeRoom(
    id: string,
    input: UpdateFreeRoomInput,
  ): Promise<ApiResponse<FreeRoomConfigPublic>> {
    return request<FreeRoomConfigPublic>('PUT', `/${id}`, input)
  },

  deleteFreeRoom(id: string): Promise<ApiResponse<DeleteRoomResult>> {
    return request<DeleteRoomResult>('DELETE', `/${id}`)
  },

  enableFreeRoom(id: string): Promise<ApiResponse<FreeRoomConfigPublic>> {
    return request<FreeRoomConfigPublic>('POST', `/${id}/enable`)
  },

  disableFreeRoom(id: string): Promise<ApiResponse<FreeRoomConfigPublic>> {
    return request<FreeRoomConfigPublic>('POST', `/${id}/disable`)
  },
}
