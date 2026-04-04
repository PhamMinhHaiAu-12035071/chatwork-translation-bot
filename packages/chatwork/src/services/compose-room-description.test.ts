import { describe, it, expect } from 'bun:test'
import { composeRoomDescription, convertToUnicodeBold } from './compose-room-description'

describe('convertToUnicodeBold', () => {
  it('converts uppercase A-Z to Unicode bold', () => {
    expect(convertToUnicodeBold('ABCDEFGHIJKLMNOPQRSTUVWXYZ')).toBe('𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙')
  })

  it('converts lowercase a-z to Unicode bold', () => {
    expect(convertToUnicodeBold('abcdefghijklmnopqrstuvwxyz')).toBe('𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳')
  })

  it('converts mixed case text', () => {
    expect(convertToUnicodeBold('Hello World')).toBe('𝐇𝐞𝐥𝐥𝐨 𝐖𝐨𝐫𝐥𝐝')
  })

  it('preserves spaces and punctuation', () => {
    expect(convertToUnicodeBold('Hello, World!')).toBe('𝐇𝐞𝐥𝐥𝐨, 𝐖𝐨𝐫𝐥𝐝!')
  })

  it('preserves numbers', () => {
    expect(convertToUnicodeBold('Project 123')).toBe('𝐏𝐫𝐨𝐣𝐞𝐜𝐭 123')
  })

  it('preserves Unicode characters', () => {
    expect(convertToUnicodeBold('プロジェクト')).toBe('プロジェクト')
  })

  it('preserves emoji', () => {
    expect(convertToUnicodeBold('Hello 🚀')).toBe('𝐇𝐞𝐥𝐥𝐨 🚀')
  })

  it('handles empty string', () => {
    expect(convertToUnicodeBold('')).toBe('')
  })

  it('correctly converts "TRANSLATION ROOM"', () => {
    expect(convertToUnicodeBold('TRANSLATION ROOM')).toBe('𝐓𝐑𝐀𝐍𝐒𝐋𝐀𝐓𝐈𝐎𝐍 𝐑𝐎𝐎𝐌')
  })

  it('correctly converts "Original"', () => {
    expect(convertToUnicodeBold('Original')).toBe('𝐎𝐫𝐢𝐠𝐢𝐧𝐚𝐥')
  })
})

describe('composeRoomDescription', () => {
  it('generates correct Neubrutalism format with ASCII room name', () => {
    const result = composeRoomDescription('JP Project Demo')

    expect(result).toContain('🌐')
    expect(result).toContain('𝐓𝐑𝐀𝐍𝐒𝐋𝐀𝐓𝐈𝐎𝐍 𝐑𝐎𝐎𝐌')
    expect(result).toContain('📍')
    expect(result).toContain('𝐎𝐫𝐢𝐠𝐢𝐧𝐚𝐥')
    expect(result).toContain('JP Project Demo')
    expect(result).toContain('╔═')
    expect(result).toContain('╚═')
  })

  it('handles Unicode characters in room name', () => {
    const result = composeRoomDescription('プロジェクト Demo')

    expect(result).toContain('プロジェクト Demo')
    expect(result).toContain('𝐓𝐑𝐀𝐍𝐒𝐋𝐀𝐓𝐈𝐎𝐍 𝐑𝐎𝐎𝐌')
  })

  it('handles emoji in room name', () => {
    const result = composeRoomDescription('Project 🚀 Demo')

    expect(result).toContain('Project 🚀 Demo')
  })
})
