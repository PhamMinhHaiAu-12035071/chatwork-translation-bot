import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

void mock.module('./env', () => ({
  env: {
    CHATWORK_API_TOKEN: 'test-token',
    CHATWORK_BOT_ACCOUNT_ID: 42,
    KAGI_TRANSLATOR_URL: 'http://kagi-translator:3002',
    PORT: 3000,
    NODE_ENV: 'test',
  },
}))

describe('createApp (translator)', () => {
  const roomConfigKeyHex = 'a'.repeat(64)
  let dataDir: string
  let roomId: string
  let freeRoomId: string
  let app: { handle(request: Request): Promise<Response> }

  beforeAll(async () => {
    const { FreeRoomConfigStore } = await import('~/services/free-room-config-store')
    const { RoomConfigStore } = await import('~/services/room-config-store')
    const { createApp } = await import('./app')

    dataDir = mkdtempSync(join(tmpdir(), 'translator-app-test-'))
    const store = new RoomConfigStore({
      dataDir,
      encryptionKeyHex: roomConfigKeyHex,
    })
    await store.init()
    const freeStore = new FreeRoomConfigStore({ dataDir })
    await freeStore.init()

    const room = await store.create({
      originalRoomId: 567890123,
      originalRoomName: 'Source Room',
      destinationRoomId: 678901234,
      destinationRoomName: 'Output Room',
      aiProvider: 'openai',
      aiModel: 'gpt-4o',
      translationStyle: 'TECHNICAL',
      aiApiToken: 'room-openai-token',
    })
    roomId = room.id
    await store.setEnabled(room.id, true)
    const freeRoom = await freeStore.create({
      originalRoomId: 777888999,
      originalRoomName: 'Free Source Room',
      destinationRoomId: 888999000,
      destinationRoomName: 'Free Output Room',
      kagiStyle: 'Clear',
    })
    freeRoomId = freeRoom.id

    app = createApp({ store, freeStore })
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
      success?: boolean
      data?: { id: string; destinationRoomName: string }[]
    }
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data?.[0]).toMatchObject({
      id: roomId,
      destinationRoomName: 'Output Room',
    })
  })

  it('GET /api/free-rooms returns the seeded free room list', async () => {
    const res = await app.handle(new Request('http://localhost/api/free-rooms'))
    expect(res.status).toBe(200)

    const body = (await res.json()) as {
      success?: boolean
      data?: { id: string; destinationRoomName: string }[]
    }
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data?.[0]).toMatchObject({
      id: freeRoomId,
      destinationRoomName: 'Free Output Room',
    })
  })

  it('GET /api/providers returns 200', async () => {
    const res = await app.handle(new Request('http://localhost/api/providers'))
    expect(res.status).toBe(200)
  })

  it('unknown non-API route falls through to SPA catch-all', async () => {
    const res = await app.handle(new Request('http://localhost/unknown'))
    // 200 when dashboard dist is built (serves index.html for client-side routing)
    // 503 when dashboard dist is not built
    expect([200, 503]).toContain(res.status)
  })

  it('unknown API route returns 404 via SPA catch-all guard', async () => {
    const res = await app.handle(new Request('http://localhost/api/nonexistent'))
    expect(res.status).toBe(404)
  })
})
