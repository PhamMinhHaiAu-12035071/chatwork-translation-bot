import type {
  ApiResponse,
  CreateRoomInput,
  DeleteRoomResult,
  ProviderInfo,
  RoomConfigPublic,
  UpdateRoomInput,
} from '~/lib/api-types'

const BASE = '/api'

class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
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

export const apiClient = {
  listRooms(): Promise<ApiResponse<RoomConfigPublic[]>> {
    return request<RoomConfigPublic[]>('GET', '/rooms')
  },

  getRoom(id: string): Promise<ApiResponse<RoomConfigPublic>> {
    return request<RoomConfigPublic>('GET', `/rooms/${id}`)
  },

  createRoom(input: CreateRoomInput): Promise<ApiResponse<RoomConfigPublic>> {
    return request<RoomConfigPublic>('POST', '/rooms', input)
  },

  updateRoom(id: string, input: UpdateRoomInput): Promise<ApiResponse<RoomConfigPublic>> {
    return request<RoomConfigPublic>('PUT', `/rooms/${id}`, input)
  },

  deleteRoom(id: string): Promise<ApiResponse<DeleteRoomResult>> {
    return request<DeleteRoomResult>('DELETE', `/rooms/${id}`)
  },

  enableRoom(id: string): Promise<ApiResponse<RoomConfigPublic>> {
    return request<RoomConfigPublic>('POST', `/rooms/${id}/enable`)
  },

  disableRoom(id: string): Promise<ApiResponse<RoomConfigPublic>> {
    return request<RoomConfigPublic>('POST', `/rooms/${id}/disable`)
  },

  listProviders(): Promise<ApiResponse<ProviderInfo[]>> {
    return request<ProviderInfo[]>('GET', '/providers')
  },
}

export { ApiError }
