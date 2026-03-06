import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Elysia from 'elysia'
import type { translateRoutes as TranslateRoutesType } from './router'

const routerTestOutputDir = mkdtempSync(join(tmpdir(), 'router-test-'))
process.env['OUTPUT_BASE_DIR'] = routerTestOutputDir

describe('translateRoutes', () => {
  let translateRoutes: typeof TranslateRoutesType
  let app: ReturnType<typeof Elysia.prototype.use>

  beforeAll(async () => {
    const realCore = await import('@chatwork-bot/core')

    void mock.module('@chatwork-bot/core', () => ({
      ...realCore,
      ChatworkClient: class {
        getMembers = mock(() => Promise.resolve([]))
        sendMessage = mock(() => Promise.resolve({ message_id: 'mock-id' }))
      },
    }))

    void mock.module('../env', () => ({
      env: {
        AI_PROVIDER: 'openai',
        AI_MODEL: 'gpt-4o',
        PORT: 3000,
        NODE_ENV: 'test',
        CHATWORK_API_TOKEN: 'test-token',
        CHATWORK_DESTINATION_ROOM_ID: 99999,
      },
    }))

    const mod = await import('./router')
    translateRoutes = mod.translateRoutes
    app = new Elysia().use(translateRoutes)
  })

  afterAll(() => {
    delete process.env['OUTPUT_BASE_DIR']
    rmSync(routerTestOutputDir, { recursive: true, force: true })
  })

  const validPayload = {
    event: {
      webhook_setting_id: '12345',
      webhook_event_type: 'message_created',
      webhook_event_time: 1498028130,
      webhook_event: {
        message_id: '789012345',
        room_id: 567890123,
        account_id: 123456,
        body: 'Hello World',
        send_time: 1498028125,
        update_time: 0,
      },
    },
  }

  it('returns 200 OK with valid payload', async () => {
    const res = await app.handle(
      new Request('http://localhost/internal/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload),
      }),
    )
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('OK')
  })

  it('POST /internal/translate with missing event returns 422', async () => {
    const res = await app.handle(
      new Request('http://localhost/internal/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: 'payload' }),
      }),
    )
    expect(res.status).toBe(422)
  })
})
