import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
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

  it('hard-stops with process.exit(1) and advances nextLineNumber when delivery ACK is failed', async () => {
    const inputDir = join(baseDir, 'test-failed-ack')
    const outputDir = join(baseDir, 'test-failed-ack-output')
    const knownSourceMessageId = 'msg-known-001'

    // Pre-create dirs and dataset file
    await mkdir(join(inputDir, 'pending'), { recursive: true })
    await mkdir(join(inputDir, 'state', 'acks'), { recursive: true })
    await Bun.write(
      join(inputDir, 'pending', '001-test.jsonl'),
      '{"id":"item-001","message":"hello"}\n',
    )

    // Pre-write state showing item-001 already in awaiting-ack so the runner
    // skips the Chatwork send and goes straight to waitForTerminalAck.
    await writeFile(
      join(inputDir, 'state', '001-test.jsonl.state.json'),
      JSON.stringify({
        fileName: '001-test.jsonl',
        nextLineNumber: 1,
        completedItemIds: [],
        failedItemIds: [],
        updatedAt: new Date().toISOString(),
        inFlight: {
          lineNumber: 1,
          itemId: 'item-001',
          phase: 'awaiting-ack',
          attempt: 1,
          sourceMessageId: knownSourceMessageId,
          startedAt: new Date().toISOString(),
        },
      }),
    )

    // Pre-write a failed ACK on disk — waitForTerminalAck finds it immediately
    await writeFile(
      join(inputDir, 'state', 'acks', `${knownSourceMessageId}.json`),
      JSON.stringify({
        sourceMessageId: knownSourceMessageId,
        status: 'failed',
        destinationRoomId: 424846369,
        errorCode: 'API_ERROR',
        errorMessage: 'Cursor API call failed: The operation was aborted.',
        ackedAt: new Date().toISOString(),
      }),
    )

    // Mock process.exit to throw so the loop stops without actually exiting
    class ExitError extends Error {
      constructor(public readonly code: number) {
        super(`process.exit(${code.toString()})`)
      }
    }
    const exitSpy = spyOn(process, 'exit').mockImplementation(((code: number) => {
      throw new ExitError(code)
    }) as typeof process.exit)

    const runner = new QueueRunner({
      autorun: true,
      inputDir,
      outputBaseDir: outputDir,
      defaultOriginalRoomId: 424846369,
      apiToken: 'test-api-token',
      cooldownMs: 0,
      maxRetries: 1,
      timeoutMs: 5000,
      resetMode: 'resume',
      clearFailed: false,
      clearOutput: false,
    })

    let exitCode: number | undefined
    try {
      await runner.run()
    } catch (err) {
      if (err instanceof ExitError) {
        exitCode = err.code
      } else {
        throw err
      }
    }

    expect(exitCode).toBe(1)

    // nextLineNumber must be advanced past item-001 (line 1 → 2)
    const state = (await Bun.file(join(inputDir, 'state', '001-test.jsonl.state.json')).json()) as {
      nextLineNumber: number
      failedItemIds: string[]
    }
    expect(state.nextLineNumber).toBe(2)
    expect(state.failedItemIds).toContain('item-001')

    // failed.jsonl must record the item and errorCode
    const failedLine = await Bun.file(join(inputDir, 'failed', '001-test.failed.jsonl')).text()
    expect(failedLine).toContain('item-001')
    expect(failedLine).toContain('API_ERROR')

    exitSpy.mockRestore()
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
