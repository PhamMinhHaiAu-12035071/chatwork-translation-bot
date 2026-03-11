import { afterEach, describe, expect, it } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { QueueRunner } from './queue-runner'

const baseDir = join(tmpdir(), 'dataset-runner-queue-runner-test')

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true })
})

describe('QueueRunner', () => {
  it('processes one item at a time in FIFO order', () => {
    const runner = new QueueRunner({
      autorun: true,
      inputDir: '/tmp/input',
      outputBaseDir: '/tmp/output',
      defaultOriginalRoomId: 424846369,
      apiToken: 'test-token',
      cooldownMs: 0,
      maxRetries: 3,
      timeoutMs: 1000,
      resetMode: 'resume',
      clearFailed: false,
      clearOutput: false,
    })

    expect(runner.getStatus().mode).toBe('idle')
  })

  it('releases runner.lock when shutdown is requested during idle wait', async () => {
    const inputDir = join(baseDir, 'input')
    const runner = new QueueRunner({
      autorun: true,
      inputDir,
      outputBaseDir: join(baseDir, 'output'),
      defaultOriginalRoomId: 424846369,
      apiToken: 'test-token',
      cooldownMs: 0,
      maxRetries: 3,
      timeoutMs: 1000,
      resetMode: 'resume',
      clearFailed: false,
      clearOutput: false,
    })

    const runPromise = runner.run()
    await Bun.sleep(25)
    runner.shutdown()

    const outcome = await Promise.race([
      runPromise.then(() => 'stopped'),
      Bun.sleep(250).then(() => 'timed-out'),
    ])

    expect(outcome).toBe('stopped')
    expect(await Bun.file(join(inputDir, 'state', 'runner.lock')).exists()).toBe(false)
  })
})
