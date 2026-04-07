import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { ChatworkApiError } from '~/errors/chatwork-api-error'
import { listRoomMessages } from './list-room-messages'

const TOKEN = 'test-token'
const ROOM_ID = 555

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

describe('listRoomMessages', () => {
  let fetchSpy: FetchSpy

  beforeEach(() => {
    process.env.NODE_ENV = 'test'
    fetchSpy = makeFetchSpy()
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('returns array of messages on success', async () => {
    const messages = [{ message_id: '1', body: 'Hello', account: {}, send_time: 0 }]
    mockOnce(fetchSpy, new Response(JSON.stringify(messages), { status: 200 }))

    const result = await listRoomMessages(ROOM_ID, TOKEN)
    expect(result).toHaveLength(1)
    expect(result[0]?.message_id).toBe('1')
  })

  it('includes force=1 when force is true', async () => {
    mockOnce(fetchSpy, new Response(JSON.stringify([]), { status: 200 }))

    await listRoomMessages(ROOM_ID, TOKEN, true)

    const [url] = fetchSpy.mock.calls[0] as [string]
    expect(url).toContain('force=1')
  })

  it('does not include force param when force is false', async () => {
    mockOnce(fetchSpy, new Response(JSON.stringify([]), { status: 200 }))

    await listRoomMessages(ROOM_ID, TOKEN, false)

    const [url] = fetchSpy.mock.calls[0] as [string]
    expect(url).not.toContain('force=')
  })

  it('throws ChatworkApiError on failure', async () => {
    mockOnce(fetchSpy, new Response(JSON.stringify({ errors: ['Forbidden'] }), { status: 403 }))

    const error = await catchError(listRoomMessages(ROOM_ID, TOKEN))
    expect(error).toBeInstanceOf(ChatworkApiError)
  })
})
