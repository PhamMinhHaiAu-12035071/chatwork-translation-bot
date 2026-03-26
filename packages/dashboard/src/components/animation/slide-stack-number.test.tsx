import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  SlideStackNumber,
  getSlideStackDirection,
  getSlideStackFootprint,
  getSlideStackMotionState,
} from '~/components/animation/slide-stack-number'

describe('SlideStackNumber', () => {
  it('derives forward motion for increments and reverse motion for decrements', () => {
    expect(getSlideStackDirection(7, 8)).toBe(1)
    expect(getSlideStackDirection(8, 7)).toBe(-1)
    expect(getSlideStackDirection(8, 8)).toBe(0)
  })

  it('keeps a tabular footprint using minimum digit padding', () => {
    expect(getSlideStackFootprint(7, 2)).toBe('00')
    expect(getSlideStackFootprint(12, 2)).toBe('00')
    expect(getSlideStackFootprint(120, 2)).toBe('000')
  })

  it('derives wheel-style motion metadata for forward and reverse travel', () => {
    expect(getSlideStackMotionState(1)).toEqual({
      enterY: '118%',
      exitY: '-118%',
      enterRotateX: -72,
      exitRotateX: 72,
      enterScale: 0.82,
      exitScale: 0.82,
    })

    expect(getSlideStackMotionState(-1)).toEqual({
      enterY: '-118%',
      exitY: '118%',
      enterRotateX: 72,
      exitRotateX: -72,
      enterScale: 0.82,
      exitScale: 0.82,
    })
  })

  it('renders a wheel viewport with a soft edge mask around the current value', () => {
    const html = renderToStaticMarkup(
      createElement(SlideStackNumber, {
        value: 12,
        minimumDigits: 2,
      }),
    )

    expect(html).toContain('data-motion="slide-stack"')
    expect(html).toContain('data-direction="0"')
    expect(html).toContain('data-wheel-viewport="true"')
    expect(html).toContain('data-wheel-mask="soft"')
    expect(html).toContain('12')
  })
})
