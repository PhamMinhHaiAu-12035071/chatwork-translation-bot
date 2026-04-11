import { beforeEach, describe, expect, it, mock } from 'bun:test'

type FetchInput = string | URL | Request
type FetchCall = [FetchInput, RequestInit | undefined]

const mockFetch = mock((_input: FetchInput, _init?: RequestInit) =>
  Promise.resolve(new Response(JSON.stringify({ translated: 'Xin chao' }), { status: 200 })),
)

global.fetch = mockFetch as unknown as typeof fetch

function resolveUrl(input: FetchInput): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function getFetchCall(index: number): FetchCall {
  const call = mockFetch.mock.calls[index] as FetchCall | undefined

  if (call === undefined) {
    throw new Error(`Expected fetch call at index ${index.toString()}`)
  }

  return call
}

describe('KagiClient', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockImplementation((_input: FetchInput, _init?: RequestInit) =>
      Promise.resolve(new Response(JSON.stringify({ translated: 'Xin chao' }), { status: 200 })),
    )
  })

  it('translates successfully', async () => {
    const { KagiClient } = await import('./kagi-client')
    const client = new KagiClient('http://localhost:3002')

    const result = await client.translate({
      text: 'Hello',
      style: 'Clear',
    })

    expect(result).toEqual({ translated: 'Xin chao' })
  })

  it('normalizes trailing slash on baseUrl', async () => {
    const { KagiClient } = await import('./kagi-client')
    const client = new KagiClient('http://localhost:3002/')

    await client.translate({
      text: 'Hello',
      style: 'Clear',
    })

    const [input] = getFetchCall(0)
    expect(resolveUrl(input)).toBe('http://localhost:3002/translate')
  })

  it('sends text, style, and context in the request body', async () => {
    const { KagiClient } = await import('./kagi-client')
    const client = new KagiClient('http://localhost:3002')

    await client.translate({
      text: 'Hello',
      style: 'Raw',
      context: 'software team',
    })

    const [, init] = getFetchCall(0)
    const requestBody = init?.body

    if (typeof requestBody !== 'string') {
      throw new Error('Expected request body to be a JSON string')
    }

    expect(init?.method).toBe('POST')
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json')
    expect(JSON.parse(requestBody)).toEqual({
      text: 'Hello',
      style: 'Raw',
      context: 'software team',
    })
  })

  it('throws KagiClientError on non-OK response', async () => {
    mockFetch.mockImplementationOnce((_input: FetchInput, _init?: RequestInit) =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            error: {
              code: 'ANTI_ABUSE',
              message: 'captcha detected',
            },
          }),
          { status: 429 },
        ),
      ),
    )

    const { KagiClient, KagiClientError } = await import('./kagi-client')
    const client = new KagiClient('http://localhost:3002')

    try {
      await client.translate({
        text: 'Hello',
        style: 'Clear',
      })
      expect.unreachable('expected non-OK response to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(KagiClientError)
      expect(error).toMatchObject({
        code: 'ANTI_ABUSE',
        status: 429,
      })
    }
  })

  it('throws KagiClientError on network failure', async () => {
    mockFetch.mockImplementationOnce((_input: FetchInput, _init?: RequestInit) =>
      Promise.reject(new Error('connect ECONNREFUSED')),
    )

    const { KagiClient, KagiClientError } = await import('./kagi-client')
    const client = new KagiClient('http://localhost:3002')

    try {
      await client.translate({
        text: 'Hello',
        style: 'Clear',
      })
      expect.unreachable('expected network failure to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(KagiClientError)
      expect(error).toMatchObject({
        code: 'NETWORK_ERROR',
      })
    }
  })

  it('round-trips typed error payloads with useful codes and messages', async () => {
    mockFetch.mockImplementationOnce((_input: FetchInput, _init?: RequestInit) =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            error: {
              code: 'PAYLOAD_TOO_LARGE',
              message: 'payload too large',
            },
          }),
          { status: 413 },
        ),
      ),
    )

    const { KagiClient, KagiClientError } = await import('./kagi-client')
    const client = new KagiClient('http://localhost:3002')

    try {
      await client.translate({
        text: 'Hello',
        style: 'Clear',
      })
      expect.unreachable('expected typed error payload to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(KagiClientError)
      expect(error).toMatchObject({
        code: 'PAYLOAD_TOO_LARGE',
        message: 'payload too large',
        status: 413,
      })
    }
  })
})
