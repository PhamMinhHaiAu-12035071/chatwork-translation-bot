import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import { rm } from 'node:fs/promises'
import { writeTranslationOutput } from './output-writer'
import type { OutputRecord } from '../types/output'

const testDir = join(import.meta.dir, '__test_output__')

const sampleRecord: OutputRecord = {
  webhook_setting_id: 'wh_test_123',
  webhook_event_type: 'message_created',
  webhook_event_time: 1709545476,
  webhook_event: {
    message_id: 'msg_001',
    room_id: 424846369,
    account_id: 8315321,
    body: '[To:123] できれば年内に！\n\n実装してみてください。',
    send_time: 1709545476,
    update_time: 0,
  },
  translation: {
    cleanText: 'できれば年内に！\n\n実装してみてください。',
    translatedText: 'Nếu có thể, hãy hoàn thành trong năm nay!\n\nHãy thử triển khai.',
    sourceLang: 'Japanese',
    targetLang: 'Vietnamese',
    timestamp: '2026-03-04T11:44:36.577Z',
  },
}

describe('writeTranslationOutput', () => {
  it('writes JSON file with full ChatworkWebhookEvent + translation structure', async () => {
    await writeTranslationOutput(sampleRecord, testDir)

    const filepath = join(testDir, '2026-03-04', 'msg_001.json')
    const file = Bun.file(filepath)
    const content = (await file.json()) as OutputRecord

    // ChatworkWebhookEvent fields preserved
    expect(content.webhook_setting_id).toBe('wh_test_123')
    expect(content.webhook_event_type).toBe('message_created')
    expect(content.webhook_event.room_id).toBe(424846369)
    expect(content.webhook_event.account_id).toBe(8315321)
    expect(content.webhook_event.body).toBe('[To:123] できれば年内に！\n\n実装してみてください。')

    // Translation block
    expect(content.translation.cleanText).toBe('できれば年内に！\n\n実装してみてください。')
    expect(content.translation.translatedText).toBe(
      'Nếu có thể, hãy hoàn thành trong năm nay!\n\nHãy thử triển khai.',
    )
    expect(content.translation.sourceLang).toBe('Japanese')
    expect(content.translation.targetLang).toBe('Vietnamese')
    expect(content.translation.timestamp).toBe('2026-03-04T11:44:36.577Z')

    await rm(testDir, { recursive: true, force: true })
  })

  it('uses filename from webhook_event.message_id', async () => {
    await writeTranslationOutput(sampleRecord, testDir)

    const filepath = join(testDir, '2026-03-04', 'msg_001.json')
    expect(await Bun.file(filepath).exists()).toBe(true)

    await rm(testDir, { recursive: true, force: true })
  })
})
