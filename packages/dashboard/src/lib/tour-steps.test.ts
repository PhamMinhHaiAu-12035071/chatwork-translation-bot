import { describe, expect, it } from 'bun:test'
import { getReplayTourForRoute } from './tour-steps'

describe('getReplayTourForRoute', () => {
  it('returns dashboard empty replay tour for / with no rooms', () => {
    const replayTour = getReplayTourForRoute('/', false)
    if (!replayTour) throw new Error('Expected replayTour')

    expect(replayTour.tour).toBe('dashboard-empty-tour')
    expect(replayTour.steps.length).toBe(6)
  })

  it('returns dashboard with-room replay tour for / with rooms', () => {
    const replayTour = getReplayTourForRoute('/', true)
    if (!replayTour) throw new Error('Expected replayTour')

    expect(replayTour.tour).toBe('dashboard-with-room-tour')
    expect(replayTour.steps.length).toBe(10)
    expect((replayTour.steps[5] as { selector?: string }).selector).toBe('#tour-room-card-first')
  })

  it('returns create-room replay tour for /rooms/new', () => {
    const replayTour = getReplayTourForRoute('/rooms/new', false)
    if (!replayTour) throw new Error('Expected replayTour')

    expect(replayTour.tour).toBe('create-room-tour')
    expect(replayTour.steps.length).toBe(13)
    // Step[1] is the first form field (Room ID)
    expect((replayTour.steps[1] as { selector?: string }).selector).toBe('#tour-field-roomid')
  })

  it('returns edit-room replay tour for /rooms/:id', () => {
    const tour1 = getReplayTourForRoute('/rooms/123', false)
    expect(tour1?.tour).toBe('edit-room-tour')

    const tour2 = getReplayTourForRoute('/rooms/abc', true)
    expect(tour2?.tour).toBe('edit-room-tour')
  })

  it('returns null for unsupported routes', () => {
    expect(getReplayTourForRoute('/guide', false)).toBeNull()
    expect(getReplayTourForRoute('/free-rooms', false)).toBeNull()
  })

  it('does not include cross-page navigation in replay steps', () => {
    const replayTour = getReplayTourForRoute('/rooms/new', false)
    if (!replayTour) throw new Error('Expected replayTour')

    // Only check if any step has nextRoute or prevRoute - replay steps should not
    const hasNavigation = replayTour.steps.some((step) => {
      // Check if step has any route navigation properties
      return 'nextRoute' in step || 'prevRoute' in step
    })
    expect(hasNavigation).toBe(false)
  })
})
