import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BrutalSelect } from '~/components/ui/brutal-select'

describe('BrutalSelect', () => {
  it('renders the label, placeholder, and options', () => {
    const html = renderToStaticMarkup(
      createElement(BrutalSelect, {
        label: 'AI Provider',
        placeholder: 'Choose a provider',
        options: [
          { value: 'openai', label: 'OpenAI' },
          { value: 'gemini', label: 'Google Gemini' },
        ],
      }),
    )

    expect(html).toContain('AI Provider')
    expect(html).toContain('Choose a provider')
    expect(html).toContain('value="openai"')
    expect(html).toContain('Google Gemini')
  })

  it('renders the error state for invalid selections', () => {
    const html = renderToStaticMarkup(
      createElement(BrutalSelect, {
        label: 'Translation Style',
        options: [{ value: 'AUTO_CONTEXT', label: 'Auto Context' }],
        error: 'Translation style is required',
      }),
    )

    expect(html).toContain('Translation style is required')
    expect(html).toContain('shadow-[3px_3px_0_var(--error)]')
  })
})
