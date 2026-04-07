import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { ChatworkApiError } from '~/errors/chatwork-api-error'
import { deleteRoomMessage } from './delete-room-message'

const TOKEN = 'test-token'
const ROOM_ID = 222
const MESSAGE_ID = 'msg-abc'

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
  } catch (e) {
    return e
  }
}

describe('deleteRoomMessage', () => {
  let fetchSpy: FetchSpy

  beforeEach(() => {
    process.env.NODE_ENV = 'test'
    fetchSpy = makeFetchSpy()
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('resolves without throwing on success', async () => {
    mockOnce(fetchSpy, new Response(JSON.stringify({ message_id: MESSAGE_ID }), { status: 200 }))

    await deleteRoomMessage(ROOM_ID, MESSAGE_ID, TOKEN)
    // resolves without throwing is sufficient — void return type confirmed by TypeScript
  })

  it('throws ChatworkApiError on failure', async () => {
    mockOnce(
      fetchSpy,
      new Response(JSON.stringify({ errors: ['Message not found'] }), { status: 404 }),
    )

    const error = await catchError(deleteRoomMessage(ROOM_ID, MESSAGE_ID, TOKEN))
    expect(error).toBeInstanceOf(ChatworkApiError)
  })
})
