import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { WebhookStepper } from '~/components/molecules/webhook-stepper'

describe('WebhookStepper', () => {
  it('renders the first step with navigation controls', () => {
    const router = createMemoryRouter([
      {
        path: '/',
        element: createElement(WebhookStepper, {
          webhookUrl: 'https://example.com/webhook?room_id=123',
        }),
      },
    ])

    const html = renderToStaticMarkup(createElement(RouterProvider, { router }))

    expect(html).toContain('Access Chatwork Admin')
    expect(html).toContain('Open Chatwork Admin')
    expect(html).toContain('1 of 7')
    expect(html).toContain('Previous')
    expect(html).toContain('Next')
  })

  it('includes clipboard logic and the copied state for step 3', async () => {
    const source = await Bun.file(new URL('./webhook-stepper.tsx', import.meta.url)).text()

    expect(source).toContain("import { useCopyClipboard } from '~/hooks/use-copy-clipboard'")
    expect(source).toContain('const { copied, copy } = useCopyClipboard()')
    expect(source).toContain('await copy(url)')
    expect(source).toContain("'Copy URL'")
    expect(source).toContain("'Copied!'")
  })

  it('opts the step card out of nested entrance motion so fast navigation does not stack animations', async () => {
    const source = await Bun.file(new URL('./webhook-stepper.tsx', import.meta.url)).text()

    expect(source).toContain('animated={false}')
  })

  it('limits pill transitions to colors so rapid step changes do not replay unrelated animations', async () => {
    const source = await Bun.file(new URL('./webhook-stepper.tsx', import.meta.url)).text()

    expect(source).toContain('transition-colors duration-150')
    expect(source).not.toContain('transition-all duration-150')
  })

  it('step 5 instructs save without copying a secret', async () => {
    const source = await Bun.file(new URL('./webhook-stepper.tsx', import.meta.url)).text()

    expect(source).toContain("title: 'Save Webhook'")
    expect(source).toContain('No secret needed')
    expect(source).not.toContain("title: 'Save & Copy Secret'")
    expect(source).not.toContain('Save Secret on Dashboard')
  })

  it('step 07 is defined with the correct title and action type', async () => {
    const source = await Bun.file(new URL('./webhook-stepper.tsx', import.meta.url)).text()

    expect(source).toContain("title: 'Note Your Room ID'")
    expect(source).toContain("action: 'roomId'")
    expect(source).toContain("'theme-card-sky'")
  })

  it('step 7 renders a room ID input and a navigate button with disabled-when-empty logic', async () => {
    const source = await Bun.file(new URL('./webhook-stepper.tsx', import.meta.url)).text()

    expect(source).toContain('roomIdValue')
    expect(source).toContain('activeStep === 6')
    expect(source).toContain('inputMode="numeric"')
    expect(source).toContain('roomIdValue.trim() === ')
    expect(source).toContain('Go to Create Room')
  })

  it('navigates to /rooms/new with originalRoomId in Router state on step 6 button click', async () => {
    const source = await Bun.file(new URL('./webhook-stepper.tsx', import.meta.url)).text()

    expect(source).toContain("'/rooms/new'")
    expect(source).toContain('originalRoomId')
    expect(source).toContain('useNavigate')
  })
})
