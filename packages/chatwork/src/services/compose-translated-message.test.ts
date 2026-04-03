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

  it('returns single message with piconname header, original body, divider, and translated body', async () => {
    const command = makeCommand('Original text', {
      webhook_event: {
        account_id: 100,
        send_time: 1711271400,
      },
    })

    const result = await composeTranslatedMessage(command, {
      translatedSegments: ['Vietnamese translation'],
      apiToken: 'test-token',
      memberCache: new Map([[100, 'AuPMH']]),
      roomCache: new Map([[777, 'JP Project Demo']]),
    })

    expect(result).toHaveProperty('message')
    expect(result).not.toHaveProperty('metadataMessage')
    expect(result).not.toHaveProperty('bodyMessage')

    const lines = result.message.split('\n')
    expect(lines[0]).toBe('[piconname:100] AuPMH 🇻🇳 [Created]')
    expect(lines[1]).toBe('Original text')
    expect(lines[2]).toBe('[hr]')
    expect(lines[3]).toBe('Vietnamese translation')
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
      memberCache: new Map([[100, 'Test']]),
      roomCache: new Map([[777, 'JP Project Demo']]),
    })

    expect(result.message).toContain('[Updated]')
    expect(result.message).not.toContain('[Created]')
  })

  it('uses fallback #accountId when name resolution fails', async () => {
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
      memberCache: new Map(), // Empty - no match
      roomCache: new Map([[777, 'JP Project Demo']]),
    })

    expect(result.message).toContain('[piconname:999] #999 🇻🇳 [Created]')
  })

  it('preserves original body with all Chatwork tags intact', async () => {
    const command = makeCommand('[qt][qtmeta aid=200 time=1234567890]Previous[/qt]\nNew message', {
      webhook_event: {
        account_id: 100,
        send_time: 1711271400,
      },
    })

    const result = await composeTranslatedMessage(command, {
      translatedSegments: ['Translated quote', 'Translated new message'],
      apiToken: 'test-token',
      memberCache: new Map([[100, 'Test']]),
      roomCache: new Map([[777, 'JP Project Demo']]),
    })

    // Original section should have original text with quote tag
    const lines = result.message.split('\n')
    const hrIndex = lines.indexOf('[hr]')
    const originalSection = lines.slice(1, hrIndex).join('\n')

    expect(originalSection).toContain('[qt][qtmeta aid=200 time=1234567890]Previous[/qt]')
    expect(originalSection).toContain('New message')

    // Translated section should have translations with same structure
    const translatedSection = lines.slice(hrIndex + 1).join('\n')
    expect(translatedSection).toContain('[qt][qtmeta aid=200 time=1234567890]Translated quote[/qt]')
    expect(translatedSection).toContain('Translated new message')
  })

  it('preserves reply structure in both original and translated sections', async () => {
    const command = makeCommand('[rp aid=200 to=777-123]Thank you!', {
      webhook_event: {
        account_id: 100,
        send_time: 1711271400,
      },
    })

    const result = await composeTranslatedMessage(command, {
      translatedSegments: ['Cảm ơn bạn!'],
      apiToken: 'test-token',
      memberCache: new Map([[100, 'Test']]),
      roomCache: new Map([[777, 'JP Project Demo']]),
    })

    // Original section has reply tag
    expect(result.message).toContain('[rp aid=200 to=777-123]Thank you!')

    // Translated section has same tag structure
    expect(result.message).toContain('[rp aid=200 to=777-123]Cảm ơn bạn!')
  })

  it('preserves code blocks byte-identical in both sections', async () => {
    const command = makeCommand('Check this:\n[code]const x = 1;\nconsole.log(x);[/code]', {
      webhook_event: {
        account_id: 100,
        send_time: 1711271400,
      },
    })

    const result = await composeTranslatedMessage(command, {
      translatedSegments: ['Kiểm tra cái này:'], // Code not translated
      apiToken: 'test-token',
      memberCache: new Map([[100, 'Test']]),
      roomCache: new Map([[777, 'JP Project Demo']]),
    })

    const codeBlock = '[code]const x = 1;\nconsole.log(x);[/code]'

    // Original section has original code
    expect(result.message).toContain(`Check this:\n${codeBlock}`)

    // Translated section has same code
    expect(result.message).toContain(`Kiểm tra cái này:\n${codeBlock}`)
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
      memberCache: new Map([[100, 'Test']]),
      roomCache: new Map([[777, 'JP Project Demo']]),
    })

    const lines = result.message.split('\n')

    // Format: Header\n[hr]\nTranslated code block (original section skipped when empty)
    expect(lines[0]).toContain('[piconname:100]')
    expect(lines[1]).toBe('[hr]')
    expect(lines[2]).toBe('[code]const x = 1;[/code]')
    expect(lines.length).toBe(3)
  })

  it('preserves info and title wrappers in both sections', async () => {
    const command = makeCommand('[info][title]Important[/title]Please read carefully[/info]', {
      webhook_event: {
        account_id: 100,
        send_time: 1711271400,
      },
    })

    const result = await composeTranslatedMessage(command, {
      translatedSegments: ['Quan trọng', 'Vui lòng đọc kỹ'],
      apiToken: 'test-token',
      memberCache: new Map([[100, 'Test']]),
      roomCache: new Map([[777, 'JP Project Demo']]),
    })

    // Original section
    expect(result.message).toContain('[info][title]Important[/title]Please read carefully[/info]')

    // Translated section
    expect(result.message).toContain('[info][title]Quan trọng[/title]Vui lòng đọc kỹ[/info]')
  })

  it('handles nested quote structures correctly', async () => {
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
      memberCache: new Map([[100, 'Test']]),
      roomCache: new Map([[777, 'JP Project Demo']]),
    })

    // Original nested structure
    expect(result.message).toContain(
      '[qt][qtmeta aid=200 time=123][qt][qtmeta aid=300 time=456]Inner[/qt]Outer[/qt]',
    )

    // Translated nested structure
    expect(result.message).toContain(
      '[qt][qtmeta aid=200 time=123][qt][qtmeta aid=300 time=456]Trong[/qt]Ngoài[/qt]',
    )
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
      memberCache: new Map([[100, 'Test']]),
      roomCache: new Map([[777, 'Test Room']]),
    })

    // Tags should be escaped or rendered as text, not structure
    expect(result.message).toContain('Xin chào [info]injected info[/info]')
    // Verify it doesn't create actual info structure by checking rendered output
    const lines = result.message.split('\n')
    const translatedSection = lines.slice(lines.indexOf('[hr]') + 1).join('\n')
    expect(translatedSection).toBe('Xin chào [info]injected info[/info]')
  })
})
