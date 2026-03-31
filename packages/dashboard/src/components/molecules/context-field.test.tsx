import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ContextField } from '~/components/molecules/context-field'
import { CONTEXT_TEMPLATES } from '~/lib/context-templates'

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
  it('animates the chevron icon with spring rotation on open/close', async () => {
    const source = await Bun.file(new URL('./context-field.tsx', import.meta.url)).text()

    expect(source).toContain('animate={{ rotate: isOpen ? 180 : 0 }}')
    expect(source).toContain("type: 'spring', stiffness: 520, damping: 34, mass: 0.55")
  })

  it('keeps the candy progress meter fully static', async () => {
    const css = await Bun.file(new URL('../../styles/global.css', import.meta.url)).text()

    expect(css).not.toContain('transition: clip-path 180ms ease;')
    expect(css).not.toContain('animation: candy-scroll 0.75s linear infinite;')
  })

  it('uses an ordered progress palette from red through yellow to green', async () => {
    const source = await Bun.file(new URL('./context-field.tsx', import.meta.url)).text()
    const orderedColors = ['#e63946', '#f77f00', '#fcbf49', '#90be6d', '#43aa8b']
    const indexes = orderedColors.map((color) => source.indexOf(color))

    expect(indexes.every((index) => index >= 0)).toBe(true)
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b))
  })

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

  it('renders an active template state when the current value matches a quick template body', () => {
    const html = render({ value: CONTEXT_TEMPLATES[0]?.body ?? '' })

    expect(html).toContain('data-template-active="true"')
    expect(html).not.toContain('Selected')
  })

  it('renders character counter showing current length / 500', () => {
    const html = render({ value: 'hello world' })
    expect(html).toContain('11')
    expect(html).toContain('500')
  })

  it('keeps the character counter footprint fixed so the progress bar does not reflow', async () => {
    const source = await Bun.file(new URL('./context-field.tsx', import.meta.url)).text()

    expect(source).toContain('w-[5.75rem]')
    expect(source).toContain('shrink-0')
    expect(source).toContain('tabular-nums')
    expect(source).toContain('text-right')
  })

  it('renders a candy-segment progress meter for the character count', () => {
    const html = render({ value: 'hello world' })

    expect(html).toContain('role="progressbar"')
    expect(html).toContain('context-candy-progress-track')
    expect(html).toContain('data-candy-layer="ghost"')
    expect(html).toContain('data-candy-layer="filled"')
  })

  it('uses simplified active template indication', async () => {
    const source = await Bun.file(new URL('./context-field.tsx', import.meta.url)).text()

    expect(source).toContain('context-template-check')
    expect(source).toContain('data-template-active')
    expect(source).not.toContain('context-template-comet-burst')
    expect(source).not.toContain('context-editor-candy-rail')
  })

  it('renders repeated candy segments inside both meter layers', () => {
    const html = render({ value: 'hello world' })
    const matches = html.match(/context-candy-progress-segment/g) ?? []

    expect(matches).toHaveLength(10)
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
