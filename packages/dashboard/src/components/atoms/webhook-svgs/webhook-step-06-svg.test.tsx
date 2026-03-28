import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { WebhookStep06Svg } from './webhook-step-06-svg'

describe('WebhookStep06Svg', () => {
  it('renders without error and contains an accessible label', () => {
    const html = renderToStaticMarkup(createElement(WebhookStep06Svg))
    expect(html).toContain('aria-label')
    expect(html).toContain('Room ID')
  })
})
