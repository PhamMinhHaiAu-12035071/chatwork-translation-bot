import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { ChatworkApiError } from '~/errors/chatwork-api-error'
import { deleteRoom } from './delete-room'

const TOKEN = 'test-token'
const ROOM_ID = 222

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

describe('deleteRoom', () => {
  let fetchSpy: FetchSpy

  beforeEach(() => {
    process.env.NODE_ENV = 'test'
    fetchSpy = makeFetchSpy()
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('resolves without throwing on success', async () => {
    mockOnce(fetchSpy, new Response(null, { status: 204 }))

    await deleteRoom(ROOM_ID, TOKEN)
  })

  it('sends action_type=delete in the request body', async () => {
    let capturedBody = ''
    fetchSpy.mockImplementationOnce(((_input: unknown, init?: RequestInit) => {
      const rawBody = init?.body
      capturedBody = typeof rawBody === 'string' ? rawBody : ''
      return Promise.resolve(new Response(null, { status: 204 }))
    }) as unknown as typeof fetch)

    await deleteRoom(ROOM_ID, TOKEN)

    expect(capturedBody).toBe('action_type=delete')
  })

  it('throws ChatworkApiError on failure', async () => {
    mockOnce(
      fetchSpy,
      new Response(JSON.stringify({ errors: ['Room not found'] }), { status: 404 }),
    )

    const error = await catchError(deleteRoom(ROOM_ID, TOKEN))
    expect(error).toBeInstanceOf(ChatworkApiError)
  })
})
