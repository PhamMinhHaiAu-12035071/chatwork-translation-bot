import { describe, expect, it } from 'bun:test'
import { getReplayTourForRoute } from '~/lib/tour-steps'

describe('TourFloatButton routing logic', () => {
  describe('replay tour selection', () => {
    it('selects dashboard-empty-tour for / with no rooms', () => {
      const result = getReplayTourForRoute('/', false)
      expect(result?.tour).toBe('dashboard-empty-tour')
    })

    it('selects dashboard-with-room-tour for / with rooms', () => {
      const result = getReplayTourForRoute('/', true)
      expect(result?.tour).toBe('dashboard-with-room-tour')
    })

    it('selects create-room-tour for /rooms/new', () => {
      const result = getReplayTourForRoute('/rooms/new', false)
      expect(result?.tour).toBe('create-room-tour')
    })

    it('selects edit-room-tour for /rooms/:id', () => {
      const result = getReplayTourForRoute('/rooms/123', false)
      expect(result?.tour).toBe('edit-room-tour')
    })

    it('disables tour for unsupported routes', () => {
      const guideTour = getReplayTourForRoute('/guide', false)
      const freeRoomsTour = getReplayTourForRoute('/free-rooms', false)

      expect(guideTour).toBeNull()
      expect(freeRoomsTour).toBeNull()
    })

    it('applies the correct tour even with varied room counts', () => {
      const emptyDash = getReplayTourForRoute('/', false)
      const withOneRoom = getReplayTourForRoute('/', true)

      expect(emptyDash?.tour).toBe('dashboard-empty-tour')
      expect(withOneRoom?.tour).toBe('dashboard-with-room-tour')
      expect(emptyDash?.steps.length).toBe(6)
      expect(withOneRoom?.steps.length).toBe(10)
    })
  })
})
