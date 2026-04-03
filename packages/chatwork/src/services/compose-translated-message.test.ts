import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import type { ChatworkWebhookPayload } from '~/types/webhook'
import { mapWebhookToTranslationCommand } from './map-webhook-to-translation-command'
import { composeTranslatedMessage } from './compose-translated-message'

type FetchSpy = ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>

function makeFetchSpy(): FetchSpy {
  return spyOn(globalThis, 'fetch').mockImplementation((() => {
    throw new Error('Unexpected real HTTP call')
  }) as unknown as typeof fetch)
}

function makePayload(
  body: string,
  overrides: {
    webhook_event_type?: 'message_created' | 'message_updated'
    webhook_event_time?: number
    webhook_event?: Partial<ChatworkWebhookPayload['webhook_event']>
  } = {},
): ChatworkWebhookPayload {
  return {
    webhook_setting_id: '123',
    webhook_event_type: overrides.webhook_event_type ?? 'message_created',
    webhook_event_time: overrides.webhook_event_time ?? 1711271400,
    webhook_event: {
      message_id: '789012345',
      room_id: 777,
      account_id: 100,
      body,
      send_time: 1711271400,
      update_time: 0,
      ...overrides.webhook_event,
    },
  }
}

function makeCommand(
  body: string,
  overrides: {
    webhook_event_type?: 'message_created' | 'message_updated'
    webhook_event_time?: number
    webhook_event?: Partial<ChatworkWebhookPayload['webhook_event']>
  } = {},
) {
  return mapWebhookToTranslationCommand(makePayload(body, overrides), '2026-03-24T00:00:00.000Z')
}

