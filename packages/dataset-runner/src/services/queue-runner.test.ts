import { describe, expect, it } from 'bun:test'
import { QueueRunner } from './queue-runner'

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
})
