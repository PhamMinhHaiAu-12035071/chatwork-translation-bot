import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'bun:test'

const SOURCE = readFileSync(resolve(import.meta.dir, 'keyword-protection-field.tsx'), 'utf-8')

describe('KeywordProtectionField', () => {
  it('does not depend on the Standard room schema module for its value type', () => {
    expect(SOURCE).not.toContain("from '~/lib/room-schema'")
  })

  it('exports a shared structural keyword entry type for reuse by multiple room forms', () => {
    expect(SOURCE).toContain('export interface KeywordProtectionEntry')
    expect(SOURCE).toContain('keyword: string')
    expect(SOURCE).toContain('category:')
    expect(SOURCE).toContain('placeholder?: string')
  })
})
