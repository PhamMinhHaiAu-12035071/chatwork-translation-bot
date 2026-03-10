import { afterEach, describe, expect, it } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { resolveOutputOrigin } from './output-origin'

const inputDir = join(tmpdir(), 'output-origin-test')

afterEach(async () => {
  await rm(inputDir, { recursive: true, force: true })
})

describe('resolveOutputOrigin', () => {
  it('returns manual when no source-map entry exists', async () => {
    const origin = await resolveOutputOrigin('manual-1', inputDir)
    expect(origin.type).toBe('manual')
  })
})
