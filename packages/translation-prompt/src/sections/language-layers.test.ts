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

describe('JAPANESE_RULES - Company Name Romanization', () => {
  it('should contain romanization examples for company names', () => {
    expect(JAPANESE_RULES).toContain('DExpert Kihon-bu')
    expect(JAPANESE_RULES).toContain('デキスパート基本部')
    expect(JAPANESE_RULES).toContain('Katakana + Kanji')
  })

  it('should show first mention vs later mention pattern', () => {
    expect(JAPANESE_RULES).toContain('First mention')
    expect(JAPANESE_RULES).toContain('Later mentions')
  })
})

describe('JAPANESE_RULES - Technical Compound Term Translation', () => {
  it('should contain technical term translation examples', () => {
    expect(JAPANESE_RULES).toContain('2nd開発')
    expect(JAPANESE_RULES).toContain('phát triển giai đoạn 2')
    expect(JAPANESE_RULES).toContain('Number/Ordinal + Japanese term')
  })

  it('should show "giai đoạn" pattern for phased work', () => {
    expect(JAPANESE_RULES).toContain('giai đoạn')
  })
})

describe('JAPANESE_RULES - Abbreviation and Brand Handling', () => {
  it('should contain abbreviation keep-as-is example', () => {
    expect(JAPANESE_RULES).toContain('MTG')
    expect(JAPANESE_RULES).toContain('Keep unchanged')
  })

  it('should contain famous brand keep-as-is example', () => {
    expect(JAPANESE_RULES).toContain('Toyota')
    expect(JAPANESE_RULES).toContain('Well-known global brands')
  })
})

describe('JAPANESE_RULES - Special Cases', () => {
  it('should contain working hours preservation instruction', () => {
    expect(JAPANESE_RULES).toContain('Working time')
    expect(JAPANESE_RULES).toContain('preserve working hours exactly')
  })

  it('should contain consistency requirement', () => {
    expect(JAPANESE_RULES).toContain('Consistency')
    expect(JAPANESE_RULES).toContain('same name/term')
    expect(JAPANESE_RULES).toContain('identically throughout')
  })

  it('should contain [rp] tag handling instruction', () => {
    expect(JAPANESE_RULES).toContain('[rp]')
  })
})
