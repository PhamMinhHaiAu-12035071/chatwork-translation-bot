import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import type { ChatworkMember } from '~/types/chatwork'
import { ChatworkClient } from './client'

describe('ChatworkClient', () => {
  let client: ChatworkClient
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    client = new ChatworkClient({ apiToken: 'test-token' })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('sendMessage', () => {
    it('sends POST to correct endpoint with form-encoded body', async () => {
      let capturedUrl = ''
      let capturedInit: RequestInit | undefined

      globalThis.fetch = mock((input: string | URL | Request, init?: RequestInit) => {
        if (typeof input === 'string') {
          capturedUrl = input
        } else if (input instanceof URL) {
          capturedUrl = input.href
        } else {
          capturedUrl = input.url
        }
        capturedInit = init
        return Promise.resolve(new Response(JSON.stringify({ message_id: '123' }), { status: 200 }))
      }) as unknown as typeof fetch

      await client.sendMessage({ roomId: 42, message: 'hello' })

      expect(capturedUrl).toBe('https://api.chatwork.com/v2/rooms/42/messages')
      expect(capturedInit?.method).toBe('POST')
      if (capturedInit?.headers) {
        expect(capturedInit.headers).toMatchObject({ 'X-ChatWorkToken': 'test-token' })
      }

      let bodyStr = ''
      if (capturedInit?.body instanceof URLSearchParams) {
        bodyStr = capturedInit.body.toString()
      } else if (typeof capturedInit?.body === 'string') {
        bodyStr = capturedInit.body
      }
      expect(bodyStr).toContain('body=hello')
      expect(bodyStr).toContain('self_unread=0')
    })

    it('throws on non-2xx response', async () => {
      globalThis.fetch = mock(() => {
        return Promise.resolve(new Response('Forbidden', { status: 403, statusText: 'Forbidden' }))
      }) as unknown as typeof fetch

      try {
        await client.sendMessage({ roomId: 42, message: 'hello' })
        expect(false).toBe(true)
      } catch (error) {
        expect(error).toBeDefined()
        expect(String(error)).toContain('Chatwork API error')
      }
    })

    it('sends self_unread=1 when unread is true', async () => {
      let capturedInit: RequestInit | undefined

      globalThis.fetch = mock((_input: string | URL | Request, init?: RequestInit) => {
        capturedInit = init
        return Promise.resolve(new Response(JSON.stringify({ message_id: '123' }), { status: 200 }))
      }) as unknown as typeof fetch

      await client.sendMessage({ roomId: 42, message: 'hello', unread: true })

      let bodyStr = ''
      if (capturedInit?.body instanceof URLSearchParams) {
        bodyStr = capturedInit.body.toString()
      } else if (typeof capturedInit?.body === 'string') {
        bodyStr = capturedInit.body
      }
      expect(bodyStr).toContain('self_unread=1')
    })
  })

  describe('constructor', () => {
    it('uses default base URL', () => {
      const c = new ChatworkClient({ apiToken: 'tok' })
      expect(c).toBeDefined()
    })

    it('accepts custom base URL', () => {
      const c = new ChatworkClient({ apiToken: 'tok', baseUrl: 'https://custom.api' })
      expect(c).toBeDefined()
    })
  })

  describe('getMembers', () => {
    it('sends GET to correct endpoint and returns parsed members', async () => {
      const fakeMembers = [
        {
          account_id: 123,
          role: 'member',
          name: 'Nguyen Van A',
          chatwork_id: 'nguyenvana',
          organization_id: 1,
          organization_name: 'Acme',
          department: 'Engineering',
          avatar_image_url: 'https://example.com/avatar.png',
        },
      ]

      let capturedUrl = ''

      globalThis.fetch = mock((input: string | URL | Request) => {
        capturedUrl =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        return Promise.resolve(new Response(JSON.stringify(fakeMembers), { status: 200 }))
      }) as unknown as typeof fetch

      const result = await client.getMembers(42)

      expect(capturedUrl).toBe('https://api.chatwork.com/v2/rooms/42/members')
      expect(result).toHaveLength(1)
      const member: ChatworkMember | undefined = result[0]
      expect(member?.account_id).toBe(123)
      expect(member?.name).toBe('Nguyen Van A')
    })

    it('throws on non-2xx response', async () => {
      globalThis.fetch = mock(() => {
        return Promise.resolve(
          new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' }),
        )
      }) as unknown as typeof fetch

      try {
        await client.getMembers(42)
        expect(false).toBe(true)
      } catch (error) {
        expect(String(error)).toContain('Chatwork API error')
      }
    })
  })
})
