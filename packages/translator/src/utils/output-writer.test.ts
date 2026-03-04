import { afterEach, describe, expect, it } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { writeTranslationOutput } from './output-writer'
import type { OutputRecord } from './output-writer'

const TEST_OUTPUT_DIR = join(process.cwd(), 'output-test')

const sampleRecord: OutputRecord = {
  originalText: 'Hello World',
  translatedText: 'Xin chào Thế giới',
  sourceLang: 'en',
  targetLang: 'vi',
  timestamp: '2026-03-04T10:30:00.000Z',
  roomId: 123456789,
  accountId: 987654321,
  messageId: 'msg001',
}

afterEach(async () => {
  await rm(TEST_OUTPUT_DIR, { recursive: true, force: true })
})

describe('writeTranslationOutput', () => {
  it('creates the output file at the correct path', async () => {
    await writeTranslationOutput(sampleRecord, TEST_OUTPUT_DIR)

    const file = Bun.file(join(TEST_OUTPUT_DIR, '2026-03-04', '123456789-msg001.json'))
    expect(await file.exists()).toBe(true)
  })

  it('writes correct JSON content', async () => {
    await writeTranslationOutput(sampleRecord, TEST_OUTPUT_DIR)

    const file = Bun.file(join(TEST_OUTPUT_DIR, '2026-03-04', '123456789-msg001.json'))
    const content = (await file.json()) as OutputRecord
    expect(content.originalText).toBe('Hello World')
    expect(content.translatedText).toBe('Xin chào Thế giới')
    expect(content.sourceLang).toBe('en')
    expect(content.targetLang).toBe('vi')
    expect(content.roomId).toBe(123456789)
    expect(content.messageId).toBe('msg001')
  })

  it('creates parent directories automatically', async () => {
    const record = { ...sampleRecord, timestamp: '2026-12-31T23:59:59.000Z', messageId: 'msg999' }
    await writeTranslationOutput(record, TEST_OUTPUT_DIR)

    const file = Bun.file(join(TEST_OUTPUT_DIR, '2026-12-31', '123456789-msg999.json'))
    expect(await file.exists()).toBe(true)
  })
})
