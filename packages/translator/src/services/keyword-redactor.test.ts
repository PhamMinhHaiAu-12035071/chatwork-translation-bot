import { describe, it, expect } from 'bun:test'
import type { KeywordEntry } from '~/types/keyword-entry'
import { mask, restore } from '~/services/keyword-redactor'

// --- helpers ---
function entry(
  keyword: string,
  category: KeywordEntry['category'],
  placeholder?: string,
): KeywordEntry {
  return placeholder ? { keyword, category, placeholder } : { keyword, category }
}

// ============================================================
// Basic masking
// ============================================================

describe('mask — basic', () => {
  it('returns no-op result for empty keyword list', () => {
    const { maskedText, restoreMap, systemHint } = mask('Hello Asia Vion', [])
    expect(maskedText).toBe('Hello Asia Vion')
    expect(restoreMap.size).toBe(0)
    expect(systemHint).toBe('')
  })

  it('replaces keyword with auto-generated placeholder', () => {
    const { maskedText } = mask('Hello Asia Vion team', [entry('Asia Vion', 'company')])
    expect(maskedText).toBe('Hello [COMPANY_1] team')
  })

  it('replaces keyword with custom placeholder', () => {
    const { maskedText } = mask('Project Phoenix is live', [
      entry('Project Phoenix', 'project', 'PROJ_A'),
    ])
    expect(maskedText).toBe('[PROJ_A] is live')
  })

  it('restoreMap maps placeholder back to original keyword', () => {
    const { restoreMap } = mask('Asia Vion update', [entry('Asia Vion', 'company')])
    expect(restoreMap.get('[COMPANY_1]')).toBe('Asia Vion')
  })

  it('replaces all occurrences of a keyword in the text', () => {
    const { maskedText } = mask('Asia Vion and Asia Vion again', [entry('Asia Vion', 'company')])
    expect(maskedText).toBe('[COMPANY_1] and [COMPANY_1] again')
  })

  it('multiple keywords get sequential placeholders per category', () => {
    const { maskedText } = mask('Asia Vion and Beta Corp', [
      entry('Asia Vion', 'company'),
      entry('Beta Corp', 'company'),
    ])
    expect(maskedText).toContain('[COMPANY_1]')
    expect(maskedText).toContain('[COMPANY_2]')
  })

  it('placeholders across categories are independent counters', () => {
    const { maskedText } = mask('Asia Vion CEO Tanaka', [
      entry('Asia Vion', 'company'),
      entry('CEO Tanaka', 'person'),
    ])
    expect(maskedText).toBe('[COMPANY_1] [PERSON_1]')
  })

  it('longest keyword matched first — no partial-overlap bugs', () => {
    const { maskedText } = mask('Asia Vion Corp', [
      entry('Asia Vion', 'company'),
      entry('Asia Vion Corp', 'company'),
    ])
    // "Asia Vion Corp" must be fully replaced as [COMPANY_1], not partially as "[COMPANY_2] Corp"
    expect(maskedText).not.toContain('Corp')
    expect(maskedText).toContain('[COMPANY_1]')
  })

  it('placeholder assignment is deterministic — masking any segment gives same mapping', () => {
    const keywords = [entry('Asia Vion', 'company'), entry('Bob Smith', 'person')]
    const { restoreMap: mapFull } = mask('Asia Vion met Bob Smith', keywords)
    const { restoreMap: mapSeg1 } = mask('Asia Vion', keywords)
    const { restoreMap: mapSeg2 } = mask('Bob Smith', keywords)
    // Same keywords → same placeholder assignments regardless of which text is masked
    expect(mapFull.get('[COMPANY_1]')).toBe(mapSeg1.get('[COMPANY_1]'))
    expect(mapFull.get('[PERSON_1]')).toBe(mapSeg2.get('[PERSON_1]'))
  })
})

// ============================================================
// Smart regex matching (EN)
// ============================================================

