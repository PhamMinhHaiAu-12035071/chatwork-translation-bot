import { afterEach, describe, expect, it } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  acquireRunnerLock,
  startRunnerLockHeartbeat,
  heartbeatRunnerLock,
  readDatasetState,
  releaseRunnerLock,
  writeDatasetState,
} from './state-store'

const baseDir = join(tmpdir(), 'state-store-test')

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true })
})

describe('state-store', () => {
  it('round-trips dataset state', async () => {
    await writeDatasetState(baseDir, '001-vfa-thinhntt-2026-03-10.jsonl', {
      fileName: '001-vfa-thinhntt-2026-03-10.jsonl',
      nextLineNumber: 2,
      completedItemIds: ['vfa-001'],
      failedItemIds: [],
      updatedAt: '2026-03-10T11:36:19.619Z',
    })

    const result = await readDatasetState(baseDir, '001-vfa-thinhntt-2026-03-10.jsonl')
    expect(result?.nextLineNumber).toBe(2)
  })

  it('acquires, heartbeats, and releases the runner lock', async () => {
    const lease = await acquireRunnerLock(baseDir, 60_000)
    await heartbeatRunnerLock(lease)
    await releaseRunnerLock(lease)
    expect(true).toBe(true)
  })

  it('refreshes the runner lock heartbeat on an interval', async () => {
    const lease = await acquireRunnerLock(baseDir, 60_000)
    const before = (await Bun.file(lease.lockPath).json()) as { heartbeatAt: string }

    const heartbeat = startRunnerLockHeartbeat(lease, 10)
    await Bun.sleep(35)
    await heartbeat.stop()

    const after = (await Bun.file(lease.lockPath).json()) as { heartbeatAt: string }
    expect(after.heartbeatAt > before.heartbeatAt).toBe(true)

    await releaseRunnerLock(lease)
  })
})
