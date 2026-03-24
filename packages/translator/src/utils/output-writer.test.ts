import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import { rm } from 'node:fs/promises'
import { writeTranslationOutput } from './output-writer'
import type { OutputRecord } from '~/types/output'

const testDir = join(import.meta.dir, '__test_output__')

const sampleRecord: OutputRecord = {
  command: {
    sourceSystem: 'chatwork',
    sourceEventId: 'msg_001:message_created:1709545476',
    sourceEventType: 'message_created',
    sourceMessageId: 'msg_001',
    sourceRoomId: 424846369,
    senderAccountId: 8315321,
    rawBody: '[To:123] できれば年内に！\n\n実装してみてください。',
    translatableText: 'できれば年内に！\n\n実装してみてください。',
    translationInputs: ['できれば年内に！', '実装してみてください。'],
    sendTime: 1709545476,
    updateTime: 0,
    audit: {
      receivedAt: '2026-03-04T11:44:36.000Z',
      rawSourceSnapshot: {
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
      },
    },
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
  it('writes JSON file with TranslationIngressCommand + translation structure', async () => {
    await writeTranslationOutput(sampleRecord, testDir)

    const filepath = join(testDir, '2026-03-04', 'msg_001.json')
    const file = Bun.file(filepath)
    const content = (await file.json()) as OutputRecord

    // Command fields preserved
    expect(content.command.sourceSystem).toBe('chatwork')
    expect(content.command.sourceMessageId).toBe('msg_001')
    expect(content.command.sourceRoomId).toBe(424846369)
    expect(content.command.senderAccountId).toBe(8315321)
    expect(content.command.rawBody).toBe('[To:123] できれば年内に！\n\n実装してみてください。')
    expect(content.command.translatableText).toBe('できれば年内に！\n\n実装してみてください。')

    // Audit snapshot preserved (for backward-compat access to raw Chatwork fields)
    const snapshot = content.command.audit.rawSourceSnapshot
    expect(snapshot['webhook_setting_id']).toBe('wh_test_123')
    expect(snapshot['webhook_event_type']).toBe('message_created')

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

  it('uses filename from command.sourceMessageId', async () => {
    await writeTranslationOutput(sampleRecord, testDir)

    const filepath = join(testDir, '2026-03-04', 'msg_001.json')
    expect(await Bun.file(filepath).exists()).toBe(true)

    await rm(testDir, { recursive: true, force: true })
  })

  it('rewrites an existing output file with delivery metadata', async () => {
    await writeTranslationOutput(sampleRecord, testDir)

    await writeTranslationOutput(
      {
        ...sampleRecord,
        origin: {
          type: 'automation',
          datasetFile: '001-vfa-thinhntt-2026-03-10.jsonl',
          datasetItemId: 'vfa-001',
          datasetLineNumber: 1,
        },
        delivery: {
          status: 'sent',
          destinationRoomId: 55555,
          destinationMessageId: 'dest-123',
          sentAt: '2026-03-10T12:00:00.000Z',
        },
      },
      testDir,
    )

    const filepath = join(testDir, '2026-03-04', 'msg_001.json')
    const content = (await Bun.file(filepath).json()) as OutputRecord

    expect(content.origin?.type).toBe('automation')
    expect(content.origin?.datasetItemId).toBe('vfa-001')
    expect(content.delivery?.status).toBe('sent')
    expect(content.delivery?.destinationMessageId).toBe('dest-123')

    await rm(testDir, { recursive: true, force: true })
  })
})
