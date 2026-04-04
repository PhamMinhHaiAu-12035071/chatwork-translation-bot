import { describe, expect, it } from 'bun:test'
import { composeRoomDescription } from './compose-room-description'

describe('composeRoomDescription', () => {
  // Note: No truncation tests — function has no truncation logic (simple template literal).
  // No length-boundary tests (1 char, 1000 chars) — function has no length-specific behavior.
  // Empty string test covers minimal input; basic test covers typical case; special chars test covers edge cases.

  it('generates correct format with decorative symbols and no blank line', () => {
    const result = composeRoomDescription('JP Project Demo')

    const expected = '◦•●◉✿ TRANSLATION ROOM ✿◉●•◦\n' + '╰┈☆ Original ☆┈╯: JP Project Demo'

    expect(result).toBe(expected)
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
})
