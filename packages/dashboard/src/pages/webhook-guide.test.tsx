import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { WebhookGuidePage } from '~/pages/webhook-guide'

describe('WebhookGuidePage', () => {
  it('renders the interactive stepper shell and supporting rationale cards', () => {
    const router = createMemoryRouter([
      {
        path: '/',
        element: createElement(WebhookGuidePage),
      },
    ])

    const html = renderToStaticMarkup(createElement(RouterProvider, { router }))

    expect(html).toContain('Webhook Setup Guide')
    expect(html).toContain('Step-by-Step')
    expect(html).toContain('Access Chatwork Admin')
    expect(html).toContain('Open Chatwork Admin')
    expect(html).toContain('Why manual?')
    expect(html).toContain('Tip')
    expect(html).toContain('Room ID is the number after #/rid')
    expect(html).toContain('Next')
  })

  it('uses the WebhookStepper component instead of the old static steps array', async () => {
    const source = await Bun.file(new URL('./webhook-guide.tsx', import.meta.url)).text()

    expect(source).toContain(
      "import { WebhookStepper } from '~/components/molecules/webhook-stepper'",
    )
    expect(source).toContain('<WebhookStepper webhookUrl={webhookUrl} />')
    expect(source).not.toContain('const steps = [')
  })

  it('keeps the supporting rationale cards aligned with the simplified webhook setup flow', async () => {
    const source = await Bun.file(new URL('./webhook-guide.tsx', import.meta.url)).text()

    expect(source).toContain('Room ID is the number after #/rid')
    expect(source).toContain('Why manual?')
    expect(source).toContain('Tip')
    expect(source).not.toContain('webhook token')
    expect(source).not.toContain('Activation section')
  })
})
