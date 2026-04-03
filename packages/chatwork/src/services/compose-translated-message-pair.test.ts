import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import type { ChatworkWebhookPayload } from '~/types/webhook'
import { mapWebhookToTranslationCommand } from './map-webhook-to-translation-command'
import { composeTranslatedMessagePair } from './compose-translated-message'
import { composeTranslatedMessage } from './compose-translated-message'

type FetchSpy = ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>

function makeFetchSpy(): FetchSpy {
  return spyOn(globalThis, 'fetch').mockImplementation((() => {
    throw new Error('Unexpected real HTTP call')
  }) as unknown as typeof fetch)
}

function formatUtc(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString().slice(0, 16).replace('T', ' ')
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

describe('composeTranslatedMessagePair', () => {
  let fetchSpy: FetchSpy

  beforeEach(() => {
    fetchSpy = makeFetchSpy()
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('includes event, sender, room, timestamps in metadata while removing source-only tags from body', async () => {
    const sendTime = 1711271400
    const updateTime = 1711275000
    const quoteTime = 1711267800
    const command = makeCommand(
      `[To:200][cc:300]Please review\n[qt][qtmeta account_id="400" time="${quoteTime.toString()}"][/qtmeta]quoted body[/qt]`,
      {
        webhook_event_type: 'message_updated',
        webhook_event_time: updateTime,
        webhook_event: {
          send_time: sendTime,
          update_time: updateTime,
        },
      },
    )

    const result = await composeTranslatedMessagePair(command, {
      translatedSegments: ['Vui long xem', 'Noi dung da trich'],
      apiToken: 'test-token',
      memberCache: new Map([
        [100, 'Alice'],
        [200, 'Bob'],
        [300, 'Carol'],
        [400, 'Dana'],
      ]),
      roomCache: new Map([[777, 'JP Project Demo']]),
    })

    expect(result.metadataMessage).toContain('[piconname:100]')
    expect(result.metadataMessage).not.toContain('[info]')
    expect(result.metadataMessage).not.toContain('[title]')
    expect(result.metadataMessage).toContain('updated')
    expect(result.metadataMessage).toContain('Alice')
    expect(result.metadataMessage).toContain('JP Project Demo')
    expect(result.metadataMessage).toContain(formatUtc(sendTime))
    expect(result.metadataMessage).toContain(formatUtc(updateTime))
    // To/Cc/Quote summaries no longer in metadata - body preserves full structure

    expect(result.bodyMessage).toContain('Vui long xem')
    expect(result.bodyMessage).toContain(
      `[qt][qtmeta aid=400 time=${quoteTime.toString()}]Noi dung da trich[/qt]`,
    )
    expect(result.bodyMessage).not.toContain('[To:200]')
    expect(result.bodyMessage).not.toContain('[cc:300]')
  })

  it('uses piconname tag to display sender avatar and name in metadata', async () => {
    const command = makeCommand('Hello world', {
      webhook_event: {
        account_id: 100,
        send_time: 1711271400,
      },
    })

    const result = await composeTranslatedMessagePair(command, {
      translatedSegments: ['Xin chao the gioi'],
      apiToken: 'test-token',
      memberCache: new Map([[100, 'Alice']]),
      roomCache: new Map([[777, 'JP Project Demo']]),
    })

    expect(result.metadataMessage).toContain('[piconname:100]')
    expect(result.metadataMessage).not.toContain('[info]')
    expect(result.metadataMessage).not.toContain('[title]')
    expect(result.metadataMessage).toContain('Event: created')
    expect(result.metadataMessage).toContain('Sender: Alice')
    expect(result.metadataMessage).toContain('Room: JP Project Demo')
    expect(result.metadataMessage).toContain(`Sent: ${formatUtc(1711271400)}`)
  })

  it('preserves portable wrappers and keeps code content byte-for-byte identical', async () => {
    const command = makeCommand(
      '[info][title]Agenda[/title]Please review[/info][hr][code]const x = 1[/code]',
    )

    const result = await composeTranslatedMessagePair(command, {
      translatedSegments: ['Lich hop', 'Vui long xem'],
      apiToken: 'test-token',
      memberCache: new Map([[100, 'Alice']]),
      roomCache: new Map([[777, 'JP Project Demo']]),
    })

    expect(result.bodyMessage).toBe(
      '[info][title]Lich hop[/title]Vui long xem[/info][hr][code]const x = 1[/code]',
    )
  })

  it('keeps [quote] wrapper body without inventing a synthetic header', async () => {
    const command = makeCommand('[quote]quoted content[/quote]')

    const result = await composeTranslatedMessagePair(command, {
      translatedSegments: ['Noi dung da trich'],
      apiToken: 'test-token',
      memberCache: new Map([[100, 'Alice']]),
      roomCache: new Map([[777, 'JP Project Demo']]),
    })

    expect(result.bodyMessage).toBe('[quote]Noi dung da trich[/quote]')
  })

  it('downgrades qt without recoverable metadata to a [quote] wrapper', async () => {
    const command = makeCommand('[qt]quoted content[/qt]')

    const result = await composeTranslatedMessagePair(command, {
      translatedSegments: ['Noi dung da trich'],
      apiToken: 'test-token',
      memberCache: new Map([[100, 'Alice']]),
      roomCache: new Map([[777, 'JP Project Demo']]),
    })

    expect(result.bodyMessage).toBe('[quote]Noi dung da trich[/quote]')
  })

  it('renders nested qt recursively', async () => {
    const outerTime = 1711267800
    const innerTime = 1711267000
    const command = makeCommand(
      `[qt][qtmeta aid=400 time=${outerTime.toString()}][qt][qtmeta aid=500 time=${innerTime.toString()}]quoted body[/qt][/qt]`,
    )

    const result = await composeTranslatedMessagePair(command, {
      translatedSegments: ['Noi dung da trich'],
      apiToken: 'test-token',
      memberCache: new Map([
        [100, 'Alice'],
        [400, 'Dana'],
        [500, 'Erin'],
      ]),
      roomCache: new Map([[777, 'JP Project Demo']]),
    })

    // Quote summaries removed - body preserves full nested structure
    expect(result.metadataMessage).toContain('Event: created')
    expect(result.bodyMessage).toBe(
      `[qt][qtmeta aid=400 time=${outerTime.toString()}][qt][qtmeta aid=500 time=${innerTime.toString()}]Noi dung da trich[/qt][/qt]`,
    )
  })

  it('downgrades only the malformed nested qt node while preserving the valid outer quote', async () => {
    const outerTime = 1711267800
    const command = makeCommand(
      `[qt][qtmeta aid=400 time=${outerTime.toString()}][qt]quoted body[/qt][/qt]`,
    )

    const result = await composeTranslatedMessagePair(command, {
      translatedSegments: ['Noi dung da trich'],
      apiToken: 'test-token',
      memberCache: new Map([
        [100, 'Alice'],
        [400, 'Dana'],
      ]),
      roomCache: new Map([[777, 'JP Project Demo']]),
    })

    // Quote summaries removed - body preserves structure
    expect(result.metadataMessage).toContain('Event: created')
    expect(result.bodyMessage).toBe(
      `[qt][qtmeta aid=400 time=${outerTime.toString()}][quote]Noi dung da trich[/quote][/qt]`,
    )
  })

  it('includes node-local nested quote context in metadata, strips To/Cc from body, and preserves [rp] tag', async () => {
    const outerTime = 1711267800
    const innerTime = 1711267000
    const command = makeCommand(
      `[qt][qtmeta aid=400 time=${outerTime.toString()}][qt][qtmeta aid=500 time=${innerTime.toString()}][To:600][cc:700][rp aid=800 to=999-123]quoted body[/qt][/qt]`,
    )

    const result = await composeTranslatedMessagePair(command, {
      translatedSegments: ['Noi dung da trich'],
      apiToken: 'test-token',
      memberCache: new Map([
        [100, 'Alice'],
        [400, 'Dana'],
        [500, 'Erin'],
        [600, 'Gina'],
        [700, 'Hank'],
        [800, 'Ivy'],
      ]),
      roomCache: new Map([
        [777, 'JP Project Demo'],
        [999, 'Nested Room'],
      ]),
    })

    // Metadata no longer includes Quote/To/Cc/Reply summaries (body preserves full structure)
    expect(result.metadataMessage).toContain('[piconname:100]')
    expect(result.metadataMessage).not.toContain('[info]')
    expect(result.metadataMessage).toContain('Event: created')
    expect(result.metadataMessage).toContain('Sender: Alice')
    expect(result.metadataMessage).toContain('Room: JP Project Demo')
    expect(result.bodyMessage).toBe(
      `[qt][qtmeta aid=400 time=${outerTime.toString()}][qt][qtmeta aid=500 time=${innerTime.toString()}][rp aid=800 to=999-123]Noi dung da trich[/qt][/qt]`,
    )
    expect(result.bodyMessage).not.toContain('[To:600]')
    expect(result.bodyMessage).not.toContain('[cc:700]')
    // [rp] tag is now preserved (needed for Chatwork UI to render "Re: Đã trả lời cho")
    expect(result.bodyMessage).toContain('[rp aid=800 to=999-123]')
  })

  it('uses fallback account and room names when lookups cannot resolve', async () => {
    const command = makeCommand('Hello')

    const result = await composeTranslatedMessagePair(command, {
      translatedSegments: ['Xin chao'],
      apiToken: 'test-token',
    })

    expect(result.metadataMessage).toContain('[piconname:100]')
    expect(result.metadataMessage).toContain('#100')
    expect(result.metadataMessage).toContain('Room #777')
    expect(result.bodyMessage).toBe('Xin chao')
  })

  it('renders zero-input code-only body directly from preserved literal structure', async () => {
    const command = makeCommand('[code]const x = 1[/code]')

    const result = await composeTranslatedMessagePair(command, {
      translatedSegments: [],
      apiToken: 'test-token',
      memberCache: new Map([[100, 'Alice']]),
      roomCache: new Map([[777, 'JP Project Demo']]),
    })

    expect(result.bodyMessage).toBe('[code]const x = 1[/code]')
  })

  it('fails closed when translated content injects unexpected Chatwork structure', async () => {
    const command = makeCommand('Hello world')

    await composeTranslatedMessagePair(command, {
      translatedSegments: ['[info]Injected[/info]'],
      apiToken: 'test-token',
      memberCache: new Map([[100, 'Alice']]),
      roomCache: new Map([[777, 'JP Project Demo']]),
    }).then(
      () => {
        throw new Error('Expected structure validation to fail')
      },
      (error: unknown) => {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe(
          'Composed translated body changed the original message structure',
        )
      },
    )
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

    // Format: Header\nOriginal code block\n[hr]\nTranslated code block (identical)
    expect(lines[0]).toContain('[piconname:100]')
    expect(lines[1]).toBe('[code]const x = 1;[/code]')
    expect(lines[2]).toBe('[hr]')
    expect(lines[3]).toBe('[code]const x = 1;[/code]')
    expect(lines.length).toBe(4)
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
})
