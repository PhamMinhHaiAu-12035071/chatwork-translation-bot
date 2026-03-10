import { afterEach, describe, expect, it } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readAutomationSourceMapEntry, writeAutomationSourceMapEntry } from './source-map'

const inputDir = join(tmpdir(), 'source-map-test')

afterEach(async () => {
  await rm(inputDir, { recursive: true, force: true })
})

describe('source-map', () => {
  it('round-trips one automation source-map entry', async () => {
    await writeAutomationSourceMapEntry(inputDir, {
      sourceMessageId: 'source-1',
      datasetFile: '001-vfa-thinhntt-2026-03-10.jsonl',
      datasetItemId: 'vfa-001',
      datasetLineNumber: 1,
      sentAt: '2026-03-10T11:36:19.619Z',
    })

    const entry = await readAutomationSourceMapEntry(inputDir, 'source-1')
    expect(entry?.datasetItemId).toBe('vfa-001')
  })
})
