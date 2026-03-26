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

  it('returns empty array when no rooms', async () => {
    const app = await buildApp(tmpDir)
    const response = await app.handle(new Request('http://localhost/api/rooms'))

    expect(response.status).toBe(200)

    const body = (await response.json()) as { rooms: unknown[] }
    expect(body.rooms).toHaveLength(0)
  })

  it('returns rooms with secrets redacted', async () => {
    const app = await buildApp(tmpDir)

    await app.handle(
      new Request('http://localhost/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_BODY),
      }),
    )

    const response = await app.handle(new Request('http://localhost/api/rooms'))
    const body = (await response.json()) as { rooms: Record<string, unknown>[] }

    expect(body.rooms).toHaveLength(1)
    expect(body.rooms[0]).not.toHaveProperty('encryptedAiApiToken')
    expect(body.rooms[0]).not.toHaveProperty('encryptedWebhookSecret')
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

  it('creates a room and returns 201 with webhook URL', async () => {
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
      room: Record<string, unknown>
      webhookUrl: string
    }
    expect(body).toHaveProperty('room')
    expect(body).toHaveProperty('webhookUrl')
    expect(body.room['enabled']).toBe(false)
    expect(body.room).not.toHaveProperty('encryptedAiApiToken')
    expect(body.room).not.toHaveProperty('encryptedWebhookSecret')
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

  it('updates a room', async () => {
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

    const body = (await updateRes.json()) as { room: Record<string, unknown> }
    expect(body.room['translationStyle']).toBe('TECHNICAL')
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

  it('enables a room', async () => {
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

    const body = (await res.json()) as { room: { enabled: boolean } }
    expect(body.room.enabled).toBe(true)
  })

  it('disables a room', async () => {
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

    const body = (await res.json()) as { room: { enabled: boolean } }
    expect(body.room.enabled).toBe(false)
  })
})
