import { beforeAll, beforeEach, describe, expect, it, mock, setDefaultTimeout } from 'bun:test'
import type { createKagiServer as CreateKagiServerType } from './server'
import type { KagiSidecarError as KagiSidecarErrorType } from './browser-service'

setDefaultTimeout(10_000)

describe('createKagiServer', () => {
  let createKagiServer: typeof CreateKagiServerType
  let KagiSidecarError: typeof KagiSidecarErrorType

  const service = {
    translate: mock((_request: { text: string; style: string; context?: string }) =>
      Promise.resolve({
        translated: 'Xin chao',
        attempts: 1,
        queueWaitMs: 0,
        transportLatencyMs: 10,
      }),
    ),
    getHealthSnapshot: mock(() => ({
      ready: true,
      activeCount: 0,
      queuedCount: 0,
    })),
  }

  beforeAll(async () => {
    const serverModule = await import('./server')
    const browserModule = await import('./browser-service')

    createKagiServer = serverModule.createKagiServer
    KagiSidecarError = browserModule.KagiSidecarError
  })

  beforeEach(() => {
    service.translate.mockClear()
    service.getHealthSnapshot.mockClear()
    service.translate.mockImplementation((_request) =>
      Promise.resolve({
        translated: 'Xin chao',
        attempts: 1,
        queueWaitMs: 0,
        transportLatencyMs: 10,
      }),
    )
  })

  it('returns translated text for a valid request', async () => {
    const app = createKagiServer({ service })
    const response = await app.handle(
      new Request('http://localhost/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: 'Hello',
          style: 'Clear',
          context: 'software team',
        }),
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ translated: 'Xin chao' })
    expect(service.translate).toHaveBeenCalledWith({
      text: 'Hello',
      style: 'Clear',
      context: 'software team',
    })
  })

  it('rejects invalid request bodies with 422', async () => {
    const app = createKagiServer({ service })
    const response = await app.handle(
      new Request('http://localhost/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: '',
          style: 'Unknown',
        }),
      }),
    )

    expect(response.status).toBe(422)
    expect(service.translate).not.toHaveBeenCalled()
  })

  it('maps typed service errors to typed non-2xx responses', async () => {
    service.translate.mockRejectedValueOnce(
      new KagiSidecarError('PAYLOAD_TOO_LARGE', 'payload too large', {
        status: 413,
      }),
    )

    const app = createKagiServer({ service })
    const response = await app.handle(
      new Request('http://localhost/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: 'Hello',
          style: 'Clear',
        }),
      }),
    )

    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'payload too large',
      },
    })
  })

  it('exposes a health endpoint', async () => {
    const app = createKagiServer({ service })
    const response = await app.handle(new Request('http://localhost/health'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      ready: true,
      activeCount: 0,
      queuedCount: 0,
    })
  })
})
