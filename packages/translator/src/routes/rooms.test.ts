import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Elysia } from 'elysia'
import { RoomConfigStore } from '~/services/room-config-store'

const mockCreateChatworkRoom = mock(() => Promise.resolve({ room_id: 99001 }))
const mockDeleteChatworkRoom = mock(() => Promise.resolve())
const mockUpdateChatworkRoom = mock(() => Promise.resolve())

void mock.module('@chatwork-bot/chatwork', () => ({
  createRoom: mockCreateChatworkRoom,
  deleteRoom: mockDeleteChatworkRoom,
  updateRoom: mockUpdateChatworkRoom,
}))

const KEY_HEX = 'a'.repeat(64)
const API_TOKEN = 'test-chatwork-token'
const BOT_ACCOUNT_ID = 42

async function buildApp(dataDir: string) {
  const store = new RoomConfigStore({ dataDir, encryptionKeyHex: KEY_HEX })
  await store.init()
  const { createRoomsRoutes } = await import('./rooms')
  const routes = createRoomsRoutes({
    store,
    chatworkApiToken: API_TOKEN,
    chatworkBotAccountId: BOT_ACCOUNT_ID,
  })

  return new Elysia().use(routes)
}

const VALID_BODY = {
  originalRoomId: 1001,
  destinationRoomName: 'Translation Output',
  aiProvider: 'openai',
  aiModel: 'gpt-4o',
  translationStyle: 'PROFESSIONAL_BUSINESS',
  aiApiToken: 'sk-openai-key',
  webhookSecret: 'webhook-secret-abc',
}

interface AppHandle {
  handle(request: Request): Promise<Response>
}

async function createRoomForTest(app: AppHandle): Promise<{ id: string }> {
  const createRes = await app.handle(
    new Request('http://localhost/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    }),
  )

  const body = (await createRes.json()) as {
    success?: boolean
    data?: { id: string }
  }

  expect(body.success).toBe(true)

  if (body.data === undefined) {
    throw new Error('Expected room data envelope')
  }

  return body.data
}

afterEach(() => {
  mockCreateChatworkRoom.mockClear()
  mockCreateChatworkRoom.mockImplementation(() => Promise.resolve({ room_id: 99001 }))
  mockDeleteChatworkRoom.mockClear()
  mockDeleteChatworkRoom.mockImplementation(() => Promise.resolve())
  mockUpdateChatworkRoom.mockClear()
  mockUpdateChatworkRoom.mockImplementation(() => Promise.resolve())
})

describe('GET /api/rooms', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'rooms-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns success envelope with an empty array when no rooms', async () => {
    const app = await buildApp(tmpDir)
    const response = await app.handle(new Request('http://localhost/api/rooms'))

    expect(response.status).toBe(200)

    const body = (await response.json()) as {
      success?: boolean
      data?: unknown[]
    }

    expect(body.success).toBe(true)
    expect(body.data).toEqual([])
  })

  it('returns success envelope with rooms and secrets redacted', async () => {
    const app = await buildApp(tmpDir)

    await app.handle(
      new Request('http://localhost/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_BODY),
      }),
    )

    const response = await app.handle(new Request('http://localhost/api/rooms'))
    const body = (await response.json()) as {
      success?: boolean
      data?: Record<string, unknown>[]
    }

    const data = body.data ?? []

    expect(body.success).toBe(true)
    expect(data).toHaveLength(1)
    expect(data[0]).not.toHaveProperty('encryptedAiApiToken')
    expect(data[0]).not.toHaveProperty('encryptedWebhookSecret')
  })
})

describe('GET /api/rooms/:id', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'rooms-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns a success envelope for a room', async () => {
    const app = await buildApp(tmpDir)
    const room = await createRoomForTest(app)

    const response = await app.handle(new Request(`http://localhost/api/rooms/${room.id}`))

    expect(response.status).toBe(200)

    const body = (await response.json()) as {
      success?: boolean
      data?: { id: string }
    }

    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({ id: room.id })
  })

  it('returns 404 when the room does not exist', async () => {
    const app = await buildApp(tmpDir)
    const response = await app.handle(new Request('http://localhost/api/rooms/non-existent-id'))

    expect(response.status).toBe(404)
  })
})

