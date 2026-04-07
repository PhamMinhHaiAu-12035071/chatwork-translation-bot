import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { ChatworkApiError } from '~/errors/chatwork-api-error'
import type { ChatworkMember } from '~/types/message'
import { getRoomMembers } from './get-room-members'

const TOKEN = 'test-token'
const ROOM_ID = 333

const MEMBER: ChatworkMember = {
  account_id: 1,
  role: 'member',
  name: 'Alice',
  chatwork_id: 'alice',
  organization_id: 10,
  organization_name: 'Acme',
  department: 'Dev',
  avatar_image_url: 'https://example.com/alice.jpg',
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

describe('getRoomMembers', () => {
  let fetchSpy: FetchSpy

  beforeEach(() => {
    process.env.NODE_ENV = 'test'
    fetchSpy = makeFetchSpy()
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('returns array of members on success', async () => {
    mockOnce(fetchSpy, new Response(JSON.stringify([MEMBER]), { status: 200 }))

    const members = await getRoomMembers(ROOM_ID, TOKEN)
    expect(members).toHaveLength(1)
    expect(members[0]?.account_id).toBe(1)
    expect(members[0]?.name).toBe('Alice')
  })

  it('throws ChatworkApiError on failure', async () => {
    mockOnce(fetchSpy, new Response(JSON.stringify({ errors: ['Access denied'] }), { status: 403 }))

    const error = await catchError(getRoomMembers(ROOM_ID, TOKEN))
    expect(error).toBeInstanceOf(ChatworkApiError)
  })
})