describe('mask — EN smart matching', () => {
  it('case-insensitive — "asia vion" matches keyword "Asia Vion"', () => {
    const { maskedText } = mask('hello asia vion team', [entry('Asia Vion', 'company')])
    expect(maskedText).toBe('hello [COMPANY_1] team')
  })

  it('compound — "AsiaVion" matches keyword "Asia Vion"', () => {
    const { maskedText } = mask('AsiaVion update', [entry('Asia Vion', 'company')])
    expect(maskedText).toBe('[COMPANY_1] update')
  })

  it('hyphen — "Asia-Vion" matches keyword "Asia Vion"', () => {
    const { maskedText } = mask('Asia-Vion update', [entry('Asia Vion', 'company')])
    expect(maskedText).toBe('[COMPANY_1] update')
  })

  it('underscore — "Asia_Vion" matches keyword "Asia Vion"', () => {
    const { maskedText } = mask('Asia_Vion update', [entry('Asia Vion', 'company')])
    expect(maskedText).toBe('[COMPANY_1] update')
  })

  it('special regex chars — "C++ Team" does not break pattern', () => {
    const fn = () => mask('C++ Team standup', [entry('C++ Team', 'project')])
    expect(fn).not.toThrow()
    const { maskedText } = fn()
    expect(maskedText).toBe('[PROJECT_1] standup')
  })

  it('special regex chars — "R&D Dept" does not break pattern', () => {
    const fn = () => mask('R&D Dept update', [entry('R&D Dept', 'other')])
    expect(fn).not.toThrow()
    const { maskedText } = fn()
    expect(maskedText).toBe('[TERM_1] update')
  })
})

// ============================================================
// Vietnamese
// ============================================================

describe('mask — Vietnamese', () => {
  it('"Á Châu" matches "á châu" via /i flag', () => {
    const { maskedText } = mask('tin tức á châu hôm nay', [entry('Á Châu', 'company')])
    expect(maskedText).toBe('tin tức [COMPANY_1] hôm nay')
  })

  it('"Á Châu" matches "Á CHÂU" via /i flag', () => {
    const { maskedText } = mask('Á CHÂU Corp', [entry('Á Châu', 'company')])
    expect(maskedText).toBe('[COMPANY_1] Corp')
  })

  it('NFC vs NFD — keyword stored NFC, message arrives NFD → still matches', () => {
    // NFD: character decomposed (e.g., Á = A + combining acute)
    const nfdText = 'Ông Nguyễn Văn An báo cáo'.normalize('NFD')
    const { maskedText } = mask(nfdText, [entry('Nguyễn Văn An', 'person')])
    expect(maskedText).toContain('[PERSON_1]')
    expect(maskedText).not.toContain('Nguyễn Văn An')
  })

  it('full name "Nguyễn Văn An" → restored correctly after round-trip', () => {
    const original = 'Báo cáo từ Nguyễn Văn An hôm nay'
    const { maskedText, restoreMap } = mask(original, [entry('Nguyễn Văn An', 'person')])
    const restored = restore(maskedText, restoreMap)
    expect(restored).toBe(original)
  })

  it('compound tones "ắc quy" not corrupted after round-trip', () => {
    const original = 'Dự án ắc quy lithium đang tiến hành'
    const { maskedText, restoreMap } = mask(original, [entry('ắc quy', 'project')])
    const restored = restore(maskedText, restoreMap)
    expect(restored).toBe(original)
  })

  it('keyword mid-sentence — surrounding characters unaffected', () => {
    const { maskedText } = mask('Xin chào Nguyễn Văn An, bạn khỏe không?', [
      entry('Nguyễn Văn An', 'person'),
    ])
    expect(maskedText).toBe('Xin chào [PERSON_1], bạn khỏe không?')
  })
})

// ============================================================
// Japanese
// ============================================================

