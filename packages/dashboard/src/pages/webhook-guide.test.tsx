import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { WebhookGuidePage } from '~/pages/webhook-guide'

describe('WebhookGuidePage', () => {
  it('renders the interactive stepper shell and supporting rationale cards', () => {
    const html = renderToStaticMarkup(createElement(WebhookGuidePage))

    expect(html).toContain('Webhook Setup Guide')
    expect(html).toContain('Step-by-Step')
    expect(html).toContain('Access Chatwork Admin')
    expect(html).toContain('Open Chatwork Admin')
    expect(html).toContain('Why manual?')
    expect(html).toContain('One-time setup')
    expect(html).toContain('Next')
  })

  it('uses the WebhookStepper component instead of the old static steps array', async () => {
    const source = await Bun.file(new URL('./webhook-guide.tsx', import.meta.url)).text()

    expect(source).toContain("import { WebhookStepper } from '~/components/ui/webhook-stepper'")
    expect(source).toContain('<WebhookStepper />')
    expect(source).not.toContain('const steps = [')
  })
})
