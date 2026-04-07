import { Agent, request } from 'undici'
import { ChatworkApiError, ChatworkRateLimitError } from '~/errors/chatwork-api-error'
import type { IChatworkApiClient } from '~/interfaces/chatwork-api'
import type {
  ChatworkMe,
  ChatworkMember,
  ChatworkMessage,
  ChatworkSendMessageResult,
} from '~/types/message'
import type { CreateRoomParams, CreateRoomResult, Room, UpdateRoomParams } from '~/types/room'

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = 'https://api.chatwork.com/v2'

// ─── HTTP Connection Pooling ──────────────────────────────────────────────────

const enableKeepAlive = process.env['ENABLE_HTTP_KEEPALIVE'] !== 'false'

export const httpAgent = enableKeepAlive
  ? new Agent({
      keepAliveTimeout: 30000, // 30 seconds
      keepAliveMaxTimeout: 600000, // 10 minutes
      connections: 10,
      pipelining: 1,
    })
  : undefined

// ─── Internal helpers ─────────────────────────────────────────────────────────

function makeHeaders(token: string): Record<string, string> {
  return {
    'X-ChatWorkToken': token,
  }
}

async function makeRequest(
  url: string,
  options: {
    method: string
    headers: Record<string, string>
    body?: string
  },
): Promise<Response> {
  // In tests, use fetch() to allow for mocking
  // In production, use undici.request() for connection pooling
  const isTest = process.env.NODE_ENV === 'test'

  if (isTest) {
    return fetch(url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
    })
  }

  const requestOptions: Parameters<typeof request>[1] = {
    method: options.method,
    headers: options.headers,
  }

  if (options.body !== undefined) {
    requestOptions.body = options.body
  }

  if (httpAgent !== undefined) {
    requestOptions.dispatcher = httpAgent
  }

  const { statusCode, headers, body: responseBody } = await request(url, requestOptions)

  const text = await responseBody.text()

  // Filter out undefined header values
  const headerEntries = Object.entries(headers).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  )

  return new Response(text, {
    status: statusCode,
    headers: new Headers(headerEntries),
  })
}

interface ChatworkErrorBody {
  errors?: string[]
}

async function handleErrorResponse(response: Response): Promise<never> {
  const retryAfterHeader = response.headers.get('Retry-After')

  let errors: string[] = []
  try {
    const body = (await response.json()) as ChatworkErrorBody
    errors = body.errors ?? []
  } catch {
    // ignore JSON parse failures
  }

  if (response.status === 429) {
    const retryAfter = retryAfterHeader != null ? parseInt(retryAfterHeader, 10) : 0
    throw new ChatworkRateLimitError(retryAfter, errors)
  }

  const message =
    errors.length > 0
      ? errors.join('; ')
      : `Chatwork API error: ${response.status.toString()} ${response.statusText}`

  throw new ChatworkApiError(message, response.status, response.statusText, errors)
}

// ─── API client (internal) ────────────────────────────────────────────────────

export const chatworkApiClient = {
  async getMe(token: string): Promise<ChatworkMe> {
    const url = `${BASE_URL}/me`

    const response = await makeRequest(url, {
      method: 'GET',
      headers: makeHeaders(token),
    })

    if (!response.ok) {
      return handleErrorResponse(response)
    }

    return (await response.json()) as ChatworkMe
  },

  async sendRoomMessage(
    roomId: number,
    message: string,
    token: string,
  ): Promise<ChatworkSendMessageResult> {
    const url = `${BASE_URL}/rooms/${roomId.toString()}/messages`
    const body = new URLSearchParams({ body: message, self_unread: '1' })

    const response = await makeRequest(url, {
      method: 'POST',
      headers: {
        ...makeHeaders(token),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    if (!response.ok) {
      return handleErrorResponse(response)
    }

    return (await response.json()) as ChatworkSendMessageResult
  },

  async deleteRoomMessage(roomId: number, messageId: string, token: string): Promise<void> {
    const url = `${BASE_URL}/rooms/${roomId.toString()}/messages/${messageId}`

    const response = await makeRequest(url, {
      method: 'DELETE',
      headers: makeHeaders(token),
    })

    if (!response.ok) {
      return handleErrorResponse(response)
    }
  },

  async deleteRoom(roomId: number, token: string): Promise<void> {
    const url = `${BASE_URL}/rooms/${roomId.toString()}`
    const body = new URLSearchParams({ action_type: 'delete' })

    const response = await makeRequest(url, {
      method: 'DELETE',
      headers: {
        ...makeHeaders(token),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    if (!response.ok) {
      return handleErrorResponse(response)
    }
  },

  async getRoomMembers(roomId: number, token: string): Promise<ChatworkMember[]> {
    const url = `${BASE_URL}/rooms/${roomId.toString()}/members`

    const response = await makeRequest(url, {
      method: 'GET',
      headers: makeHeaders(token),
    })

    if (!response.ok) {
      return handleErrorResponse(response)
    }

    return (await response.json()) as ChatworkMember[]
  },

  async getRoomMessage(roomId: number, messageId: string, token: string): Promise<ChatworkMessage> {
    const url = `${BASE_URL}/rooms/${roomId.toString()}/messages/${messageId}`

    const response = await makeRequest(url, {
      method: 'GET',
      headers: makeHeaders(token),
    })

    if (!response.ok) {
      return handleErrorResponse(response)
    }

    return (await response.json()) as ChatworkMessage
  },

  async listRoomMessages(
    roomId: number,
    token: string,
    force?: boolean,
  ): Promise<ChatworkMessage[]> {
    const url = new URL(`${BASE_URL}/rooms/${roomId.toString()}/messages`)
    if (force === true) {
      url.searchParams.set('force', '1')
    }

    const response = await makeRequest(url.toString(), {
      method: 'GET',
      headers: makeHeaders(token),
    })

    if (!response.ok) {
      return handleErrorResponse(response)
    }

    return (await response.json()) as ChatworkMessage[]
  },

  async getRoom(roomId: number, token: string): Promise<Room> {
    const url = `${BASE_URL}/rooms/${roomId.toString()}`

    const response = await makeRequest(url, {
      method: 'GET',
      headers: makeHeaders(token),
    })

    if (!response.ok) {
      return handleErrorResponse(response)
    }

    return (await response.json()) as Room
  },

  async createRoom(params: CreateRoomParams, token: string): Promise<CreateRoomResult> {
    const url = `${BASE_URL}/rooms`
    const body = new URLSearchParams()
    body.set('name', params.name)
    body.set('members_admin_ids', params.members_admin_ids)
    if (params.description !== undefined) {
      body.set('description', params.description)
    }
    if (params.icon_preset !== undefined) {
      body.set('icon_preset', params.icon_preset)
    }

    const response = await makeRequest(url, {
      method: 'POST',
      headers: {
        ...makeHeaders(token),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    if (!response.ok) {
      return handleErrorResponse(response)
    }

    return (await response.json()) as CreateRoomResult
  },

  async updateRoom(roomId: number, params: UpdateRoomParams, token: string): Promise<void> {
    const url = `${BASE_URL}/rooms/${roomId.toString()}`
    const body = new URLSearchParams()
    if (params.name !== undefined) {
      body.set('name', params.name)
    }
    if (params.description !== undefined) {
      body.set('description', params.description)
    }
    if (params.icon_preset !== undefined) {
      body.set('icon_preset', params.icon_preset)
    }

    const response = await makeRequest(url, {
      method: 'PUT',
      headers: {
        ...makeHeaders(token),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    if (!response.ok) {
      return handleErrorResponse(response)
    }
  },
} satisfies IChatworkApiClient
