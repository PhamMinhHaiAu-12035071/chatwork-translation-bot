import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { WebhookStepper } from '~/components/molecules/webhook-stepper'

describe('WebhookStepper', () => {
  it('renders the first step with navigation controls', () => {
    const html = renderToStaticMarkup(
      createElement(WebhookStepper, {
        webhookUrl: 'https://example.com/webhook?room_id=123',
      }),
    )

    expect(html).toContain('Access Chatwork Admin')
    expect(html).toContain('Open Chatwork Admin')
    expect(html).toContain('1 of 6')
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
})
