import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { StatusRibbon } from '~/components/atoms/status-ribbon'

describe('StatusRibbon', () => {
  it('renders "Live" when enabled', () => {
    const html = renderToStaticMarkup(createElement(StatusRibbon, { enabled: true }))
    expect(html).toContain('Live')
  })

  it('renders "Paused" when not enabled', () => {
    const html = renderToStaticMarkup(createElement(StatusRibbon, { enabled: false }))
    expect(html).toContain('Paused')
  })

  it('applies ribbon-live class and not ribbon-paused when enabled', () => {
    const html = renderToStaticMarkup(createElement(StatusRibbon, { enabled: true }))
    expect(html).toContain('ribbon-live')
    expect(html).not.toContain('ribbon-paused')
  })

  it('applies ribbon-paused class and not ribbon-live when not enabled', () => {
    const html = renderToStaticMarkup(createElement(StatusRibbon, { enabled: false }))
    expect(html).toContain('ribbon-paused')
    expect(html).not.toContain('ribbon-live')
  })

  it('is aria-hidden so the toggle carries the semantic meaning', () => {
    const html = renderToStaticMarkup(createElement(StatusRibbon, { enabled: true }))
    expect(html).toContain('aria-hidden="true"')
  })

  it('forwards optional className onto the wrapper', () => {
    const html = renderToStaticMarkup(
      createElement(StatusRibbon, { enabled: true, className: 'custom-cls' }),
    )
    expect(html).toContain('custom-cls')
  })
})
