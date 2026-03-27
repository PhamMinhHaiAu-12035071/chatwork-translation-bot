import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Elysia } from 'elysia'
import { createInternalRoomSecretRoute } from './internal-room-secret'
import { RoomConfigStore } from '~/services/room-config-store'

const KEY_HEX = 'a'.repeat(64)
const INTERNAL_SECRET = 'my-internal-secret'
const consoleLogLines: string[] = []
const originalConsoleLog = console.log
const originalConsoleWarn = console.warn

function readJsonLogs(): { event?: string; roomId?: number; nextExpectedAction?: string }[] {
  return consoleLogLines
    .filter((line) => line.startsWith('{'))
    .map(
      (line) =>
        JSON.parse(line) as { event?: string; roomId?: number; nextExpectedAction?: string },
    )
}

async function buildApp(dataDir: string, enabled = true) {
  const store = new RoomConfigStore({ dataDir, encryptionKeyHex: KEY_HEX })
  await store.init()

  const room = await store.create({
    originalRoomId: 5001,
    destinationRoomId: 6001,
    destinationRoomName: 'Test Room',
    aiProvider: 'openai',
    aiModel: null,
    translationStyle: 'PROFESSIONAL_BUSINESS',
    aiApiToken: 'token-abc',
    webhookSecret: 'secret-xyz',
  })

  if (enabled) {
    await store.setEnabled(room.id, true)
  }

  const route = createInternalRoomSecretRoute({ store, internalApiSecret: INTERNAL_SECRET })
  return new Elysia().use(route)
}

describe('GET /internal/room-secret', () => {
  let tmpDir: string

  beforeEach(async () => {
    const captureConsole = (...args: unknown[]) => {
      consoleLogLines.push(args.map((arg) => String(arg)).join(' '))
    }
    console.log = mock(captureConsole) as typeof console.log
    console.warn = mock(captureConsole) as typeof console.warn
    tmpDir = await mkdtemp(join(tmpdir(), 'room-secret-test-'))
  })

  afterEach(async () => {
    console.log = originalConsoleLog
    console.warn = originalConsoleWarn
    consoleLogLines.length = 0
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns { secret: string } for an enabled room with correct internal secret', async () => {
    const traceId = 'trace-room-secret-resolved'
    const app = await buildApp(tmpDir, true)
    const response = await app.handle(
      new Request('http://localhost/internal/room-secret?room_id=5001', {
        headers: {
          'x-internal-secret': INTERNAL_SECRET,
          'x-trace-id': traceId,
        },
      }),
    )

    expect(response.status).toBe(200)

    const body = (await response.json()) as { secret: string }
    expect(body).toEqual({ secret: 'secret-xyz' })

    const resolvedLog = readJsonLogs().find(
      (entry) => entry.event === 'room_secret_lookup_resolved',
    )
    expect(resolvedLog).toMatchObject({
      event: 'room_secret_lookup_resolved',
      traceId,
    })
  })

  it('returns 404 for a disabled room', async () => {
    const traceId = 'trace-room-secret-disabled'
    const app = await buildApp(tmpDir, false)
    const response = await app.handle(
      new Request('http://localhost/internal/room-secret?room_id=5001', {
        headers: {
          'x-internal-secret': INTERNAL_SECRET,
          'x-trace-id': traceId,
        },
      }),
    )

    expect(response.status).toBe(404)

    const disabledLog = readJsonLogs().find(
      (entry) => entry.event === 'room_secret_lookup_room_disabled',
    )
    expect(disabledLog).toMatchObject({
      event: 'room_secret_lookup_room_disabled',
      traceId,
      nextExpectedAction: 'enable_room',
    })
  })

  it('returns 401 when X-Internal-Secret is missing', async () => {
    const app = await buildApp(tmpDir)
    const response = await app.handle(
      new Request('http://localhost/internal/room-secret?room_id=5001'),
    )

    expect(response.status).toBe(401)
  })

  it('returns 401 when X-Internal-Secret is wrong', async () => {
    const app = await buildApp(tmpDir)
    const response = await app.handle(
      new Request('http://localhost/internal/room-secret?room_id=5001', {
        headers: { 'x-internal-secret': 'wrong-secret' },
      }),
    )

    expect(response.status).toBe(401)
  })

  it('returns 404 for unknown room_id', async () => {
    const traceId = 'trace-room-secret-missing'
    const app = await buildApp(tmpDir, true)
    const response = await app.handle(
      new Request('http://localhost/internal/room-secret?room_id=9999', {
        headers: {
          'x-internal-secret': INTERNAL_SECRET,
          'x-trace-id': traceId,
        },
      }),
    )

    expect(response.status).toBe(404)

    const notFoundLog = readJsonLogs().find(
      (entry) => entry.event === 'room_secret_lookup_not_found',
    )
    expect(notFoundLog).toMatchObject({
      event: 'room_secret_lookup_not_found',
      traceId,
    })
  })

  it('returns 400 when room_id query param is missing', async () => {
    const app = await buildApp(tmpDir, true)
    const response = await app.handle(
      new Request('http://localhost/internal/room-secret', {
        headers: { 'x-internal-secret': INTERNAL_SECRET },
      }),
    )

    expect(response.status).toBe(400)
  })

  it('returns 400 when room_id query param is not a number', async () => {
    const app = await buildApp(tmpDir, true)
    const response = await app.handle(
      new Request('http://localhost/internal/room-secret?room_id=abc', {
        headers: { 'x-internal-secret': INTERNAL_SECRET },
      }),
    )

    expect(response.status).toBe(400)
  })
})
