import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { resolveRoomDisplayName } from './resolve-room-display-name'

type FetchSpy = ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>

function makeFetchSpy(): FetchSpy {
  return spyOn(globalThis, 'fetch').mockImplementation((() => {
    throw new Error('Unexpected real HTTP call')
  }) as unknown as typeof fetch)
}

function mockOnce(spy: FetchSpy, response: Response): void {
  spy.mockImplementationOnce((() => Promise.resolve(response)) as unknown as typeof fetch)
}

describe('resolveRoomDisplayName', () => {
  let fetchSpy: FetchSpy

  beforeEach(() => {
    process.env.NODE_ENV = 'test'
    fetchSpy = makeFetchSpy()
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('returns room name when lookup succeeds', async () => {
    const room = { room_id: 123, name: 'Project Alpha' }
    mockOnce(fetchSpy, new Response(JSON.stringify(room), { status: 200 }))

    const result = await resolveRoomDisplayName(123, 'test-token')

    expect(result).toBe('Project Alpha')
  })

  it('returns fallback when room not found', async () => {
    mockOnce(fetchSpy, new Response(JSON.stringify({ errors: ['Not found'] }), { status: 404 }))

    const result = await resolveRoomDisplayName(123, 'test-token')

    expect(result).toBe('Room #123')
  })

  it('returns fallback when lookup fails with other error', async () => {
    mockOnce(
      fetchSpy,
      new Response(JSON.stringify({ errors: ['Internal server error'] }), { status: 500 }),
    )

    const result = await resolveRoomDisplayName(456, 'test-token')

    expect(result).toBe('Room #456')
  })

  it('caches room names within a single request', async () => {
    const room = { room_id: 789, name: 'Cached Room' }
    mockOnce(fetchSpy, new Response(JSON.stringify(room), { status: 200 }))

    const cache = new Map<number, string>()
    const result1 = await resolveRoomDisplayName(789, 'test-token', cache)
    const result2 = await resolveRoomDisplayName(789, 'test-token', cache)

    expect(result1).toBe('Cached Room')
    expect(result2).toBe('Cached Room')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('uses provided cache map', async () => {
    const room = { room_id: 999, name: 'Custom Cache Room' }
    mockOnce(fetchSpy, new Response(JSON.stringify(room), { status: 200 }))

    const cache = new Map<number, string>()
    const result = await resolveRoomDisplayName(999, 'test-token', cache)

    expect(cache.get(999)).toBe('Custom Cache Room')
    expect(result).toBe('Custom Cache Room')
  })
})
