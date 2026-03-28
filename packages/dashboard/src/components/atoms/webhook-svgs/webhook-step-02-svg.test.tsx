import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { WebhookStep02Svg } from './webhook-step-02-svg'

describe('WebhookStep02Svg', () => {
  it('renders an svg element', () => {
    const html = renderToStaticMarkup(createElement(WebhookStep02Svg, null))
    expect(html).toContain('<svg')
  })

  it('has role img and a non-empty aria-label', () => {
    const html = renderToStaticMarkup(createElement(WebhookStep02Svg, null))
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="')
  })
})
