import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { WebhookStep01Svg } from './webhook-step-01-svg'

describe('WebhookStep01Svg', () => {
  it('renders an svg element', () => {
    const html = renderToStaticMarkup(createElement(WebhookStep01Svg, null))
    expect(html).toContain('<svg')
  })

  it('has role img and a non-empty aria-label', () => {
    const html = renderToStaticMarkup(createElement(WebhookStep01Svg, null))
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="')
  })
})
