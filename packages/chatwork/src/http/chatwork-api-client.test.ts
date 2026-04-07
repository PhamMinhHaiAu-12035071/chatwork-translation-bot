import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { ChatworkApiError, ChatworkRateLimitError } from '~/errors/chatwork-api-error'
import { chatworkApiClient } from './chatwork-api-client'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TOKEN = 'test-api-token'
const ROOM_ID = 12345
const MESSAGE_ID = 'msg-001'

type FetchSpy = ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>

function makeFetchSpy(): FetchSpy {
  return spyOn(globalThis, 'fetch').mockImplementation((() => {
    throw new Error('Unexpected real HTTP call')
  }) as unknown as typeof fetch)
}

function mockOnce(spy: FetchSpy, response: Response): void {
  spy.mockImplementationOnce((() => Promise.resolve(response)) as unknown as typeof fetch)
}

function makeOkResponse(body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function makeErrorResponse(
  status: number,
  errors: string[],
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify({ errors }), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
    return undefined
  } catch (e) {
    return e
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('chatworkApiClient', () => {
  let fetchSpy: FetchSpy
  let originalNodeEnv: string | undefined

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'test'
    fetchSpy = makeFetchSpy()
  })

  afterEach(() => {
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv
    } else {
      delete process.env.NODE_ENV
    }
    fetchSpy.mockRestore()
  })

  // ─── getMe ───────────────────────────────────────────────────────────────

  describe('getMe', () => {
    it('sends GET to /me with correct header', async () => {
      mockOnce(fetchSpy, makeOkResponse({ account_id: 42, name: 'Bot' }))

      const result = await chatworkApiClient.getMe(TOKEN)

      expect(result.account_id).toBe(42)
      const [url, init] = fetchSpy.mock.calls.at(-1) as [string, RequestInit]
      expect(url).toBe('https://api.chatwork.com/v2/me')
      expect(init.method).toBe('GET')
      expect((init.headers as Record<string, string>)['X-ChatWorkToken']).toBe(TOKEN)
    })

    it('throws ChatworkApiError on error response', async () => {
      mockOnce(fetchSpy, makeErrorResponse(401, ['Unauthorized']))

      const error = await catchError(chatworkApiClient.getMe(TOKEN))
      expect(error).toBeInstanceOf(ChatworkApiError)
    })
  })

  // ─── sendRoomMessage ───────────────────────────────────────────────────────

  describe('sendRoomMessage', () => {
    it('sends form-encoded POST with X-ChatWorkToken header', async () => {
      mockOnce(fetchSpy, makeOkResponse({ message_id: '99' }))

      const result = await chatworkApiClient.sendRoomMessage(ROOM_ID, 'Hello', TOKEN)

      expect(result.message_id).toBe('99')

      const lastCall = fetchSpy.mock.calls.at(-1) as [string, RequestInit]
      const [url, init] = lastCall
      expect(url).toBe(`https://api.chatwork.com/v2/rooms/${ROOM_ID.toString()}/messages`)
      expect((init.headers as Record<string, string>)['X-ChatWorkToken']).toBe(TOKEN)
      expect(init.method).toBe('POST')
      expect(init.body).toContain('body=Hello')
      expect(init.body).toContain('self_unread=1')
    })

    it('throws ChatworkApiError on error response', async () => {
      mockOnce(fetchSpy, makeErrorResponse(400, ['Invalid parameters']))

      const error = await catchError(chatworkApiClient.sendRoomMessage(ROOM_ID, 'Hello', TOKEN))
      expect(error).toBeInstanceOf(ChatworkApiError)
    })

    it('throws ChatworkRateLimitError on 429 with retryAfter populated', async () => {
      mockOnce(fetchSpy, makeErrorResponse(429, ['Rate limit exceeded'], { 'Retry-After': '45' }))

      const error = await catchError(chatworkApiClient.sendRoomMessage(ROOM_ID, 'Hello', TOKEN))

      expect(error).toBeInstanceOf(ChatworkRateLimitError)
      expect((error as ChatworkRateLimitError).retryAfter).toBe(45)
    })
  })

  // ─── deleteRoomMessage ─────────────────────────────────────────────────────

  describe('deleteRoomMessage', () => {
    it('sends DELETE to correct endpoint', async () => {
      mockOnce(fetchSpy, makeOkResponse({ message_id: MESSAGE_ID }))

      await chatworkApiClient.deleteRoomMessage(ROOM_ID, MESSAGE_ID, TOKEN)

      const [url, init] = fetchSpy.mock.calls.at(-1) as [string, RequestInit]
      expect(url).toBe(
        `https://api.chatwork.com/v2/rooms/${ROOM_ID.toString()}/messages/${MESSAGE_ID}`,
      )
      expect(init.method).toBe('DELETE')
      expect((init.headers as Record<string, string>)['X-ChatWorkToken']).toBe(TOKEN)
    })

    it('throws ChatworkApiError on error response', async () => {
      mockOnce(fetchSpy, makeErrorResponse(404, ['Message not found']))

      const error = await catchError(
        chatworkApiClient.deleteRoomMessage(ROOM_ID, MESSAGE_ID, TOKEN),
      )
      expect(error).toBeInstanceOf(ChatworkApiError)
    })
  })

  // ─── deleteRoom ────────────────────────────────────────────────────────────

  describe('deleteRoom', () => {
    it('sends DELETE to the correct room endpoint', async () => {
      mockOnce(fetchSpy, new Response(null, { status: 204 }))

      await chatworkApiClient.deleteRoom(ROOM_ID, TOKEN)

      const [url, init] = fetchSpy.mock.calls.at(-1) as [string, RequestInit]
      expect(url).toBe(`https://api.chatwork.com/v2/rooms/${ROOM_ID.toString()}`)
      expect(init.method).toBe('DELETE')
      expect((init.headers as Record<string, string>)['X-ChatWorkToken']).toBe(TOKEN)
    })

    it('throws ChatworkApiError on error response', async () => {
      mockOnce(fetchSpy, makeErrorResponse(403, ['Forbidden']))

      const error = await catchError(chatworkApiClient.deleteRoom(ROOM_ID, TOKEN))
      expect(error).toBeInstanceOf(ChatworkApiError)
    })
  })

  // ─── updateRoom ────────────────────────────────────────────────────────────

  describe('updateRoom', () => {
    it('sends PUT to the correct room endpoint with form body', async () => {
      mockOnce(fetchSpy, new Response(null, { status: 204 }))

      await chatworkApiClient.updateRoom(ROOM_ID, { name: 'Renamed Room' }, TOKEN)

      const [url, init] = fetchSpy.mock.calls.at(-1) as [string, RequestInit]
      expect(url).toBe(`https://api.chatwork.com/v2/rooms/${ROOM_ID.toString()}`)
      expect(init.method).toBe('PUT')
      expect((init.headers as Record<string, string>)['X-ChatWorkToken']).toBe(TOKEN)
      const body = new URLSearchParams(init.body as string)
      expect(body.get('name')).toBe('Renamed Room')
    })

    it('throws ChatworkApiError on error response', async () => {
      mockOnce(fetchSpy, makeErrorResponse(403, ['Forbidden']))

      const error = await catchError(
        chatworkApiClient.updateRoom(ROOM_ID, { name: 'Renamed Room' }, TOKEN),
      )
      expect(error).toBeInstanceOf(ChatworkApiError)
    })
  })

  // ─── getRoomMembers ────────────────────────────────────────────────────────

  describe('getRoomMembers', () => {
    it('sends GET to correct members endpoint', async () => {
      const members = [{ account_id: 1, name: 'Alice', role: 'member' }]
      mockOnce(fetchSpy, makeOkResponse(members))

      const result = await chatworkApiClient.getRoomMembers(ROOM_ID, TOKEN)

      expect(result[0]?.account_id).toBe(1)
      expect(result[0]?.name).toBe('Alice')
      const [url, init] = fetchSpy.mock.calls.at(-1) as [string, RequestInit]
      expect(url).toBe(`https://api.chatwork.com/v2/rooms/${ROOM_ID.toString()}/members`)
      expect(init.method).toBe('GET')
      expect((init.headers as Record<string, string>)['X-ChatWorkToken']).toBe(TOKEN)
    })

    it('throws ChatworkRateLimitError on 429', async () => {
      mockOnce(fetchSpy, makeErrorResponse(429, [], { 'Retry-After': '10' }))

      const error = await catchError(chatworkApiClient.getRoomMembers(ROOM_ID, TOKEN))

      expect(error).toBeInstanceOf(ChatworkRateLimitError)
      expect((error as ChatworkRateLimitError).retryAfter).toBe(10)
    })
  })

  // ─── getRoomMessage ────────────────────────────────────────────────────────

  describe('getRoomMessage', () => {
    it('sends GET to correct message endpoint', async () => {
      const message = { message_id: MESSAGE_ID, body: 'Hello', account: {}, send_time: 0 }
      mockOnce(fetchSpy, makeOkResponse(message))

      const result = await chatworkApiClient.getRoomMessage(ROOM_ID, MESSAGE_ID, TOKEN)

      expect(result.message_id).toBe(MESSAGE_ID)
      const [url] = fetchSpy.mock.calls.at(-1) as [string]
      expect(url).toBe(
        `https://api.chatwork.com/v2/rooms/${ROOM_ID.toString()}/messages/${MESSAGE_ID}`,
      )
    })

    it('throws ChatworkApiError on error response', async () => {
      mockOnce(fetchSpy, makeErrorResponse(404, ['Message not found']))

      const error = await catchError(chatworkApiClient.getRoomMessage(ROOM_ID, MESSAGE_ID, TOKEN))
      expect(error).toBeInstanceOf(ChatworkApiError)
    })
  })

  // ─── listRoomMessages ──────────────────────────────────────────────────────

  describe('listRoomMessages', () => {
    it('sends GET to correct messages endpoint', async () => {
      mockOnce(fetchSpy, makeOkResponse([]))

      await chatworkApiClient.listRoomMessages(ROOM_ID, TOKEN)

      const [url] = fetchSpy.mock.calls.at(-1) as [string]
      expect(url).toContain(`/rooms/${ROOM_ID.toString()}/messages`)
    })

    it('includes force=1 query param when force is true', async () => {
      mockOnce(fetchSpy, makeOkResponse([]))

      await chatworkApiClient.listRoomMessages(ROOM_ID, TOKEN, true)

      const [url] = fetchSpy.mock.calls.at(-1) as [string]
      expect(url).toContain('force=1')
    })

    it('does not include force param when force is false', async () => {
      mockOnce(fetchSpy, makeOkResponse([]))

      await chatworkApiClient.listRoomMessages(ROOM_ID, TOKEN, false)

      const [url] = fetchSpy.mock.calls.at(-1) as [string]
      expect(url).not.toContain('force=')
    })

    it('throws ChatworkApiError on error response', async () => {
      mockOnce(fetchSpy, makeErrorResponse(403, ['Access denied']))

      const error = await catchError(chatworkApiClient.listRoomMessages(ROOM_ID, TOKEN))
      expect(error).toBeInstanceOf(ChatworkApiError)
    })
  })

  // ─── getRoom ───────────────────────────────────────────────────────────────

  describe('getRoom', () => {
    it('sends GET to correct room endpoint', async () => {
      const room = { room_id: ROOM_ID, name: 'Project Alpha' }
      mockOnce(fetchSpy, makeOkResponse(room))

      const result = await chatworkApiClient.getRoom(ROOM_ID, TOKEN)

      expect(result.room_id).toBe(ROOM_ID)
      expect(result.name).toBe('Project Alpha')
      const lastCall = fetchSpy.mock.calls.at(-1)
      if (!lastCall) throw new Error('Expected fetch to be called')
      const [url, init] = lastCall as [string, RequestInit]
      expect(url).toBe(`https://api.chatwork.com/v2/rooms/${ROOM_ID.toString()}`)
      expect(init.method).toBe('GET')
      const headers = init.headers as Record<string, string>
      expect(headers['X-ChatWorkToken']).toBe(TOKEN)
    })

    it('throws ChatworkApiError on error response', async () => {
      mockOnce(fetchSpy, makeErrorResponse(404, ['Room not found']))

      const error = await catchError(chatworkApiClient.getRoom(ROOM_ID, TOKEN))
      expect(error).toBeInstanceOf(ChatworkApiError)
    })
  })

  // ─── Error parsing ─────────────────────────────────────────────────────────

  describe('error response parsing', () => {
    it('parses Chatwork error array format', async () => {
      mockOnce(fetchSpy, makeErrorResponse(400, ['Error one', 'Error two']))

      const error = await catchError(chatworkApiClient.sendRoomMessage(ROOM_ID, 'test', TOKEN))

      expect(error).toBeInstanceOf(ChatworkApiError)
      expect((error as ChatworkApiError).errors).toEqual(['Error one', 'Error two'])
      expect((error as ChatworkApiError).statusCode).toBe(400)
    })
  })

  // ─── Safety guard ──────────────────────────────────────────────────────────

  describe('test environment safety', () => {
    it('rejects accidental calls to real api.chatwork.com when fetch spy throws', async () => {
      // The default spy setup in beforeEach already throws for any call —
      // this test confirms that no real network call would be silently made.
      const error = await catchError(chatworkApiClient.sendRoomMessage(ROOM_ID, 'test', TOKEN))
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe('Unexpected real HTTP call')
    })
  })
})
