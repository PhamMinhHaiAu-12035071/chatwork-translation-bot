import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { ChatworkApiError } from '~/errors/chatwork-api-error'
import { getMe } from './get-me'

type FetchSpy = ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>

function makeFetchSpy(): FetchSpy {
  return spyOn(globalThis, 'fetch').mockImplementation((() => {
    throw new Error('Unexpected real HTTP call')
  }) as unknown as typeof fetch)
}

function mockOnce(spy: FetchSpy, response: Response): void {
  spy.mockImplementationOnce((() => Promise.resolve(response)) as unknown as typeof fetch)
}

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
    return undefined
  } catch (error) {
    return error
  }
}

const TOKEN = 'test-token'
const ME_RESPONSE = {
  account_id: 42,
  room_id: 1,
  name: 'Bot User',
  chatwork_id: 'bot',
  organization_id: 1,
  organization_name: 'Org',
  department: '',
  title: '',
  url: '',
  introduction: '',
  mail: 'bot@example.com',
  tel_organization: '',
  tel_extension: '',
  tel_mobile: '',
  skype: '',
  facebook: '',
  twitter: '',
  avatar_image_url: 'https://example.com/avatar.jpg',
  login_mail: 'bot@example.com',
}

describe('getMe', () => {
  let fetchSpy: FetchSpy

  beforeEach(() => {
    process.env.NODE_ENV = 'test'
    fetchSpy = makeFetchSpy()
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('calls GET /me with correct headers', async () => {
    mockOnce(
      fetchSpy,
      new Response(JSON.stringify(ME_RESPONSE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const result = await getMe(TOKEN)

    expect(result.account_id).toBe(42)
    expect(result.name).toBe('Bot User')
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.chatwork.com/v2/me')
    expect(init.method).toBe('GET')
    expect((init.headers as Record<string, string>)['X-ChatWorkToken']).toBe(TOKEN)
  })

  it('throws ChatworkApiError on non-OK response', async () => {
    mockOnce(
      fetchSpy,
      new Response(JSON.stringify({ errors: ['Unauthorized'] }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const error = await catchError(getMe(TOKEN))
    expect(error).toBeInstanceOf(ChatworkApiError)
  })
})
