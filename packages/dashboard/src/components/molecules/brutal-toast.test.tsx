import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BrutalToast } from '~/components/molecules/brutal-toast'

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
    expect(html).toContain('bg-[var(--card-matcha)]')
  })

  it('renders the info variant styling', () => {
    const html = renderToStaticMarkup(
      createElement(BrutalToast, {
        item: {
          id: 'toast-2',
          message: 'Room updated',
          variant: 'info',
        },
        onDismiss: () => undefined,
      }),
    )

    expect(html).toContain('Room updated')
    expect(html).toContain('bg-[var(--card-sky)]')
    expect(html).toContain('bg-[#93c5fd]')
  })

  it('renders the warning variant styling', () => {
    const html = renderToStaticMarkup(
      createElement(BrutalToast, {
        item: {
          id: 'toast-3',
          message: 'Room deleted',
          variant: 'warning',
        },
        onDismiss: () => undefined,
      }),
    )

    expect(html).toContain('Room deleted')
    expect(html).toContain('bg-[var(--card-cream)]')
    expect(html).toContain('bg-[#fbbf24]')
  })

  it('renders the error variant styling', () => {
    const html = renderToStaticMarkup(
      createElement(BrutalToast, {
        item: {
          id: 'toast-4',
          message: 'Webhook activation failed',
          variant: 'error',
        },
        onDismiss: () => undefined,
      }),
    )

    expect(html).toContain('Webhook activation failed')
    expect(html).toContain('bg-[#ff6f9f]')
  })

  it('maps each variant to a distinct icon badge', async () => {
    const source = await Bun.file(new URL('./brutal-toast.tsx', import.meta.url)).text()

    expect(source).toContain("icon: '✓'")
    expect(source).toContain("icon: 'i'")
    expect(source).toContain("icon: '!'")
    expect(source).toContain("icon: '✕'")
  })
})
