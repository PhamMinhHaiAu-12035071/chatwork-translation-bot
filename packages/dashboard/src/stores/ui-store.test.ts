import { beforeEach, describe, expect, it } from 'bun:test'

import { useUiStore } from './ui-store'

describe('ui-store — tour state', () => {
  beforeEach(() => {
    useUiStore.setState({ tourSeenVersion: null })
  })

  it('tourSeenVersion starts as null', () => {
    expect(useUiStore.getState().tourSeenVersion).toBeNull()
  })

  it('setTourSeen sets the version', () => {
    useUiStore.getState().setTourSeen(1)

    expect(useUiStore.getState().tourSeenVersion).toBe(1)
  })

  it('resetTour sets tourSeenVersion back to null', () => {
    useUiStore.getState().setTourSeen(1)
    useUiStore.getState().resetTour()

    expect(useUiStore.getState().tourSeenVersion).toBeNull()
  })

  it('setTourSeen with higher version updates correctly', () => {
    useUiStore.getState().setTourSeen(1)
    useUiStore.getState().setTourSeen(2)

    expect(useUiStore.getState().tourSeenVersion).toBe(2)
  })
})
