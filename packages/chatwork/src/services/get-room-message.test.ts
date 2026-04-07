import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { ChatworkApiError } from '~/errors/chatwork-api-error'
import type { ChatworkMessage } from '~/types/message'
import { getRoomMessage } from './get-room-message'

const TOKEN = 'test-token'
const ROOM_ID = 444
const MESSAGE_ID = 'msg-xyz'

const MESSAGE: ChatworkMessage = {
  message_id: MESSAGE_ID,
  account: {
    account_id: 1,
    name: 'Bob',
    avatar_image_url: 'https://example.com/bob.jpg',
  },
  body: 'Test message body',
  send_time: 1710000000,
  update_time: 0,
}

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

describe('getRoomMessage', () => {
  let fetchSpy: FetchSpy

  beforeEach(() => {
    process.env.NODE_ENV = 'test'
    fetchSpy = makeFetchSpy()
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('returns message on success', async () => {
    mockOnce(fetchSpy, new Response(JSON.stringify(MESSAGE), { status: 200 }))

    const result = await getRoomMessage(ROOM_ID, MESSAGE_ID, TOKEN)
    expect(result.message_id).toBe(MESSAGE_ID)
    expect(result.body).toBe('Test message body')
  })

  it('throws ChatworkApiError on failure', async () => {
    mockOnce(
      fetchSpy,
      new Response(JSON.stringify({ errors: ['Message not found'] }), { status: 404 }),
    )

    const error = await catchError(getRoomMessage(ROOM_ID, MESSAGE_ID, TOKEN))
    expect(error).toBeInstanceOf(ChatworkApiError)
  })
})