describe('POST /api/rooms', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'rooms-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('creates a room and returns a success envelope with webhook URL', async () => {
    const app = await buildApp(tmpDir)
    const response = await app.handle(
      new Request('http://localhost/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_BODY),
      }),
    )

    expect(response.status).toBe(201)

    const body = (await response.json()) as {
      success?: boolean
      data?: Record<string, unknown>
      webhookUrl: string
    }

    expect(body.success).toBe(true)
    expect(body.data).toHaveProperty('enabled', true)
    expect(body.data).not.toHaveProperty('encryptedAiApiToken')
    expect(body.data).not.toHaveProperty('encryptedWebhookSecret')
    expect(body).toHaveProperty('webhookUrl')
    expect(body.webhookUrl).toBe('http://localhost/webhook')
    expect(mockCreateChatworkRoom).toHaveBeenCalledTimes(1)
    expect(mockCreateChatworkRoom).toHaveBeenCalledWith(
      { name: 'Translation Output', members_admin_ids: BOT_ACCOUNT_ID.toString() },
      API_TOKEN,
    )
  })

  it('uses X-Forwarded-* headers for webhook URL when behind a proxy', async () => {
    const app = await buildApp(tmpDir)
    const response = await app.handle(
      new Request('http://localhost/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-Host': 'bot.share.zrok.io',
          'X-Forwarded-Proto': 'https',
        },
        body: JSON.stringify({ ...VALID_BODY, originalRoomId: 9999 }),
      }),
    )

    expect(response.status).toBe(201)

    const body = (await response.json()) as { webhookUrl: string }
    expect(body.webhookUrl).toBe('https://bot.share.zrok.io/webhook')
  })

  it('returns 409 on duplicate originalRoomId', async () => {
    const app = await buildApp(tmpDir)

    await app.handle(
      new Request('http://localhost/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_BODY),
      }),
    )

    const response = await app.handle(
      new Request('http://localhost/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_BODY),
      }),
    )

    expect(response.status).toBe(409)
    expect(mockCreateChatworkRoom).toHaveBeenCalledTimes(1)
  })

  it('warns when destinationRoomName matches an existing room', async () => {
    const warnLines: string[] = []
    const originalWarn = console.warn
    console.warn = mock((line: string) => {
      warnLines.push(line)
    }) as typeof console.warn

    try {
      const app = await buildApp(tmpDir)

      await app.handle(
        new Request('http://localhost/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(VALID_BODY),
        }),
      )

      const response = await app.handle(
        new Request('http://localhost/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...VALID_BODY,
            originalRoomId: 1002,
          }),
        }),
      )

      expect(response.status).toBe(201)
      expect(warnLines.some((line) => line.includes('duplicate_destination_room_name'))).toBe(true)
    } finally {
      console.warn = originalWarn
    }
  })

  it('returns 502 and does not persist room config when Chatwork room creation fails', async () => {
    mockCreateChatworkRoom.mockImplementationOnce(() => Promise.reject(new Error('chatwork boom')))

    const app = await buildApp(tmpDir)
    const response = await app.handle(
      new Request('http://localhost/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_BODY),
      }),
    )

    expect(response.status).toBe(502)

    const listResponse = await app.handle(new Request('http://localhost/api/rooms'))
    const listBody = (await listResponse.json()) as {
      success?: boolean
      data?: unknown[]
    }

    expect(listBody.success).toBe(true)
    expect(listBody.data).toEqual([])

    const persisted = (await Bun.file(join(tmpDir, 'room-configs.json')).json()) as {
      rooms?: unknown[]
      version?: number
    }

    expect(persisted.version).toBe(1)
    expect(persisted.rooms).toEqual([])
  })

  it('returns 400 on invalid body', async () => {
    const app = await buildApp(tmpDir)
    const response = await app.handle(
      new Request('http://localhost/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalRoomId: 'not-a-number' }),
      }),
    )

    expect(response.status).toBe(400)
  })
})

