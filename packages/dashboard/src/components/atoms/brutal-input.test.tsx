import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BrutalInput } from '~/components/atoms/brutal-input'

describe('BrutalInput', () => {
  it('renders the label, hint, and input type for normal fields', () => {
    const html = renderToStaticMarkup(
      createElement(BrutalInput, {
        label: 'AI API Token',
        hint: 'Stored in memory only.',
        type: 'password',
      }),
    )

    expect(html).toContain('AI API Token')
    expect(html).toContain('Stored in memory only.')
    expect(html).toContain('type="password"')
    expect(html).toContain('brutal-input')
    expect(html).toContain('font-ui-body')
  })

  it('switches to the error treatment when an error message is provided', () => {
    const html = renderToStaticMarkup(
      createElement(BrutalInput, {
        label: 'Original Room ID',
        error: 'Room ID is required',
      }),
    )

    expect(html).toContain('Room ID is required')
    expect(html).toContain('brutal-input-error')
    expect(html).not.toContain('text-[var(--text-secondary)]">Room ID is required')
  })
})
