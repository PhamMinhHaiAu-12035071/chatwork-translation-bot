import { describe, expect, it } from 'bun:test'
import { buildMessageTranslationSource } from './build-message-translation-source'
import type { ChatworkWebhookPayload } from '~/types/webhook'

describe('buildMessageTranslationSource', () => {
  const makePayload = (body: string): ChatworkWebhookPayload => ({
    webhook_setting_id: '123',
    webhook_event_type: 'message_created',
    webhook_event_time: 1710000000,
    webhook_event: {
      message_id: '789012345',
      room_id: 567890123,
      account_id: 12345,
      body,
      send_time: 1710000000,
      update_time: 0,
    },
  })

  it('extracts translationInputs in order', () => {
    const source = buildMessageTranslationSource(
      makePayload('[info][title]Title[/title]Body[/info]'),
    )
    expect(source.translationInputs).toEqual(['Title', 'Body'])
  })

  it('builds translatableText from joined visible text', () => {
    const source = buildMessageTranslationSource(makePayload('Hello\n\nWorld'))
    expect(source.translatableText).toBe('Hello\n\nWorld')
  })

  it('handles zero-input case for literal-only content', () => {
    const source = buildMessageTranslationSource(makePayload('[code]const x = 1[/code]'))
    expect(source.translationInputs).toHaveLength(0)
    // But still has renderable structure
    expect(source.decorationSnapshot).toBeDefined()
  })

  it('preserves raw payload snapshot under audit.rawSourceSnapshot', () => {
    const payload = makePayload('Hello')
    const source = buildMessageTranslationSource(payload)
    expect(source.decorationSnapshot.webhookPayload).toBe(payload)
  })

  it('embeds structured snapshot under decorationSnapshot', () => {
    const source = buildMessageTranslationSource(makePayload('Hello'))
    expect(source.decorationSnapshot.snapshot).toBeDefined()
    expect(source.decorationSnapshot.snapshot.translationInputs).toBeDefined()
    expect(source.decorationSnapshot.snapshot.renderTemplate).toBeDefined()
  })

  it('handles complex body with multiple tags', () => {
    const body = '[To:99][info][title]Agenda[/title]Please attend[/info]Time: 14:00'
    const source = buildMessageTranslationSource(makePayload(body))
    expect(source.translationInputs).toContain('Agenda')
    expect(source.translationInputs).toContain('Please attend')
    expect(source.translatableText).toContain('Agenda')
    expect(source.translatableText).toContain('Please attend')
  })

  it('empty body produces empty translationInputs', () => {
    const source = buildMessageTranslationSource(makePayload(''))
    expect(source.translationInputs).toHaveLength(0)
    expect(source.translatableText).toBe('')
  })
})
