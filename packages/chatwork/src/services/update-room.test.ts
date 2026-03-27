import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { ChatworkApiError } from '~/errors/chatwork-api-error'
import { updateRoom } from './update-room'

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
const ROOM_ID = 999

describe('updateRoom', () => {
  let fetchSpy: FetchSpy

  beforeEach(() => {
    fetchSpy = makeFetchSpy()
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('calls PUT /rooms/{room_id} with correct headers and body', async () => {
    mockOnce(fetchSpy, new Response(null, { status: 204 }))

    await updateRoom(ROOM_ID, { name: 'Renamed Room' }, TOKEN)

    expect(fetchSpy).toHaveBeenCalledTimes(1)

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.chatwork.com/v2/rooms/999')
    expect(init.method).toBe('PUT')
    expect((init.headers as Record<string, string>)['X-ChatWorkToken']).toBe(TOKEN)

    const body = new URLSearchParams(init.body as string)
    expect(body.get('name')).toBe('Renamed Room')
  })

  it('throws ChatworkApiError on non-OK response', async () => {
    mockOnce(
      fetchSpy,
      new Response(JSON.stringify({ errors: ['Forbidden'] }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const error = await catchError(updateRoom(ROOM_ID, { name: 'Renamed Room' }, TOKEN))
    expect(error).toBeInstanceOf(ChatworkApiError)
  })
})
