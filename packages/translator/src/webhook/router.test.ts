import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Elysia from 'elysia'
import type { translateRoutes as TranslateRoutesType } from './router'

const routerTestOutputDir = mkdtempSync(join(tmpdir(), 'router-test-'))
process.env['OUTPUT_BASE_DIR'] = routerTestOutputDir
const mockHandleTranslateRequest = mock((_command: unknown, _context: unknown) => Promise.resolve())
const mockHandleFreeTranslateRequest = mock((_command: unknown, _context: unknown) =>
  Promise.resolve(),
)

void mock.module('./handler', () => ({
  handleTranslateRequest: mockHandleTranslateRequest,
}))
void mock.module('./free-handler', () => ({
  handleFreeTranslateRequest: mockHandleFreeTranslateRequest,
}))

describe('translateRoutes', () => {
  let translateRoutes: typeof TranslateRoutesType
  let app: ReturnType<typeof Elysia.prototype.use>

  beforeAll(async () => {
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

  beforeEach(() => {
    mockHandleTranslateRequest.mockClear()
    mockHandleFreeTranslateRequest.mockClear()
    mockHandleTranslateRequest.mockImplementation((_command: unknown, _context: unknown) =>
      Promise.resolve(),
    )
    mockHandleFreeTranslateRequest.mockImplementation((_command: unknown, _context: unknown) =>
      Promise.resolve(),
    )
  })

  const validPayload = {
    command: {
      sourceSystem: 'chatwork',
      sourceEventId: '789012345:message_created:1498028130',
      sourceEventType: 'message_created',
      sourceMessageId: '789012345',
      sourceRoomId: 567890123,
      senderAccountId: 123456,
      rawBody: 'Hello World',
      translatableText: 'Hello World',
      translationInputs: ['Hello World'],
      sendTime: 1498028125,
      updateTime: 0,
      audit: {
        receivedAt: new Date().toISOString(),
        rawSourceSnapshot: {
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
      },
    },
  }

  it('returns 200 OK with valid neutral DTO payload', async () => {
    const res = await app.handle(
      new Request('http://localhost/internal/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload),
      }),
    )
    await Bun.sleep(0)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('OK')
    expect(mockHandleTranslateRequest).toHaveBeenCalledTimes(1)
    expect(mockHandleFreeTranslateRequest).toHaveBeenCalledTimes(1)
  })

  it('forwards x-trace-id into both handler context wrappers', async () => {
    const traceId = 'trace-123-for-router-test'
    const callCountBefore = mockHandleTranslateRequest.mock.calls.length
    const freeCallCountBefore = mockHandleFreeTranslateRequest.mock.calls.length
    const res = await app.handle(
      new Request('http://localhost/internal/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-trace-id': traceId,
        },
        body: JSON.stringify(validPayload),
      }),
    )
    await Bun.sleep(0)

    expect(res.status).toBe(200)
    expect(mockHandleTranslateRequest.mock.calls.length).toBe(callCountBefore + 1)
    expect(mockHandleFreeTranslateRequest.mock.calls.length).toBe(freeCallCountBefore + 1)
    expect(mockHandleTranslateRequest.mock.calls.at(-1)?.[1]).toMatchObject({
      traceId,
    })
    expect(mockHandleFreeTranslateRequest.mock.calls.at(-1)?.[1]).toMatchObject({
      traceId,
    })
  })

  it('continues dispatching the Standard handler when the Free handler rejects', async () => {
    mockHandleFreeTranslateRequest.mockImplementationOnce(() => Promise.reject(new Error('boom')))

    const res = await app.handle(
      new Request('http://localhost/internal/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload),
      }),
    )
    await Bun.sleep(0)

    expect(res.status).toBe(200)
    expect(mockHandleTranslateRequest).toHaveBeenCalledTimes(1)
    expect(mockHandleFreeTranslateRequest).toHaveBeenCalledTimes(1)
  })

  it('POST /internal/translate with missing command returns 422', async () => {
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
