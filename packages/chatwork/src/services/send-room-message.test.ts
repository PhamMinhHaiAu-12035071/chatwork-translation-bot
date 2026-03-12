import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { ChatworkApiError } from '~/errors/chatwork-api-error'
import { sendRoomMessage } from './send-room-message'

const TOKEN = 'test-token'
const ROOM_ID = 111

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

describe('sendRoomMessage', () => {
  let fetchSpy: FetchSpy

  beforeEach(() => {
    fetchSpy = makeFetchSpy()
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('returns message_id on success', async () => {
    mockOnce(fetchSpy, new Response(JSON.stringify({ message_id: '42' }), { status: 200 }))

    const result = await sendRoomMessage(ROOM_ID, 'Hello world', TOKEN)
    expect(result.message_id).toBe('42')
  })

  it('throws ChatworkApiError on failure', async () => {
    mockOnce(fetchSpy, new Response(JSON.stringify({ errors: ['Bad request'] }), { status: 400 }))

    const error = await catchError(sendRoomMessage(ROOM_ID, 'Hello', TOKEN))
    expect(error).toBeInstanceOf(ChatworkApiError)
  })
})