describe('PUT /api/rooms/:id', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'rooms-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('updates a room locally without calling Chatwork when the name is unchanged', async () => {
    const app = await buildApp(tmpDir)
    const room = await createRoomForTest(app)

    const updateRes = await app.handle(
      new Request(`http://localhost/api/rooms/${room.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ translationStyle: 'TECHNICAL' }),
      }),
    )

    expect(updateRes.status).toBe(200)

    const body = (await updateRes.json()) as {
      success?: boolean
      data?: Record<string, unknown>
    }

    expect(body.success).toBe(true)
    expect(body.data).toHaveProperty('translationStyle', 'TECHNICAL')
    expect(mockUpdateChatworkRoom).not.toHaveBeenCalled()
  })

  it('renames the destination room on Chatwork before persisting locally', async () => {
    const app = await buildApp(tmpDir)
    const room = await createRoomForTest(app)

    const updateRes = await app.handle(
      new Request(`http://localhost/api/rooms/${room.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinationRoomName: 'Renamed Output Room' }),
      }),
    )

    expect(updateRes.status).toBe(200)

    const body = (await updateRes.json()) as {
      success?: boolean
      data?: Record<string, unknown>
    }

    expect(body.success).toBe(true)
    expect(body.data).toHaveProperty('destinationRoomName', 'Renamed Output Room')
    expect(mockUpdateChatworkRoom).toHaveBeenCalledTimes(1)
    expect(mockUpdateChatworkRoom).toHaveBeenCalledWith(
      99001,
      { name: 'Renamed Output Room' },
      API_TOKEN,
    )
  })

  it('returns 502 and leaves local data unchanged when Chatwork rename fails', async () => {
    mockUpdateChatworkRoom.mockImplementationOnce(() =>
      Promise.reject(new Error('Chatwork rename failed')),
    )

    const app = await buildApp(tmpDir)
    const room = await createRoomForTest(app)

    const updateRes = await app.handle(
      new Request(`http://localhost/api/rooms/${room.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationRoomName: 'Renamed Output Room',
          translationStyle: 'TECHNICAL',
        }),
      }),
    )

    expect(updateRes.status).toBe(502)
    expect(mockUpdateChatworkRoom).toHaveBeenCalledTimes(1)

    const getRes = await app.handle(new Request(`http://localhost/api/rooms/${room.id}`))
    const body = (await getRes.json()) as {
      success?: boolean
      data?: Record<string, unknown>
    }

    expect(body.success).toBe(true)
    expect(body.data).toHaveProperty('destinationRoomName', 'Translation Output')
    expect(body.data).toHaveProperty('translationStyle', 'PROFESSIONAL_BUSINESS')
  })

  it('returns 404 for unknown id', async () => {
    const app = await buildApp(tmpDir)
    const response = await app.handle(
      new Request('http://localhost/api/rooms/non-existent-id', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ translationStyle: 'TECHNICAL' }),
      }),
    )

    expect(response.status).toBe(404)
    expect(mockUpdateChatworkRoom).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid update body', async () => {
    const app = await buildApp(tmpDir)
    const room = await createRoomForTest(app)

    const response = await app.handle(
      new Request(`http://localhost/api/rooms/${room.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ translationStyle: 'NOT_A_STYLE' }),
      }),
    )

    expect(response.status).toBe(400)
  })
})

describe('DELETE /api/rooms/:id', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'rooms-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('deletes a room on Chatwork and returns deleted outcome', async () => {
    const app = await buildApp(tmpDir)
    const room = await createRoomForTest(app)

    const deleteRes = await app.handle(
      new Request(`http://localhost/api/rooms/${room.id}`, { method: 'DELETE' }),
    )

    expect(deleteRes.status).toBe(200)

    const deleteBody = (await deleteRes.json()) as {
      success?: boolean
      data?: { outcome?: string }
    }

    expect(deleteBody.success).toBe(true)
    expect(deleteBody.data?.outcome).toBe('deleted')
    expect(mockDeleteChatworkRoom).toHaveBeenCalledTimes(1)
    expect(mockDeleteChatworkRoom).toHaveBeenCalledWith(99001, API_TOKEN)

    const listRes = await app.handle(new Request('http://localhost/api/rooms'))
    const body = (await listRes.json()) as {
      success?: boolean
      data?: unknown[]
    }

    expect(body.success).toBe(true)
    expect(body.data).toEqual([])
  })

  it('treats a Chatwork 404 as already deleted and still removes the local config', async () => {
    mockDeleteChatworkRoom.mockImplementationOnce(() =>
      Promise.reject(Object.assign(new Error('Room not found'), { statusCode: 404 })),
    )

    const app = await buildApp(tmpDir)
    const room = await createRoomForTest(app)

    const deleteRes = await app.handle(
      new Request(`http://localhost/api/rooms/${room.id}`, { method: 'DELETE' }),
    )

    expect(deleteRes.status).toBe(200)

    const deleteBody = (await deleteRes.json()) as {
      success?: boolean
      data?: { outcome?: string }
    }

    expect(deleteBody.success).toBe(true)
    expect(deleteBody.data?.outcome).toBe('already_deleted')

    const listRes = await app.handle(new Request('http://localhost/api/rooms'))
    const body = (await listRes.json()) as {
      success?: boolean
      data?: unknown[]
    }

    expect(body.success).toBe(true)
    expect(body.data).toEqual([])
  })

  it('returns 502 and preserves the local config when Chatwork delete fails', async () => {
    mockDeleteChatworkRoom.mockImplementationOnce(() =>
      Promise.reject(Object.assign(new Error('Forbidden'), { statusCode: 403 })),
    )

    const app = await buildApp(tmpDir)
    const room = await createRoomForTest(app)

    const deleteRes = await app.handle(
      new Request(`http://localhost/api/rooms/${room.id}`, { method: 'DELETE' }),
    )

    expect(deleteRes.status).toBe(502)

    const listRes = await app.handle(new Request('http://localhost/api/rooms'))
    const body = (await listRes.json()) as {
      success?: boolean
      data?: { id: string }[]
    }

    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data?.[0]?.id).toBe(room.id)
  })

  it('returns 404 when deleting an unknown room', async () => {
    const app = await buildApp(tmpDir)
    const response = await app.handle(
      new Request('http://localhost/api/rooms/non-existent-id', { method: 'DELETE' }),
    )

    expect(response.status).toBe(404)
    expect(mockDeleteChatworkRoom).toHaveBeenCalledTimes(0)
  })
})

