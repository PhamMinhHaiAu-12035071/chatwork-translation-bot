import { describe, expect, it } from 'bun:test'

import { tours, TOUR_NAME, TOUR_VERSION } from './tour-steps'

describe('tour-steps', () => {
  const steps = tours[0]?.steps ?? []

  it('exports exactly one tour named main-tour', () => {
    expect(tours).toHaveLength(1)
    expect(tours[0]?.tour).toBe(TOUR_NAME)
  })

  it('has exactly 22 steps', () => {
    expect(steps).toHaveLength(22)
  })

  it('covers the sidebar and every create-room field we want to explain', () => {
    const selectors = steps.map((step) => step.selector ?? null)

    expect(selectors).toContain('#tour-sidebar-nav')
    expect(selectors).toContain('#tour-new-room')
    expect(selectors).toContain('#tour-field-roomid')
    expect(selectors).toContain('#tour-field-roomname')
    expect(selectors).toContain('#tour-field-provider')
    expect(selectors).toContain('#tour-field-model')
    expect(selectors).toContain('#tour-field-style')
    expect(selectors).toContain('#tour-field-token')
    expect(selectors).toContain('#tour-field-context')
    expect(selectors).toContain('#tour-context-templates')
    expect(selectors).toContain('#tour-field-keywords')
    expect(selectors).toContain('#tour-keyword-addform')
    expect(selectors).toContain('#tour-save-btn')
  })

  it('every step has title and content', () => {
    for (const step of steps) {
      expect(typeof step.title).toBe('string')
      expect(step.title.length).toBeGreaterThan(0)
      expect(typeof step.content).toBe('string')
      expect((step.content as string).length).toBeGreaterThan(0)
    }
  })

  it('every step uses a unique solid hex color', () => {
    const colors = steps.map((step) => (step as { color: string }).color)

    expect(new Set(colors).size).toBe(colors.length)

    for (const color of colors) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('steps 6 and 17 have nextRoute (cross-page navigation)', () => {
    expect((steps[5] as { nextRoute?: string }).nextRoute).toBe('/rooms/new')
    expect((steps[16] as { nextRoute?: string }).nextRoute).toBe('/')
  })

  it('TOUR_VERSION is a positive integer', () => {
    expect(typeof TOUR_VERSION).toBe('number')
    expect(TOUR_VERSION).toBeGreaterThan(0)
  })
})
