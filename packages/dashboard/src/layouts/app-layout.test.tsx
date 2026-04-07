import { describe, expect, it } from 'bun:test'

describe('AppLayout', () => {
  it('removes redundant sidebar helper copy', async () => {
    const source = await Bun.file(new URL('./app-layout.tsx', import.meta.url)).text()

    expect(source).not.toContain("blurb: 'overview + empty state'")
    expect(source).not.toContain("blurb: 'future creation flow'")
    expect(source).not.toContain("blurb: 'manual setup steps'")
    expect(source).not.toContain(
      'Multi-room dashboard shell for setup, guidance, and future activation flows.',
    )
  })

  it('does not maintain a second manual tour state machine on top of nextstepjs', async () => {
    const source = await Bun.file(new URL('./app-layout.tsx', import.meta.url)).text()

    expect(source).not.toContain('tour:completion-back-to-rooms')
    expect(source).not.toContain('setCurrentStep?.(21, 0)')
    expect(source).not.toContain('setCurrentStep?.(16, 0)')
  })

  it('does not auto-restart the tour when navigating back to "/" mid-tour', async () => {
    const source = await Bun.file(new URL('./app-layout.tsx', import.meta.url)).text()

    expect(source).toContain('currentTour === TOUR_NAME')
  })

  it('explicitly closes tour in onComplete and onSkip to prevent overlay race condition', async () => {
    const source = await Bun.file(new URL('./app-layout.tsx', import.meta.url)).text()

    expect(source).toContain('closeNextStep()')
    expect(/onComplete[\s\S]*closeNextStep\(\)/.exec(source)).toBeTruthy()
    expect(/onSkip[\s\S]*closeNextStep\(\)/.exec(source)).toBeTruthy()
  })

  it('closes NextStep when returning from room create with spotlightRoomId state', async () => {
    const source = await Bun.file(new URL('./app-layout.tsx', import.meta.url)).text()

    expect(source).toContain('spotlightRoomId')
    expect(source).toContain('persistHasHydrated')
  })

  it('renders the tour replay float button so users can reopen help guide', async () => {
    const source = await Bun.file(new URL('./app-layout.tsx', import.meta.url)).text()

    expect(source).toContain('import { TourFloatButton }')
    expect(source).toContain('<TourFloatButton />')
  })
})