describe('POST /api/rooms/:id/enable and /disable', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'rooms-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('enables a room and returns a success envelope', async () => {
    const app = await buildApp(tmpDir)
    const room = await createRoomForTest(app)

    const res = await app.handle(
      new Request(`http://localhost/api/rooms/${room.id}/enable`, { method: 'POST' }),
    )

    expect(res.status).toBe(200)

    const body = (await res.json()) as {
      success?: boolean
      data?: { enabled: boolean }
    }

    expect(body.success).toBe(true)
    expect(body.data?.enabled).toBe(true)
  })

  it('disables a room and returns a success envelope', async () => {
    const app = await buildApp(tmpDir)
    const room = await createRoomForTest(app)

    await app.handle(
      new Request(`http://localhost/api/rooms/${room.id}/enable`, { method: 'POST' }),
    )

    const res = await app.handle(
      new Request(`http://localhost/api/rooms/${room.id}/disable`, { method: 'POST' }),
    )

    expect(res.status).toBe(200)

    const body = (await res.json()) as {
      success?: boolean
      data?: { enabled: boolean }
    }

    expect(body.success).toBe(true)
    expect(body.data?.enabled).toBe(false)
  })

  it('returns 404 when enabling an unknown room', async () => {
    const app = await buildApp(tmpDir)
    const response = await app.handle(
      new Request('http://localhost/api/rooms/non-existent-id/enable', { method: 'POST' }),
    )

    expect(response.status).toBe(404)
  })

  it('returns 404 when disabling an unknown room', async () => {
    const app = await buildApp(tmpDir)
    const response = await app.handle(
      new Request('http://localhost/api/rooms/non-existent-id/disable', { method: 'POST' }),
    )

    expect(response.status).toBe(404)
  })
})
