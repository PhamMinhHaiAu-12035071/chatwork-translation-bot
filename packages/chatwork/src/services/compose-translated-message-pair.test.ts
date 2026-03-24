import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import type { ChatworkWebhookPayload } from '~/types/webhook'
import { mapWebhookToTranslationCommand } from './map-webhook-to-translation-command'
import { composeTranslatedMessagePair } from './compose-translated-message-pair'

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

  it('includes event, sender, room, timestamps, To/Cc names, and quote context in metadata while removing source-only tags from body', async () => {
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

    expect(result.metadataMessage).toContain('updated')
    expect(result.metadataMessage).toContain('Alice')
    expect(result.metadataMessage).toContain('JP Project Demo')
    expect(result.metadataMessage).toContain(formatUtc(sendTime))
    expect(result.metadataMessage).toContain(formatUtc(updateTime))
    expect(result.metadataMessage).toContain('Bob')
    expect(result.metadataMessage).toContain('Carol')
    expect(result.metadataMessage).toContain('Dana')
    expect(result.metadataMessage).toContain(formatUtc(quoteTime))

    expect(result.bodyMessage).toContain('Vui long xem')
    expect(result.bodyMessage).toContain(
      `[qt]── Dana | ${formatUtc(quoteTime)} ──\nNoi dung da trich[/qt]`,
    )
    expect(result.bodyMessage).not.toContain('[To:200]')
    expect(result.bodyMessage).not.toContain('[cc:300]')
    expect(result.bodyMessage).not.toContain('[qtmeta')
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

  it('omits the qt header line entirely when neither sender nor time is recoverable', async () => {
    const command = makeCommand('[qt]quoted content[/qt]')

    const result = await composeTranslatedMessagePair(command, {
      translatedSegments: ['Noi dung da trich'],
      apiToken: 'test-token',
      memberCache: new Map([[100, 'Alice']]),
      roomCache: new Map([[777, 'JP Project Demo']]),
    })

    expect(result.bodyMessage).toBe('[qt]Noi dung da trich[/qt]')
  })

  it('uses fallback account and room names when lookups cannot resolve', async () => {
    const command = makeCommand('Hello')

    const result = await composeTranslatedMessagePair(command, {
      translatedSegments: ['Xin chao'],
      apiToken: 'test-token',
    })

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
})
