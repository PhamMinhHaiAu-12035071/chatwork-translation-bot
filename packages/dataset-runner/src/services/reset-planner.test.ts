import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { applyStartupReset } from './reset-planner'

const baseDir = join(tmpdir(), 'reset-planner-test')
const outputDir = join(tmpdir(), 'reset-planner-output')

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true })
  await rm(outputDir, { recursive: true, force: true })
})

describe('applyStartupReset', () => {
  it('moves an archived file back to pending for from-start replay', async () => {
    await mkdir(join(baseDir, 'archive'), { recursive: true })
    await mkdir(join(baseDir, 'state'), { recursive: true })
    await Bun.write(
      join(baseDir, 'archive', '001-vfa-thinhntt-2026-03-10.jsonl'),
      '{"id":"vfa-001","message":"ありがとう"}\n',
    )
    await Bun.write(
      join(baseDir, 'state', '001-vfa-thinhntt-2026-03-10.jsonl.state.json'),
      '{"nextLineNumber":2}',
    )

    const summary = await applyStartupReset({
      inputDir: baseDir,
      outputDir,
      mode: 'from-start',
      fileName: '001-vfa-thinhntt-2026-03-10.jsonl',
      confirmToken: 'nonce-1',
      clearFailed: false,
      clearOutput: false,
    })

    expect(summary?.mode).toBe('from-start')
    expect(
      await Bun.file(join(baseDir, 'pending', '001-vfa-thinhntt-2026-03-10.jsonl')).exists(),
    ).toBe(true)
    expect(
      await Bun.file(
        join(baseDir, 'state', '001-vfa-thinhntt-2026-03-10.jsonl.state.json'),
      ).exists(),
    ).toBe(false)
  })

  it('rewrites checkpoint state for from-line replay', async () => {
    await mkdir(join(baseDir, 'state'), { recursive: true })
    await Bun.write(
      join(baseDir, 'state', '001-vfa-thinhntt-2026-03-10.jsonl.state.json'),
      JSON.stringify({
        fileName: '001-vfa-thinhntt-2026-03-10.jsonl',
        nextLineNumber: 10,
        completedItemIds: ['vfa-001', 'vfa-002'],
        failedItemIds: ['vfa-003'],
        updatedAt: '2026-03-10T11:36:19.619Z',
      }),
    )

    const summary = await applyStartupReset({
      inputDir: baseDir,
      outputDir,
      mode: 'from-line',
      fileName: '001-vfa-thinhntt-2026-03-10.jsonl',
      lineNumber: 2,
      confirmToken: 'nonce-2',
      clearFailed: false,
      clearOutput: false,
    })

    expect(summary?.mode).toBe('from-line')
    const state = (await Bun.file(
      join(baseDir, 'state', '001-vfa-thinhntt-2026-03-10.jsonl.state.json'),
    ).json()) as {
      nextLineNumber: number
      completedItemIds: string[]
      failedItemIds: string[]
      inFlight?: unknown
    }
    expect(state.nextLineNumber).toBe(2)
    expect(state.completedItemIds).toEqual([])
    expect(state.failedItemIds).toEqual([])
    expect(state.inFlight).toBeUndefined()
  })

  it('consumes reset token and does not re-apply the same reset twice', async () => {
    await mkdir(join(baseDir, 'state'), { recursive: true })
    await Bun.write(
      join(baseDir, 'state', '001-vfa-thinhntt-2026-03-10.jsonl.state.json'),
      JSON.stringify({
        fileName: '001-vfa-thinhntt-2026-03-10.jsonl',
        nextLineNumber: 10,
        completedItemIds: ['vfa-001'],
        failedItemIds: [],
        updatedAt: '2026-03-10T11:36:19.619Z',
      }),
    )

    const first = await applyStartupReset({
      inputDir: baseDir,
      outputDir,
      mode: 'from-line',
      fileName: '001-vfa-thinhntt-2026-03-10.jsonl',
      lineNumber: 2,
      confirmToken: 'nonce-repeat',
      clearFailed: false,
      clearOutput: false,
    })

    const second = await applyStartupReset({
      inputDir: baseDir,
      outputDir,
      mode: 'from-line',
      fileName: '001-vfa-thinhntt-2026-03-10.jsonl',
      lineNumber: 8,
      confirmToken: 'nonce-repeat',
      clearFailed: false,
      clearOutput: false,
    })

    expect(first?.mode).toBe('from-line')
    expect(second).toBeNull()

    const state = (await Bun.file(
      join(baseDir, 'state', '001-vfa-thinhntt-2026-03-10.jsonl.state.json'),
    ).json()) as { nextLineNumber: number }
    expect(state.nextLineNumber).toBe(2)
  })

  it('never deletes output directory even when clearOutput=true', async () => {
    await mkdir(outputDir, { recursive: true })
    await Bun.write(join(outputDir, 'keep.txt'), 'keep')

    await applyStartupReset({
      inputDir: baseDir,
      outputDir,
      mode: 'from-start',
      fileName: '001-vfa-thinhntt-2026-03-10.jsonl',
      confirmToken: 'nonce-3',
      clearFailed: false,
      clearOutput: true,
    })

    expect(await Bun.file(join(outputDir, 'keep.txt')).exists()).toBe(true)
  })

  it('throws when reset mode is non-resume but confirmToken is missing', async () => {
    let caught: unknown
    try {
      await applyStartupReset({
        inputDir: baseDir,
        outputDir,
        mode: 'from-start',
        fileName: '001-vfa-thinhntt-2026-03-10.jsonl',
        clearFailed: false,
        clearOutput: false,
      })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toContain('DATASET_RESET_CONFIRM')
  })
})
