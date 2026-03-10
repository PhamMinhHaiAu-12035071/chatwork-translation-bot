import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { listPendingDatasetFiles } from './dataset-loader'

const baseDir = join(tmpdir(), 'dataset-loader-test')

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true })
})

describe('listPendingDatasetFiles', () => {
  it('returns pending JSONL files sorted by file name', async () => {
    const pendingDir = join(baseDir, 'pending')
    await mkdir(pendingDir, { recursive: true })
    await Bun.write(join(pendingDir, '010-b.jsonl'), '{"id":"b","message":"b"}\n')
    await Bun.write(join(pendingDir, '001-a.jsonl'), '{"id":"a","message":"a"}\n')

    const result = await listPendingDatasetFiles(baseDir)
    expect(result.map((file) => file.fileName)).toEqual(['001-a.jsonl', '010-b.jsonl'])
  })
})
