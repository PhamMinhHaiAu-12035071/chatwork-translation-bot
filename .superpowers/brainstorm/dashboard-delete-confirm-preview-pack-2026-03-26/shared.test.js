const { describe, expect, test } = require('bun:test')

const {
  ROOM_DATA,
  VARIANT_CONFIG,
  createPreviewController,
} = require('./shared.js')

describe('delete confirm preview config', () => {
  test('defines shared room data and ten variants', () => {
    expect(ROOM_DATA.name).toBe('Northline Ops')
    expect(Object.keys(VARIANT_CONFIG)).toHaveLength(10)
    expect(VARIANT_CONFIG['safety-slider'].family).toBe('lever')
    expect(VARIANT_CONFIG['warning-dial'].family).toBe('dial')
  })
})

describe('createPreviewController', () => {
  test('opens, progresses, confirms, and resets a stepper variant', () => {
    const controller = createPreviewController('safety-slider')

    expect(controller.getState().isOpen).toBe(false)

    controller.openModal()
    controller.advance()
    controller.advance()
    controller.advance()

    expect(controller.getState()).toMatchObject({
      isOpen: false,
      isDeleted: true,
      progress: 100,
    })

    controller.reset()

    expect(controller.getState()).toMatchObject({
      isOpen: false,
      isDeleted: false,
      progress: 0,
    })
  })

  test('requires both locks before releasing the dual lock lever', () => {
    const controller = createPreviewController('dual-lock-lever')

    controller.openModal()
    controller.advance('release')
    expect(controller.getState().isDeleted).toBe(false)

    controller.advance('cancel')
    controller.advance('release')
    expect(controller.getState().isDeleted).toBe(false)

    controller.advance('delete')
    controller.advance('release')

    expect(controller.getState()).toMatchObject({
      isDeleted: true,
      isOpen: false,
      progress: 100,
    })
  })

  test('supports hold-to-confirm progress', () => {
    const controller = createPreviewController('hold-to-melt')

    controller.openModal()
    controller.beginHold()
    controller.advanceHold()
    controller.advanceHold()
    controller.advanceHold()
    controller.advanceHold()

    expect(controller.getState()).toMatchObject({
      isDeleted: true,
      isOpen: false,
      progress: 100,
      isHolding: false,
    })
  })
})
