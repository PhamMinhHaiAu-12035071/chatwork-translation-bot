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
    expect(html).toContain('bg-[var(--success)]')
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
    expect(html).toContain('bg-[#ede9fe]')
    expect(html).toContain('text-[#5b4fc4]')
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
    expect(html).toContain('bg-[#fef3cd]')
    expect(html).toContain('text-[#856404]')
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
    expect(html).toContain('text-[var(--error)]')
  })

  it('maps each variant to a distinct icon badge', async () => {
    const source = await Bun.file(new URL('./brutal-toast.tsx', import.meta.url)).text()

    expect(source).toContain("success: 'OK'")
    expect(source).toContain("info: 'i'")
    expect(source).toContain("warning: '!'")
    expect(source).toContain("error: 'X'")
  })
})