describe('mask — Japanese', () => {
  it('kanji "田中社長" matches exactly', () => {
    const { maskedText } = mask('田中社長からのメッセージ', [entry('田中社長', 'person')])
    expect(maskedText).toBe('[PERSON_1]からのメッセージ')
  })

  it('full-width space U+3000 "田中\u3000太郎" matches "田中 太郎"', () => {
    const { maskedText } = mask('田中\u3000太郎さんへ', [entry('田中 太郎', 'person')])
    expect(maskedText).toBe('[PERSON_1]さんへ')
  })

  it('mixed "Asia Vion株式会社" — keyword "Asia Vion" matched correctly', () => {
    const { maskedText } = mask('Asia Vion株式会社の報告', [entry('Asia Vion', 'company')])
    expect(maskedText).toBe('[COMPANY_1]株式会社の報告')
  })
})

// ============================================================
// Multi-language
// ============================================================

describe('mask — multi-language', () => {
  it('EN+VI+JP in one message — all keywords replaced correctly', () => {
    const text = 'Asia Vion: Nguyễn Văn An 様, 田中社長 approved.'
    const { maskedText } = mask(text, [
      entry('Asia Vion', 'company'),
      entry('Nguyễn Văn An', 'person'),
      entry('田中社長', 'person'),
    ])
    expect(maskedText).toBe('[COMPANY_1]: [PERSON_1] 様, [PERSON_2] approved.')
  })

  it('round-trip: mask → simulated translate → restore — all 3 languages intact', () => {
    const original = 'Asia Vion: Nguyễn Văn An và 田中社長 đã xác nhận.'
    const keywords = [
      entry('Asia Vion', 'company'),
      entry('Nguyễn Văn An', 'person'),
      entry('田中社長', 'person'),
    ]
    const { maskedText, restoreMap } = mask(original, keywords)

    // Simulate: "AI" translates but preserves placeholders
    const simulatedTranslation = maskedText.replace(
      '[COMPANY_1]: [PERSON_1] và [PERSON_2] đã xác nhận.',
      '[COMPANY_1]: [PERSON_1] và [PERSON_2] đã xác nhận.',
    )

    const restored = restore(simulatedTranslation, restoreMap)
    expect(restored).toContain('Asia Vion')
    expect(restored).toContain('Nguyễn Văn An')
    expect(restored).toContain('田中社長')
  })
})

// ============================================================
// restore()
// ============================================================

describe('restore', () => {
  it('placeholder appears multiple times in translation → all restored', () => {
    const map = new Map([['[COMPANY_1]', 'Asia Vion']])
    const result = restore('[COMPANY_1] and [COMPANY_1] again', map)
    expect(result).toBe('Asia Vion and Asia Vion again')
  })

  it('empty restoreMap → text unchanged', () => {
    const result = restore('hello world', new Map())
    expect(result).toBe('hello world')
  })
})

// ============================================================
// systemHint
// ============================================================

describe('mask — systemHint', () => {
  it('generates systemHint with all placeholders and their category descriptions', () => {
    const { systemHint } = mask('Asia Vion CEO Tanaka', [
      entry('Asia Vion', 'company'),
      entry('CEO Tanaka', 'person'),
    ])
    expect(systemHint).toContain('[COMPANY_1]')
    expect(systemHint).toContain('company or organization name')
    expect(systemHint).toContain('[PERSON_1]')
    expect(systemHint).toContain('person name')
  })

  it('empty systemHint for empty keyword list', () => {
    const { systemHint } = mask('hello', [])
    expect(systemHint).toBe('')
  })
})

// ============================================================
// Performance
// ============================================================

describe('KeywordRedactor — performance', () => {
  it('50 keywords masked in < 100ms on 1000-char text', () => {
    const keywords: KeywordEntry[] = Array.from({ length: 50 }, (_, i) => ({
      keyword: `Keyword${i.toString().padStart(2, '0')}`,
      category: 'company' as const,
    }))
    const text = 'Lorem ipsum dolor sit amet '.repeat(40) // ~1000 chars
    const start = performance.now()
    mask(text, keywords)
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(100)
  })
})
