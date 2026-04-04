import { describe, it, expect } from 'bun:test'
import { composeRoomDescription } from './compose-room-description'

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
