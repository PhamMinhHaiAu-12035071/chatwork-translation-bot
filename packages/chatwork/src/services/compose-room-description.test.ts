import { describe, expect, it } from 'bun:test'
import { composeRoomDescription } from './compose-room-description'

describe('composeRoomDescription', () => {
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
