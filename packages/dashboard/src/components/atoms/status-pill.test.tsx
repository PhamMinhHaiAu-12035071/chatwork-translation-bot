import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { StatusPill } from '~/components/atoms/status-pill'

describe('StatusPill', () => {
  it('forwards custom layout classes so parents can keep header footprints stable', () => {
    const html = renderToStaticMarkup(
      createElement(StatusPill, {
        className: 'min-w-24 justify-center shrink-0',
        children: 'Paused',
      }),
    )

    expect(html).toContain('min-w-24')
    expect(html).toContain('justify-center')
    expect(html).toContain('shrink-0')
  })

  it('accepts animated child nodes instead of only plain strings', () => {
    const html = renderToStaticMarkup(
      createElement(StatusPill, {
        children: createElement('span', { 'data-motion': 'pixel-scatter' }, 'Paused'),
      }),
    )

    expect(html).toContain('data-motion="pixel-scatter"')
    expect(html).toContain('Paused')
  })

  it('uses the display voice so status labels stay in the dashboard signature style', () => {
    const html = renderToStaticMarkup(
      createElement(StatusPill, {
        children: 'Live',
      }),
    )

    expect(html).toContain('font-heading')
  })
})