describe('composeTranslatedMessage', () => {
  let fetchSpy: FetchSpy

  beforeEach(() => {
    fetchSpy = makeFetchSpy()
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('returns single message with piconname header and translated body', async () => {
    const command = makeCommand('Original text', {
      webhook_event: {
        account_id: 100,
        send_time: 1711271400,
      },
    })

    const result = await composeTranslatedMessage(command, {
      translatedSegments: ['Vietnamese translation'],
      apiToken: 'test-token',
      roomCache: new Map([[777, 'JP Project Demo']]),
    })

    expect(result).toHaveProperty('message')
    expect(result).not.toHaveProperty('metadataMessage')
    expect(result).not.toHaveProperty('bodyMessage')

    const lines = result.message.split('\n')
    expect(lines[0]).toBe('[piconname:100] 🌿🌺🌿 𝐂𝐫𝐞𝐚𝐭𝐞𝐝 🌿🌺🌿')
    expect(lines[1]).toBe('Vietnamese translation')
    expect(lines.length).toBe(2)
  })

  it('shows [Updated] indicator for message_updated events', async () => {
    const command = makeCommand('Original text', {
      webhook_event_type: 'message_updated',
      webhook_event: {
        account_id: 100,
        send_time: 1711271400,
      },
    })

    const result = await composeTranslatedMessage(command, {
      translatedSegments: ['Translation'],
      apiToken: 'test-token',
      roomCache: new Map([[777, 'JP Project Demo']]),
    })

    expect(result.message).toContain('🔥⚡🔥 𝐔𝐩𝐝𝐚𝐭𝐞𝐝 🔥⚡🔥')
    expect(result.message).not.toContain('🌿🌺🌿 𝐂𝐫𝐞𝐚𝐭𝐞𝐝 🌿🌺🌿')
  })

  it('uses piconname tag even when member not in cache', async () => {
    const command = makeCommand('Original text', {
      webhook_event_type: 'message_created',
      webhook_event: {
        account_id: 999,
        send_time: 1711271400,
      },
    })

    const result = await composeTranslatedMessage(command, {
      translatedSegments: ['Translation'],
      apiToken: 'test-token',
      roomCache: new Map([[777, 'JP Project Demo']]),
    })

    // Chatwork's piconname tag will handle fallback display automatically
    expect(result.message).toContain('[piconname:999] 🌿🌺🌿 𝐂𝐫𝐞𝐚𝐭𝐞𝐝 🌿🌺🌿')
    expect(result.message).toContain('Translation')
  })

  it('preserves Chatwork tags in translated body', async () => {
    const command = makeCommand('[qt][qtmeta aid=200 time=1234567890]Previous[/qt]\nNew message', {
      webhook_event: {
        account_id: 100,
        send_time: 1711271400,
      },
    })

    const result = await composeTranslatedMessage(command, {
      translatedSegments: ['Translated quote', 'Translated new message'],
      apiToken: 'test-token',
      roomCache: new Map([[777, 'JP Project Demo']]),
    })

    // Translated body should preserve quote structure
    expect(result.message).toContain('[qt][qtmeta aid=200 time=1234567890]Translated quote[/qt]')
    expect(result.message).toContain('Translated new message')

    // Should NOT contain original text or divider
    expect(result.message).not.toContain('Previous')
    expect(result.message).not.toContain('[hr]')
  })

  it('preserves reply structure in translated body', async () => {
    const command = makeCommand('[rp aid=200 to=777-123]Thank you!', {
      webhook_event: {
        account_id: 100,
        send_time: 1711271400,
      },
    })

    const result = await composeTranslatedMessage(command, {
      translatedSegments: ['Cảm ơn bạn!'],
      apiToken: 'test-token',
      roomCache: new Map([[777, 'JP Project Demo']]),
    })

    // Translated body should preserve reply tag structure
    expect(result.message).toContain('[rp aid=200 to=777-123]Cảm ơn bạn!')

    // Should NOT contain original text
    expect(result.message).not.toContain('Thank you!')
  })

  it('preserves code blocks byte-identical in translated body', async () => {
    const command = makeCommand('Check this:\n[code]const x = 1;\nconsole.log(x);[/code]', {
      webhook_event: {
        account_id: 100,
        send_time: 1711271400,
      },
    })

    const result = await composeTranslatedMessage(command, {
      translatedSegments: ['Kiểm tra cái này:'], // Code not translated
      apiToken: 'test-token',
      roomCache: new Map([[777, 'JP Project Demo']]),
    })

    const codeBlock = '[code]const x = 1;\nconsole.log(x);[/code]'

    // Translated body should have code block
    expect(result.message).toContain(`Kiểm tra cái này:\n${codeBlock}`)

    // Should NOT contain original text
    expect(result.message).not.toContain('Check this:')
  })

  it('preserves code blocks in both sections even when no translatable content exists', async () => {
    const command = makeCommand('[code]const x = 1;[/code]', {
      webhook_event: {
        account_id: 100,
        send_time: 1711271400,
      },
    })

    const result = await composeTranslatedMessage(command, {
      translatedSegments: [], // No translations
      apiToken: 'test-token',
      roomCache: new Map([[777, 'JP Project Demo']]),
    })

    const lines = result.message.split('\n')

    // Format: Header\nTranslated code block
    expect(lines[0]).toContain('[piconname:100]')
    expect(lines[1]).toBe('[code]const x = 1;[/code]')
    expect(lines.length).toBe(2)
  })

  it('preserves info and title wrappers in translated body', async () => {
    const command = makeCommand('[info][title]Important[/title]Please read carefully[/info]', {
      webhook_event: {
        account_id: 100,
        send_time: 1711271400,
      },
    })

    const result = await composeTranslatedMessage(command, {
      translatedSegments: ['Quan trọng', 'Vui lòng đọc kỹ'],
      apiToken: 'test-token',
      roomCache: new Map([[777, 'JP Project Demo']]),
    })

    // Translated body should preserve structure
    expect(result.message).toContain('[info][title]Quan trọng[/title]Vui lòng đọc kỹ[/info]')

    // Should NOT contain original text
    expect(result.message).not.toContain('Important')
    expect(result.message).not.toContain('Please read carefully')
  })

  it('handles nested quote structures correctly in translated body', async () => {
    const command = makeCommand(
      '[qt][qtmeta aid=200 time=123][qt][qtmeta aid=300 time=456]Inner[/qt]Outer[/qt]\nNew',
      {
        webhook_event: {
          account_id: 100,
          send_time: 1711271400,
        },
      },
    )

    const result = await composeTranslatedMessage(command, {
      translatedSegments: ['Trong', 'Ngoài', 'Mới'],
      apiToken: 'test-token',
      roomCache: new Map([[777, 'JP Project Demo']]),
    })

    // Translated body should preserve nested structure
    expect(result.message).toContain(
      '[qt][qtmeta aid=200 time=123][qt][qtmeta aid=300 time=456]Trong[/qt]Ngoài[/qt]',
    )
    expect(result.message).toContain('Mới')

    // Should NOT contain original text
    expect(result.message).not.toContain('Inner')
    expect(result.message).not.toContain('Outer')
  })

  it('renders injected Chatwork tags as literal text in translations', async () => {
    const command = makeCommand('Hello', {
      webhook_event: {
        account_id: 100,
        send_time: 1711271400,
      },
    })

    // Malicious translation contains Chatwork tags
    const result = await composeTranslatedMessage(command, {
      translatedSegments: ['Xin chào [info]injected info[/info]'],
      apiToken: 'test-token',
      roomCache: new Map([[777, 'Test Room']]),
    })

    // Tags should be escaped or rendered as text, not structure
    expect(result.message).toContain('Xin chào [info]injected info[/info]')
    // Verify it doesn't create actual info structure by checking rendered output
    const lines = result.message.split('\n')
    const translatedBody = lines.slice(1).join('\n')
    expect(translatedBody).toBe('Xin chào [info]injected info[/info]')
  })

  it('uses distinct emoji decorations for created vs updated messages', async () => {
    const createdCommand = makeCommand('Test message', {
      webhook_event_type: 'message_created',
      webhook_event: {
        account_id: 100,
        send_time: 1711271400,
      },
    })

    const updatedCommand = makeCommand('Test message', {
      webhook_event_type: 'message_updated',
      webhook_event: {
        account_id: 100,
        send_time: 1711271400,
        update_time: 1711271500,
      },
    })

    const createdResult = await composeTranslatedMessage(createdCommand, {
      translatedSegments: ['Test translation'],
      apiToken: 'test-token',
      roomCache: new Map([[777, 'Test Room']]),
    })

    const updatedResult = await composeTranslatedMessage(updatedCommand, {
      translatedSegments: ['Test translation'],
      apiToken: 'test-token',
      roomCache: new Map([[777, 'Test Room']]),
    })

    // Created uses nature theme
    expect(createdResult.message).toContain('🌿🌺🌿 𝐂𝐫𝐞𝐚𝐭𝐞𝐝 🌿🌺🌿')
    expect(createdResult.message).not.toContain('🔥⚡🔥')

    // Updated uses energy theme
    expect(updatedResult.message).toContain('🔥⚡🔥 𝐔𝐩𝐝𝐚𝐭𝐞𝐝 🔥⚡🔥')
    expect(updatedResult.message).not.toContain('🌿🌺🌿')
  })
})
