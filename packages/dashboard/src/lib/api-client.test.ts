import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { ApiError, apiClient } from '~/lib/api-client'
import type { CreateRoomInput, RoomConfigPublic } from '~/lib/api-types'

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

describe('apiClient', () => {
  let fetchSpy: FetchSpy

  beforeEach(() => {
    fetchSpy = makeFetchSpy()
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('throws ApiError with status and message on non-ok JSON responses', async () => {
    mockOnce(
      fetchSpy,
      new Response(JSON.stringify({ success: false, error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const error = await catchError(apiClient.getRoom('missing-room'))

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(404)
    expect((error as ApiError).message).toBe('Not found')
  })

  it('returns the response envelope on successful JSON responses', async () => {
    const room: RoomConfigPublic = {
      id: 'room-001',
      originalRoomId: 123,
      destinationRoomId: 456,
      destinationRoomName: 'Sakura Desk JP',
      aiProvider: 'openai',
      aiModel: 'gpt-4o',
      translationStyle: 'PROFESSIONAL_BUSINESS',
      enabled: true,
      createdAt: '2026-03-20T09:00:00Z',
      updatedAt: '2026-03-20T09:00:00Z',
    }

    mockOnce(
      fetchSpy,
      new Response(JSON.stringify({ success: true, data: room }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const response = await apiClient.getRoom('room-001')

    expect(response.success).toBe(true)
    expect(response.data).toEqual(room)
  })

  it('handles 204 No Content for deleteRoom', async () => {
    mockOnce(fetchSpy, new Response(null, { status: 204 }))

    const response = await apiClient.deleteRoom('room-001')

    expect(response.success).toBe(true)
  })

  it('sends webhookSecret in createRoom requests', async () => {
    mockOnce(
      fetchSpy,
      new Response(JSON.stringify({ success: true, data: { id: 'room-002' } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const input: CreateRoomInput = {
      originalRoomId: 555001,
      destinationRoomName: 'Osaka Escalations',
      aiProvider: 'openai',
      aiModel: null,
      translationStyle: 'AUTO_CONTEXT',
      aiApiToken: 'sk-new-room',
      webhookSecret: 'cw-secret-555001',
    }

    await apiClient.createRoom(input)

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as CreateRoomInput

    expect(body.webhookSecret).toBe('cw-secret-555001')
  })
})
