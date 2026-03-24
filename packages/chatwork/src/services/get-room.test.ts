import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { ChatworkApiError } from '~/errors/chatwork-api-error'
import { getRoom } from './get-room'

const TOKEN = 'test-token'
const ROOM_ID = 12345

type FetchSpy = ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>

function makeFetchSpy(): FetchSpy {
  return spyOn(globalThis, 'fetch').mockImplementation((() => {
    throw new Error('Unexpected real HTTP call')
  }) as unknown as typeof fetch)
}

function mockOnce(spy: FetchSpy, response: Response): void {
  spy.mockImplementationOnce((() => Promise.resolve(response)) as unknown as typeof fetch)
}

describe('getRoom', () => {
  let fetchSpy: FetchSpy

  beforeEach(() => {
    fetchSpy = makeFetchSpy()
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('returns room object on success', async () => {
    const room = { room_id: ROOM_ID, name: 'Test Room' }
    mockOnce(fetchSpy, new Response(JSON.stringify(room), { status: 200 }))

    const result = await getRoom(ROOM_ID, TOKEN)
    expect(result.room_id).toBe(ROOM_ID)
    expect(result.name).toBe('Test Room')
  })

  it('throws ChatworkApiError on failure', async () => {
    mockOnce(fetchSpy, new Response(JSON.stringify({ errors: ['Not found'] }), { status: 404 }))

    let error: unknown
    try {
      await getRoom(ROOM_ID, TOKEN)
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(ChatworkApiError)
  })
})
