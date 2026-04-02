import { describe, expect, it } from 'bun:test'
import {
  FREE_ROOM_KAGI_STYLES,
  freeRoomCreateSchema,
  freeRoomEditSchema,
} from '~/lib/free-room-schemas'

describe('free-room-schemas', () => {
  it('validates create input for a free room', () => {
    const parsed = freeRoomCreateSchema.parse({
      originalRoomId: 424846369,
      destinationRoomName: 'Sakura Desk JP Free',
      kagiStyle: 'Clear',
      context: 'Use plain Japanese for internal team chat.',
      protectedKeywords: [
        {
          keyword: 'Chatwork Translation Bot',
          category: 'project',
          placeholder: '__BOT__',
        },
      ],
    })

    expect(parsed.originalRoomId).toBe(424846369)
    expect(parsed.destinationRoomName).toBe('Sakura Desk JP Free')
    expect(parsed.kagiStyle).toBe('Clear')
    expect(parsed.context).toBe('Use plain Japanese for internal team chat.')
    expect(parsed.protectedKeywords).toHaveLength(1)
  })

  it('validates edit input for a free room', () => {
    const parsed = freeRoomEditSchema.parse({
      originalRoomId: 424846369,
      destinationRoomName: 'Sakura Desk JP Free',
      kagiStyle: 'Polite',
      context: '',
      protectedKeywords: [],
    })

    expect(parsed.originalRoomId).toBe(424846369)
    expect(parsed.kagiStyle).toBe('Polite')
    expect(parsed.context).toBe('')
  })

  it('rejects context longer than 100 characters', () => {
    const parsed = freeRoomCreateSchema.safeParse({
      originalRoomId: 424846369,
      destinationRoomName: 'Sakura Desk JP Free',
      kagiStyle: 'Clear',
      context: 'x'.repeat(101),
      protectedKeywords: [],
    })

    expect(parsed.success).toBe(false)
    if (parsed.success) {
      return
    }

    expect(parsed.error.issues[0]?.message).toBe('Max 100 characters')
  })

  it('exposes all supported Kagi styles for UI options', () => {
    expect(FREE_ROOM_KAGI_STYLES).toEqual([
      'Wild',
      'Warm',
      'Easy',
      'Clear',
      'Smart',
      'Deep',
      'Fine',
      'Polite',
      'Elegant',
      'True',
      'Precise',
      'Exact',
    ])
  })
})
