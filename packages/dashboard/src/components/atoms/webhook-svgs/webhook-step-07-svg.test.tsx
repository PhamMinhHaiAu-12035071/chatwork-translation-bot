import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { WebhookStep07Svg } from './webhook-step-07-svg'

describe('WebhookStep07Svg', () => {
  it('renders without error and contains an accessible label', () => {
    const html = renderToStaticMarkup(createElement(WebhookStep07Svg))
    expect(html).toContain('aria-label')
    expect(html).toContain('Room ID')
  })
})
