import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BrutalToast } from '~/components/ui/brutal-toast'

describe('BrutalToast', () => {
  it('renders the success variant message and dismiss button', () => {
    const html = renderToStaticMarkup(
      createElement(BrutalToast, {
        item: {
          id: 'toast-1',
          message: 'Room enabled',
          variant: 'success',
        },
        onDismiss: () => undefined,
      }),
    )

    expect(html).toContain('Room enabled')
    expect(html).toContain('Dismiss')
    expect(html).toContain('bg-[var(--success)]')
  })

  it('renders the error variant styling', () => {
    const html = renderToStaticMarkup(
      createElement(BrutalToast, {
        item: {
          id: 'toast-2',
          message: 'Webhook activation failed',
          variant: 'error',
        },
        onDismiss: () => undefined,
      }),
    )

    expect(html).toContain('Webhook activation failed')
    expect(html).toContain('text-[var(--error)]')
  })
})
