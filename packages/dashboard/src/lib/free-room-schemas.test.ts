import { describe, expect, it } from 'bun:test'
import {
  FREE_ROOM_KAGI_STYLES,
  getFreeRoomKagiStyleDescription,
  freeRoomCreateSchema,
  freeRoomEditSchema,
} from '~/lib/free-room-schemas'

describe('free-room-schemas', () => {
  it('validates create input for a free room', () => {
    const parsed = freeRoomCreateSchema.parse({
      originalRoomId: 424846369,
      originalRoomName: 'Sakura Desk JP',
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
    expect(parsed.originalRoomName).toBe('Sakura Desk JP')
    expect(parsed.destinationRoomName).toBe('Sakura Desk JP Free')
    expect(parsed.kagiStyle).toBe('Clear')
    expect(parsed.context).toBe('Use plain Japanese for internal team chat.')
    expect(parsed.protectedKeywords).toHaveLength(1)
  })

  it('validates edit input for a free room', () => {
    const parsed = freeRoomEditSchema.parse({
      originalRoomId: 424846369,
      originalRoomName: 'Sakura Desk JP',
      destinationRoomName: 'Sakura Desk JP Free',
      kagiStyle: 'Polite',
      context: '',
      protectedKeywords: [],
    })

    expect(parsed.originalRoomId).toBe(424846369)
    expect(parsed.originalRoomName).toBe('Sakura Desk JP')
    expect(parsed.kagiStyle).toBe('Polite')
    expect(parsed.context).toBe('')
  })

  it('rejects context longer than 100 characters', () => {
    const parsed = freeRoomCreateSchema.safeParse({
      originalRoomId: 424846369,
      originalRoomName: 'Sakura Desk JP',
      destinationRoomName: 'Sakura Desk JP Free',
      kagiStyle: 'Clear',
      context: 'x'.repeat(101),
      protectedKeywords: [],
    })

    expect(parsed.success).toBe(false)
    if (parsed.success) {
      return
    }

    expect(parsed.error.issues.find((issue) => issue.path[0] === 'context')?.message).toBe(
      'Max 100 characters',
    )
  })

  it('exposes all supported translation styles for UI options', () => {
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

  it('returns short helper text for each supported style', () => {
    expect(getFreeRoomKagiStyleDescription('Wild')).toBe('Casual, vivid, and full of energy.')
    expect(getFreeRoomKagiStyleDescription('Clear')).toBe('Balanced, natural, and easy to read.')
    expect(getFreeRoomKagiStyleDescription('Exact')).toBe(
      'Literal and highly precise for nuanced text.',
    )
  })

  it('requires originalRoomName', () => {
    const result = freeRoomCreateSchema.safeParse({
      originalRoomId: 123456,
      // originalRoomName: missing
      destinationRoomName: 'Free Translation',
      kagiStyle: 'Clear',
    })

    expect(result.success).toBe(false)
  })

  it('trims originalRoomName', () => {
    const result = freeRoomCreateSchema.safeParse({
      originalRoomId: 123456,
      originalRoomName: '  Free Demo  ',
      destinationRoomName: 'Free Translation',
      kagiStyle: 'Clear',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.originalRoomName).toBe('Free Demo')
    }
  })

  it('rejects empty originalRoomName', () => {
    const result = freeRoomCreateSchema.safeParse({
      originalRoomId: 123456,
      originalRoomName: '',
      destinationRoomName: 'Free Translation',
      kagiStyle: 'Clear',
    })

    expect(result.success).toBe(false)
  })

  it('rejects originalRoomName longer than 100 chars', () => {
    const result = freeRoomCreateSchema.safeParse({
      originalRoomId: 123456,
      originalRoomName: 'B'.repeat(101),
      destinationRoomName: 'Free Translation',
      kagiStyle: 'Clear',
    })

    expect(result.success).toBe(false)
  })
})
