import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  PixelScatterText,
  getPixelScatterDescriptor,
  splitPixelScatterText,
} from '~/components/ui/pixel-scatter-text'

describe('PixelScatterText', () => {
  it('splits labels into stable characters while preserving spaces', () => {
    expect(splitPixelScatterText('A B')).toEqual(['A', ' ', 'B'])
  })

  it('uses deterministic scatter descriptors for outgoing and incoming characters', () => {
    expect(getPixelScatterDescriptor(0, 4)).toEqual({
      exitX: -18,
      exitY: -18,
      exitRotate: -14,
      enterX: 7,
      enterY: 13,
      enterRotate: 7,
      delayMs: 0,
    })

    expect(getPixelScatterDescriptor(2, 4)).toEqual({
      exitX: -2,
      exitY: -14,
      exitRotate: 5,
      enterX: -2,
      enterY: 10,
      enterRotate: -2,
      delayMs: 36,
    })
  })

  it('renders the current label plus a hidden reserve footprint for stable layout', () => {
    const html = renderToStaticMarkup(
      createElement(PixelScatterText, {
        value: 'Live',
        reserveText: 'Paused',
      }),
    )

    expect(html).toContain('data-motion="pixel-scatter"')
    expect(html).toContain('aria-label="Live"')
    expect(html).toContain('Paused')
  })
})
