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
      kagiStyle: 'Raw',
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
    expect(parsed.kagiStyle).toBe('Raw')
    expect(parsed.context).toBe('Use plain Japanese for internal team chat.')
    expect(parsed.protectedKeywords).toHaveLength(1)
  })

  it('validates edit input for a free room', () => {
    const parsed = freeRoomEditSchema.parse({
      originalRoomId: 424846369,
      originalRoomName: 'Sakura Desk JP',
      destinationRoomName: 'Sakura Desk JP Free',
      kagiStyle: 'Raw',
      context: '',
      protectedKeywords: [],
    })

    expect(parsed.originalRoomId).toBe(424846369)
    expect(parsed.originalRoomName).toBe('Sakura Desk JP')
    expect(parsed.kagiStyle).toBe('Raw')
    expect(parsed.context).toBe('')
  })

  it('rejects context longer than 100 characters', () => {
    const parsed = freeRoomCreateSchema.safeParse({
      originalRoomId: 424846369,
      originalRoomName: 'Sakura Desk JP',
      destinationRoomName: 'Sakura Desk JP Free',
      kagiStyle: 'Raw',
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

  it('exposes only verified translation styles for UI options', () => {
    expect(FREE_ROOM_KAGI_STYLES).toEqual(['Raw', 'Clear'])
  })

  it('returns short helper text for verified style', () => {
    expect(getFreeRoomKagiStyleDescription('Raw')).toBe(
      'Casual Vietnamese, suitable for friends or peers',
    )
    expect(getFreeRoomKagiStyleDescription('Clear')).toBe('Balanced, natural, and easy to read.')
  })

  it('requires originalRoomName', () => {
    const result = freeRoomCreateSchema.safeParse({
      originalRoomId: 123456,
      // originalRoomName: missing
      destinationRoomName: 'Free Translation',
      kagiStyle: 'Raw',
    })

    expect(result.success).toBe(false)
  })

  it('trims originalRoomName', () => {
    const result = freeRoomCreateSchema.safeParse({
      originalRoomId: 123456,
      originalRoomName: '  Free Demo  ',
      destinationRoomName: 'Free Translation',
      kagiStyle: 'Raw',
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
      kagiStyle: 'Raw',
    })

    expect(result.success).toBe(false)
  })

  it('rejects originalRoomName longer than 100 chars', () => {
    const result = freeRoomCreateSchema.safeParse({
      originalRoomId: 123456,
      originalRoomName: 'B'.repeat(101),
      destinationRoomName: 'Free Translation',
      kagiStyle: 'Raw',
    })

    expect(result.success).toBe(false)
  })
})
