import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ContextField } from '~/components/molecules/context-field'

function render(props: { value?: string; onChange?: (v: string) => void; error?: string }) {
  const handleChange =
    props.onChange ??
    ((v: string) => {
      // noop
      void v
    })
  const propsToPass: { value: string; onChange: (v: string) => void; error?: string } = {
    value: props.value ?? '',
    onChange: handleChange,
  }
  if (props.error !== undefined) {
    propsToPass.error = props.error
  }
  return renderToStaticMarkup(createElement(ContextField, propsToPass))
}

describe('ContextField', () => {
  it('renders the trigger button with Translation Context label', () => {
    const html = render({})
    expect(html).toContain('Translation Context')
  })

  it('renders Optional badge on the trigger', () => {
    const html = render({})
    expect(html).toContain('Optional')
  })

  it('renders all 5 template names when panel is expanded (value pre-filled triggers open)', () => {
    // When a value is present, the component renders in open state so templates are visible
    const html = render({ value: 'some context' })
    expect(html).toContain('Client Project')
    expect(html).toContain('Internal Team')
    expect(html).toContain('Tech Dev Room')
    expect(html).toContain('Cross-team Meeting')
    expect(html).toContain('Executive / Board')
  })

  it('renders character counter showing current length / 500', () => {
    const html = render({ value: 'hello world' })
    expect(html).toContain('11')
    expect(html).toContain('500')
  })

  it('renders error message when error prop provided', () => {
    const html = render({ value: 'a'.repeat(501), error: 'Max 500 characters' })
    expect(html).toContain('Max 500 characters')
  })

  it('does not render error when no error prop', () => {
    const html = render({ value: 'ok' })
    expect(html).not.toContain('Max 500 characters')
  })

  it('renders the context note about system prompt', () => {
    const html = render({ value: 'some context' })
    expect(html).toContain('system prompt')
  })
})
