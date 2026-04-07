import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { ChatworkApiError } from '~/errors/chatwork-api-error'
import { createRoom } from './create-room'

type FetchSpy = ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>

function makeFetchSpy(): FetchSpy {
  return spyOn(globalThis, 'fetch').mockImplementation((() => {
    throw new Error('Unexpected real HTTP call')
  }) as unknown as typeof fetch)
}

function mockOnce(spy: FetchSpy, response: Response): void {
  spy.mockImplementationOnce((() => Promise.resolve(response)) as unknown as typeof fetch)
}

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
    return undefined
  } catch (error) {
    return error
  }
}

const TOKEN = 'test-token'
const PARAMS = { name: 'Translation Output', members_admin_ids: '123' }

describe('createRoom', () => {
  let fetchSpy: FetchSpy

  beforeEach(() => {
    process.env.NODE_ENV = 'test'
    fetchSpy = makeFetchSpy()
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('calls POST /rooms with correct headers and body', async () => {
    mockOnce(
      fetchSpy,
      new Response(JSON.stringify({ room_id: 999 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const result = await createRoom(PARAMS, TOKEN)

    expect(result).toEqual({ room_id: 999 })
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.chatwork.com/v2/rooms')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['X-ChatWorkToken']).toBe(TOKEN)

    const body = new URLSearchParams(init.body as string)
    expect(body.get('name')).toBe('Translation Output')
    expect(body.get('members_admin_ids')).toBe('123')
  })

  it('includes optional description when provided', async () => {
    mockOnce(
      fetchSpy,
      new Response(JSON.stringify({ room_id: 999 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await createRoom({ ...PARAMS, description: 'My room desc' }, TOKEN)

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = new URLSearchParams(init.body as string)
    expect(body.get('description')).toBe('My room desc')
  })

  it('throws ChatworkApiError on non-OK response', async () => {
    mockOnce(
      fetchSpy,
      new Response(JSON.stringify({ errors: ['Forbidden'] }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const error = await catchError(createRoom(PARAMS, TOKEN))
    expect(error).toBeInstanceOf(ChatworkApiError)
  })
})
