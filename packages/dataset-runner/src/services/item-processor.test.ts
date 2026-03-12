import { describe, expect, it, mock } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

void mock.module('@chatwork-bot/chatwork', () => ({
  sendRoomMessage: mock(() => Promise.resolve({ message_id: 'source-1' })),
}))

describe('processDatasetItem', () => {
  it('returns sent source metadata after Chatwork source send succeeds', async () => {
    const { sendRoomMessage } = await import('@chatwork-bot/chatwork')
    const { processDatasetItem } = await import('./item-processor')

    const loggedLines: string[] = []
    const originalConsoleLog = console.log
    console.log = mock((...args: unknown[]) => {
      loggedLines.push(args.map((arg) => String(arg)).join(' '))
    }) as typeof console.log
    ;(sendRoomMessage as ReturnType<typeof mock>).mockImplementation(() =>
      Promise.resolve({ message_id: 'source-1' }),
    )

    const result = await processDatasetItem(
      {
        filePath: '/tmp/pending/001-vfa-thinhntt-2026-03-10.jsonl',
        fileName: '001-vfa-thinhntt-2026-03-10.jsonl',
        lineNumber: 1,
        item: { id: 'vfa-001', message: 'ありがとう' },
      },
      {
        inputDir: '/tmp/input',
        apiToken: 'test-token',
        defaultOriginalRoomId: 424846369,
      },
    )

    expect(result.status).toBe('sent')
    if (result.status === 'sent') {
      expect(result.sourceMessageId).toBe('source-1')
    }
    expect((sendRoomMessage as ReturnType<typeof mock>).mock.calls.length).toBeGreaterThan(0)
    expect(loggedLines.some((line) => line.includes('"event":"dataset_item_send_started"'))).toBe(
      true,
    )
    expect(loggedLines.some((line) => line.includes('"event":"dataset_item_send_completed"'))).toBe(
      true,
    )

    console.log = originalConsoleLog
  })

  it('writes one source-map entry immediately after source send', async () => {
    const { sendRoomMessage } = await import('@chatwork-bot/chatwork')
    const { processDatasetItem } = await import('./item-processor')

    const inputDir = join(tmpdir(), 'item-processor-test-sourcemap')

    ;(sendRoomMessage as ReturnType<typeof mock>).mockImplementation(() =>
      Promise.resolve({ message_id: 'source-1' }),
    )

    await processDatasetItem(
      {
        filePath: '/tmp/pending/001-vfa-thinhntt-2026-03-10.jsonl',
        fileName: '001-vfa-thinhntt-2026-03-10.jsonl',
        lineNumber: 1,
        item: { id: 'vfa-001', message: 'ありがとう' },
      },
      {
        inputDir,
        apiToken: 'test-token',
        defaultOriginalRoomId: 424846369,
      },
    )

    const sourceMapFile = Bun.file(join(inputDir, 'state', 'source-map', 'source-1.json'))
    expect(await sourceMapFile.exists()).toBe(true)

    const entry = (await sourceMapFile.json()) as { datasetItemId: string }
    expect(entry.datasetItemId).toBe('vfa-001')

    await rm(inputDir, { recursive: true, force: true })
  })

  it('returns failed when Chatwork source send throws', async () => {
    const { sendRoomMessage } = await import('@chatwork-bot/chatwork')
    const { processDatasetItem } = await import('./item-processor')

    const loggedLines: string[] = []
    const originalConsoleError = console.error
    console.error = mock((...args: unknown[]) => {
      loggedLines.push(args.map((arg) => String(arg)).join(' '))
    }) as typeof console.error
    ;(sendRoomMessage as ReturnType<typeof mock>).mockImplementation(() =>
      Promise.reject(new Error('Network error')),
    )

    const result = await processDatasetItem(
      {
        filePath: '/tmp/pending/001-vfa-thinhntt-2026-03-10.jsonl',
        fileName: '001-vfa-thinhntt-2026-03-10.jsonl',
        lineNumber: 1,
        item: { id: 'vfa-001', message: 'ありがとう' },
      },
      {
        inputDir: '/tmp/input',
        apiToken: 'test-token',
        defaultOriginalRoomId: 424846369,
      },
    )

    expect(result.status).toBe('failed')
    if (result.status === 'failed') {
      expect(result.errorCode).toBe('CHATWORK_API')
    }
    expect(loggedLines.some((line) => line.includes('"event":"dataset_item_send_failed"'))).toBe(
      true,
    )

    console.error = originalConsoleError
  })
})
