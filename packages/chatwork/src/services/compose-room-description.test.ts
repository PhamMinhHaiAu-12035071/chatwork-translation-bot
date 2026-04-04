import { describe, expect, it } from 'bun:test'
import { composeRoomDescription } from './compose-room-description'

describe('composeRoomDescription', () => {
  it('generates correct format with decorative symbols and no blank line', () => {
    const result = composeRoomDescription('JP Project Demo')

    const expected = '◦•●◉✿ TRANSLATION ROOM ✿◉●•◦\n' + '╰┈☆ Original ☆┈╯: JP Project Demo'

    expect(result).toBe(expected)
  })

  it('handles long room names without truncation', () => {
    const longName =
      '🔴 [URGENT] Q4 2026 Product Roadmap Planning & Strategy Discussion - Engineering Team Alpha Beta Gamma Delta'
    const result = composeRoomDescription(longName)

    // Should contain full name, no "..." truncation
    expect(result).toContain(longName)
    expect(result).not.toContain('...')

    // Should still have decorative title
    expect(result).toContain('◦•●◉✿ TRANSLATION ROOM ✿◉●•◦')
  })

  it('preserves special characters, Unicode, and emoji in room name', () => {
    const specialName = 'Café & Bar 日本語 🎉 <Test>'
    const result = composeRoomDescription(specialName)

    expect(result).toContain(specialName)
    expect(result).toContain('╰┈☆ Original ☆┈╯: Café & Bar 日本語 🎉 <Test>')
  })

  it('handles empty room name gracefully', () => {
    const result = composeRoomDescription('')

    const expected = '◦•●◉✿ TRANSLATION ROOM ✿◉●•◦\n' + '╰┈☆ Original ☆┈╯: '

    expect(result).toBe(expected)
  })

  it('handles single character room name', () => {
    const result = composeRoomDescription('A')

    expect(result).toBe('◦•●◉✿ TRANSLATION ROOM ✿◉●•◦\n' + '╰┈☆ Original ☆┈╯: A')
  })

  it('maintains exact 2-line structure with no extra whitespace', () => {
    const result = composeRoomDescription('Test Room')
    const lines = result.split('\n')

    // Should be exactly 2 lines
    expect(lines).toHaveLength(2)

    // Line 1 should match title pattern
    expect(lines[0]).toBe('◦•●◉✿ TRANSLATION ROOM ✿◉●•◦')

    // Line 2 should match original pattern
    expect(lines[1]).toBe('╰┈☆ Original ☆┈╯: Test Room')

    // No trailing or leading whitespace
    expect(result).not.toMatch(/^\s/)
    expect(result).not.toMatch(/\s$/)
  })
})
