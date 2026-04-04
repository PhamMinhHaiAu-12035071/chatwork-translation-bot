import { describe, expect, it } from 'bun:test'
import { JAPANESE_RULES } from '~/sections/language-layers'

describe('JAPANESE_RULES - Person Name Romanization', () => {
  it('should contain romanization instructions for person names with さん', () => {
    // Test that JAPANESE_RULES includes romanization guidance
    expect(JAPANESE_RULES).toContain('Sasaki-san')
    expect(JAPANESE_RULES).toContain('佐々木さん')
    expect(JAPANESE_RULES).toContain('Romanize')
  })

  it('should NOT contain "Do not auto-romanize" instruction', () => {
    // Test that blocking rule is removed
    expect(JAPANESE_RULES).not.toContain('Do not auto-romanize')
    expect(JAPANESE_RULES).not.toContain('Keep Japanese-script personal names as written')
  })

  it('should contain lightweight verification reminder', () => {
    expect(JAPANESE_RULES).toContain('Before Outputting')
    expect(JAPANESE_RULES).toContain('Verify')
  })
})
