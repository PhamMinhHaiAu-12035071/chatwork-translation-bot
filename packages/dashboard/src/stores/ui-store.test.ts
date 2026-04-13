import { beforeEach, describe, expect, it } from 'bun:test'

import { useUiStore, selectFreeRoomEnabled, selectToggleFreeRoomEnabled } from './ui-store'

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

describe('ui-store — freeRoomEnabled', () => {
  beforeEach(() => {
    useUiStore.setState({ freeRoomEnabled: false })
  })

  it('freeRoomEnabled defaults to false', () => {
    expect(useUiStore.getState().freeRoomEnabled).toBe(false)
  })

  it('toggleFreeRoomEnabled flips false → true', () => {
    useUiStore.getState().toggleFreeRoomEnabled()
    expect(useUiStore.getState().freeRoomEnabled).toBe(true)
  })

  it('toggleFreeRoomEnabled flips true → false', () => {
    useUiStore.setState({ freeRoomEnabled: true })
    useUiStore.getState().toggleFreeRoomEnabled()
    expect(useUiStore.getState().freeRoomEnabled).toBe(false)
  })

  it('selectFreeRoomEnabled reads the flag', () => {
    useUiStore.setState({ freeRoomEnabled: true })
    expect(selectFreeRoomEnabled(useUiStore.getState())).toBe(true)
  })

  it('selectToggleFreeRoomEnabled returns the action', () => {
    const action = selectToggleFreeRoomEnabled(useUiStore.getState())
    action()
    expect(useUiStore.getState().freeRoomEnabled).toBe(true)
  })
})
