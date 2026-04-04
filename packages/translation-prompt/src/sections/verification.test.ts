import { describe, expect, it } from 'bun:test'
import { SELF_VERIFICATION } from '~/sections/verification'

describe('SELF_VERIFICATION - Enhanced Checklist', () => {
  it('should contain Japanese romanization check', () => {
    expect(SELF_VERIFICATION).toContain('Japanese romanization')
    expect(SELF_VERIFICATION).toContain('Hepburn')
  })

  it('should contain technical term completeness check', () => {
    expect(SELF_VERIFICATION).toContain('Technical term completeness')
    expect(SELF_VERIFICATION).toContain('compound terms')
    expect(SELF_VERIFICATION).toContain('giai đoạn')
  })

  it('should contain consistency check', () => {
    expect(SELF_VERIFICATION).toContain('Consistency check')
    expect(SELF_VERIFICATION).toContain('Same name/term')
  })

  it('should contain reference completeness check', () => {
    expect(SELF_VERIFICATION).toContain('Reference completeness')
    expect(SELF_VERIFICATION).toContain('first-mention parentheses')
  })
})
