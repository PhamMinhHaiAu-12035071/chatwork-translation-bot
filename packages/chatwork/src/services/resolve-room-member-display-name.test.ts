import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { ChatworkApiError } from '~/errors/chatwork-api-error'
import type { ChatworkMember } from '~/types/message'
import { resolveRoomMemberDisplayName } from './resolve-room-member-display-name'

const TOKEN = 'test-token'
const ROOM_ID = 666
const ACCOUNT_ID = 42

const MEMBER: ChatworkMember = {
  account_id: ACCOUNT_ID,
  role: 'member',
  name: 'Carol',
  chatwork_id: 'carol',
  organization_id: 10,
  organization_name: 'Acme',
  department: 'Design',
  avatar_image_url: 'https://example.com/carol.jpg',
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

describe('resolveRoomMemberDisplayName', () => {
  let fetchSpy: FetchSpy

  beforeEach(() => {
    fetchSpy = makeFetchSpy()
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('returns matching member name and writes to cache', async () => {
    mockOnce(fetchSpy, new Response(JSON.stringify([MEMBER]), { status: 200 }))

    const cache = new Map<number, string>()
    const name = await resolveRoomMemberDisplayName(ROOM_ID, ACCOUNT_ID, TOKEN, cache)

    expect(name).toBe('Carol')
    expect(cache.get(ACCOUNT_ID)).toBe('Carol')
  })

  it('uses cached value on second call — no additional fetch', async () => {
    mockOnce(fetchSpy, new Response(JSON.stringify([MEMBER]), { status: 200 }))

    const cache = new Map<number, string>()

    const callsBefore = fetchSpy.mock.calls.length
    // First call — fetches
    await resolveRoomMemberDisplayName(ROOM_ID, ACCOUNT_ID, TOKEN, cache)
    const callsAfterFirst = fetchSpy.mock.calls.length
    // Second call — uses cache
    const name = await resolveRoomMemberDisplayName(ROOM_ID, ACCOUNT_ID, TOKEN, cache)
    const callsAfterSecond = fetchSpy.mock.calls.length

    expect(name).toBe('Carol')
    // Only 1 new fetch call was made (on the first call), not on the second
    expect(callsAfterFirst - callsBefore).toBe(1)
    expect(callsAfterSecond - callsAfterFirst).toBe(0)
  })

  it('falls back to #account_id when member not found in API response', async () => {
    mockOnce(
      fetchSpy,
      new Response(JSON.stringify([{ account_id: 999, name: 'Other' }]), { status: 200 }),
    )

    const name = await resolveRoomMemberDisplayName(ROOM_ID, ACCOUNT_ID, TOKEN)
    expect(name).toBe(`#${ACCOUNT_ID.toString()}`)
  })

  it('surfaces typed API errors when member loading fails', async () => {
    mockOnce(fetchSpy, new Response(JSON.stringify({ errors: ['Forbidden'] }), { status: 403 }))

    const error = await catchError(resolveRoomMemberDisplayName(ROOM_ID, ACCOUNT_ID, TOKEN))
    expect(error).toBeInstanceOf(ChatworkApiError)
  })

  it('works without an explicit cache parameter', async () => {
    mockOnce(fetchSpy, new Response(JSON.stringify([MEMBER]), { status: 200 }))

    const name = await resolveRoomMemberDisplayName(ROOM_ID, ACCOUNT_ID, TOKEN)
    expect(name).toBe('Carol')
  })
})
