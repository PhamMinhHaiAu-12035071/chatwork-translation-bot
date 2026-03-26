import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

void mock.module('./env', () => ({
  env: {
    CHATWORK_API_TOKEN: 'test-token',
    INTERNAL_API_SECRET: 'internal-secret',
    PORT: 3000,
    NODE_ENV: 'test',
  },
}))

describe('createApp (translator)', () => {
  const roomConfigKeyHex = 'a'.repeat(64)
  let dataDir: string
  let roomId: string
  let app: { handle(request: Request): Promise<Response> }

  beforeAll(async () => {
    const { RoomConfigStore } = await import('~/services/room-config-store')
    const { createApp } = await import('./app')

    dataDir = mkdtempSync(join(tmpdir(), 'translator-app-test-'))
    const store = new RoomConfigStore({
      dataDir,
      encryptionKeyHex: roomConfigKeyHex,
    })
    await store.init()

    const room = await store.create({
      originalRoomId: 567890123,
      destinationRoomId: 678901234,
      destinationRoomName: 'Output Room',
      aiProvider: 'openai',
      aiModel: 'gpt-4o',
      translationStyle: 'TECHNICAL',
      aiApiToken: 'room-openai-token',
      webhookSecret: 'room-secret',
    })
    roomId = room.id
    await store.setEnabled(room.id, true)

    app = createApp({ store })
  })

  afterAll(() => {
    rmSync(dataDir, { recursive: true, force: true })
  })

  it('GET /health returns 200', async () => {
    const res = await app.handle(new Request('http://localhost/health'))
    expect(res.status).toBe(200)
  })

  it('GET /status returns 200', async () => {
    const res = await app.handle(new Request('http://localhost/status'))
    expect(res.status).toBe(200)
  })

  it('GET /api/rooms returns the seeded room list', async () => {
    const res = await app.handle(new Request('http://localhost/api/rooms'))
    expect(res.status).toBe(200)

    const body = (await res.json()) as {
      rooms: { id: string; destinationRoomName: string }[]
    }
    expect(body.rooms).toHaveLength(1)
    expect(body.rooms[0]).toMatchObject({
      id: roomId,
      destinationRoomName: 'Output Room',
    })
  })

  it('GET /api/providers returns 200', async () => {
    const res = await app.handle(new Request('http://localhost/api/providers'))
    expect(res.status).toBe(200)
  })

  it('GET /internal/room-secret returns 200 with valid internal auth', async () => {
    const res = await app.handle(
      new Request('http://localhost/internal/room-secret?room_id=567890123', {
        headers: {
          'X-Internal-Secret': 'internal-secret',
        },
      }),
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as { webhookSecret: string }
    expect(body.webhookSecret).toBe('room-secret')
  })

  it('unknown route returns 404', async () => {
    const res = await app.handle(new Request('http://localhost/unknown'))
    expect(res.status).toBe(404)
  })
})
