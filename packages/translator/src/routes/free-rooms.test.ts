import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Elysia } from 'elysia'
import { FreeRoomConfigStore } from '~/services/free-room-config-store'

const mockCreateChatworkRoom = mock(() => Promise.resolve({ room_id: 99001 }))
const mockDeleteChatworkRoom = mock(() => Promise.resolve())
const mockUpdateChatworkRoom = mock(() => Promise.resolve())

// Mirror @chatwork-bot/chatwork composeRoomDescription for mock.module (package is mocked)
function composeRoomDescription(originalRoomName: string): string {
  return `◦•●◉✿ TRANSLATION ROOM ✿◉●•◦
╰┈☆ Original ☆┈╯: ${originalRoomName}`
}

void mock.module('@chatwork-bot/chatwork', () => ({
  createRoom: mockCreateChatworkRoom,
  deleteRoom: mockDeleteChatworkRoom,
  updateRoom: mockUpdateChatworkRoom,
  composeRoomDescription,
}))

const API_TOKEN = 'test-chatwork-token'
const BOT_ACCOUNT_ID = 42

async function buildApp(dataDir: string) {
  const store = new FreeRoomConfigStore({ dataDir })
  await store.init()
  const { createFreeRoomsRoutes } = await import('./free-rooms')
  const routes = createFreeRoomsRoutes({
    store,
    chatworkApiToken: API_TOKEN,
    chatworkBotAccountId: BOT_ACCOUNT_ID,
  })

  return new Elysia().use(routes)
}

const VALID_BODY = {
  originalRoomId: 1001,
  originalRoomName: 'Free Demo Room',
  destinationRoomName: 'Free Translation Output',
  kagiStyle: 'Clear',
  context: 'software team',
}

interface AppHandle {
  handle(request: Request): Promise<Response>
}

async function createFreeRoomForTest(app: AppHandle): Promise<{ id: string }> {
  const createRes = await app.handle(
    new Request('http://localhost/api/free-rooms', {
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

describe('free room routes', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'free-rooms-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('GET /api/free-rooms returns an empty success envelope when no rooms exist', async () => {
    const app = await buildApp(tmpDir)

    const response = await app.handle(new Request('http://localhost/api/free-rooms'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, data: [] })
  })

  it('POST /api/free-rooms creates a room, calls Chatwork, and returns a webhook URL', async () => {
    const app = await buildApp(tmpDir)

    const response = await app.handle(
      new Request('http://localhost/api/free-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_BODY),
      }),
    )

    expect(response.status).toBe(201)

    const body = (await response.json()) as {
      success?: boolean
      data?: Record<string, unknown>
      webhookUrl?: string
    }

    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({
      destinationRoomName: 'Free Translation Output',
      kagiStyle: 'Clear',
      enabled: true,
    })
    expect(body.webhookUrl).toBe('http://localhost/webhook')
    expect(mockCreateChatworkRoom).toHaveBeenCalledTimes(1)
  })

  it('PUT /api/free-rooms/:id updates the room and renames Chatwork when the room name changes', async () => {
    const app = await buildApp(tmpDir)
    const room = await createFreeRoomForTest(app)

    const response = await app.handle(
      new Request(`http://localhost/api/free-rooms/${room.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationRoomName: 'Renamed Free Room',
          kagiStyle: 'Polite',
        }),
      }),
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as { success?: boolean; data?: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({
      destinationRoomName: 'Renamed Free Room',
      kagiStyle: 'Polite',
    })
    expect(mockUpdateChatworkRoom).toHaveBeenCalledTimes(1)
  })

  it('POST /api/free-rooms/:id/disable and /enable toggles enabled state', async () => {
    const app = await buildApp(tmpDir)
    const room = await createFreeRoomForTest(app)

    const disableRes = await app.handle(
      new Request(`http://localhost/api/free-rooms/${room.id}/disable`, { method: 'POST' }),
    )
    expect(disableRes.status).toBe(200)
    expect((await disableRes.json()) as { data?: { enabled?: boolean } }).toMatchObject({
      data: { enabled: false },
    })

    const enableRes = await app.handle(
      new Request(`http://localhost/api/free-rooms/${room.id}/enable`, { method: 'POST' }),
    )
    expect(enableRes.status).toBe(200)
    expect((await enableRes.json()) as { data?: { enabled?: boolean } }).toMatchObject({
      data: { enabled: true },
    })
  })

  it('creates Chatwork room with description containing original room name', async () => {
    const app = await buildApp(tmpDir)
    mockCreateChatworkRoom.mockResolvedValue({ room_id: 888777 })

    const payload = {
      originalRoomId: 654321,
      originalRoomName: 'Free Demo Room',
      destinationRoomName: 'Free Translation',
      kagiStyle: 'Clear',
    }

    const response = await app.handle(
      new Request('http://localhost/api/free-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    )

    expect(response.status).toBe(201)

    expect(mockCreateChatworkRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining('TRANSLATION ROOM') as string,
      }),
      expect.any(String),
    )

    expect(mockCreateChatworkRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining('Free Demo Room') as string,
      }),
      expect.any(String),
    )
  })

  it('rejects creation without originalRoomName', async () => {
    const app = await buildApp(tmpDir)

    const payload = {
      originalRoomId: 654321,
      // originalRoomName: missing
      destinationRoomName: 'Free Translation',
      kagiStyle: 'Clear',
    }

    const response = await app.handle(
      new Request('http://localhost/api/free-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    )

    expect(response.status).toBe(400)

    const body = (await response.json()) as { error?: string }
    expect(body.error).toContain('Invalid request body')
  })
})
