import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Elysia } from 'elysia'
import { RoomConfigStore } from '~/services/room-config-store'

const mockCreateChatworkRoom = mock(() => Promise.resolve({ room_id: 99001 }))

void mock.module('@chatwork-bot/chatwork', () => ({
  createRoom: mockCreateChatworkRoom,
}))

const KEY_HEX = 'a'.repeat(64)
const API_TOKEN = 'test-chatwork-token'

async function buildApp(dataDir: string) {
  const store = new RoomConfigStore({ dataDir, encryptionKeyHex: KEY_HEX })
  await store.init()
  const { createRoomsRoutes } = await import('./rooms')
  const routes = createRoomsRoutes({ store, chatworkApiToken: API_TOKEN })

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

afterEach(() => {
  mockCreateChatworkRoom.mockClear()
  mockCreateChatworkRoom.mockImplementation(() => Promise.resolve({ room_id: 99001 }))
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
    const createRes = await app.handle(
      new Request('http://localhost/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_BODY),
      }),
    )
    const { room } = (await createRes.json()) as { room: { id: string } }

    const response = await app.handle(new Request(`http://localhost/api/rooms/${room.id}`))

    expect(response.status).toBe(200)

    const body = (await response.json()) as {
      success?: boolean
      data?: { id: string }
    }

    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({ id: room.id })
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
    expect(body.data).toHaveProperty('enabled', false)
    expect(body.data).not.toHaveProperty('encryptedAiApiToken')
    expect(body.data).not.toHaveProperty('encryptedWebhookSecret')
    expect(body).toHaveProperty('webhookUrl')
    expect(body).toHaveProperty('webhookUrl')
    expect(body.webhookUrl).toBe('http://localhost/webhook')
    expect(mockCreateChatworkRoom).toHaveBeenCalledTimes(1)
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

  it('updates a room and returns a success envelope', async () => {
    const app = await buildApp(tmpDir)
    const createRes = await app.handle(
      new Request('http://localhost/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_BODY),
      }),
    )
    const { room } = (await createRes.json()) as { room: { id: string } }

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

  it('deletes a room', async () => {
    const app = await buildApp(tmpDir)
    const createRes = await app.handle(
      new Request('http://localhost/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_BODY),
      }),
    )
    const { room } = (await createRes.json()) as { room: { id: string } }

    const deleteRes = await app.handle(
      new Request(`http://localhost/api/rooms/${room.id}`, { method: 'DELETE' }),
    )

    expect(deleteRes.status).toBe(204)

    const listRes = await app.handle(new Request('http://localhost/api/rooms'))
    const body = (await listRes.json()) as { rooms: unknown[] }
    expect(body.rooms).toHaveLength(0)
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
    const createRes = await app.handle(
      new Request('http://localhost/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_BODY),
      }),
    )
    const { room } = (await createRes.json()) as { room: { id: string } }

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
    const createRes = await app.handle(
      new Request('http://localhost/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_BODY),
      }),
    )
    const { room } = (await createRes.json()) as { room: { id: string } }

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
})
