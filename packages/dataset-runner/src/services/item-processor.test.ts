import { describe, expect, it, mock } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { IChatworkClient } from '@chatwork-bot/core'
import { processDatasetItem } from './item-processor'

describe('processDatasetItem', () => {
  it('returns sent source metadata after Chatwork source send succeeds', async () => {
    const client: IChatworkClient = {
      sendMessage: mock(() => Promise.resolve({ message_id: 'source-1' })),
      getMembers: mock(() => Promise.resolve([])),
    }

    const result = await processDatasetItem(
      {
        filePath: '/tmp/pending/001-vfa-thinhntt-2026-03-10.jsonl',
        fileName: '001-vfa-thinhntt-2026-03-10.jsonl',
        lineNumber: 1,
        item: { id: 'vfa-001', message: 'ありがとう' },
      },
      {
        inputDir: '/tmp/input',
        chatworkClient: client,
        defaultOriginalRoomId: 424846369,
      },
    )

    expect(result.status).toBe('sent')
    expect(result.sourceMessageId).toBe('source-1')
    expect((client.sendMessage as ReturnType<typeof mock>).mock.calls.length).toBe(1)
  })

  it('writes one source-map entry immediately after source send', async () => {
    const inputDir = join(tmpdir(), 'item-processor-test-sourcemap')

    const client: IChatworkClient = {
      sendMessage: mock(() => Promise.resolve({ message_id: 'source-1' })),
      getMembers: mock(() => Promise.resolve([])),
    }

    await processDatasetItem(
      {
        filePath: '/tmp/pending/001-vfa-thinhntt-2026-03-10.jsonl',
        fileName: '001-vfa-thinhntt-2026-03-10.jsonl',
        lineNumber: 1,
        item: { id: 'vfa-001', message: 'ありがとう' },
      },
      {
        inputDir,
        chatworkClient: client,
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
    const client: IChatworkClient = {
      sendMessage: mock(() => Promise.reject(new Error('Network error'))),
      getMembers: mock(() => Promise.resolve([])),
    }

    const result = await processDatasetItem(
      {
        filePath: '/tmp/pending/001-vfa-thinhntt-2026-03-10.jsonl',
        fileName: '001-vfa-thinhntt-2026-03-10.jsonl',
        lineNumber: 1,
        item: { id: 'vfa-001', message: 'ありがとう' },
      },
      {
        inputDir: '/tmp/input',
        chatworkClient: client,
        defaultOriginalRoomId: 424846369,
      },
    )

    expect(result.status).toBe('failed')
    if (result.status === 'failed') {
      expect(result.errorCode).toBe('CHATWORK_API')
    }
  })
})
