import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ToastProvider, useToast } from '~/components/ui/toast-provider'

function ToastProbe() {
  const { toast } = useToast()

  return createElement('button', {
    type: 'button',
    onClick: () => {
      toast('Saved')
    },
  })
}

describe('ToastProvider', () => {
  it('renders children inside the provider', () => {
    const html = renderToStaticMarkup(
      createElement(ToastProvider, null, createElement('div', null, 'toast-child')),
    )

    expect(html).toContain('toast-child')
  })

  it('throws when useToast is called outside the provider', () => {
    expect(() => renderToStaticMarkup(createElement(ToastProbe))).toThrow(
      'useToast must be used inside <ToastProvider>',
    )
  })
})
