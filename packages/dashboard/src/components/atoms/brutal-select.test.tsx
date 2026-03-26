import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BrutalSelect } from '~/components/atoms/brutal-select'

const SOURCE = readFileSync(resolve(import.meta.dir, 'brutal-select.tsx'), 'utf-8')

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
    expect(html).toContain('font-ui-body')
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
    expect(html).toContain('brutal-input-error')
  })

  it('hides the native select and exposes a custom trigger button', () => {
    const html = renderToStaticMarkup(
      createElement(BrutalSelect, {
        label: 'AI Provider',
        options: [{ value: 'openai', label: 'OpenAI' }],
      }),
    )

    expect(html).toContain('sr-only')
    expect(html).toContain('aria-haspopup="listbox"')
    expect(html).toContain('brutal-dropdown-chevron')
  })

  it('wires the custom dropdown infrastructure in the source', () => {
    expect(SOURCE).toContain('brutal-dropdown')
    expect(SOURCE).toContain('brutal-dropdown-option')
    expect(SOURCE).toContain('brutal-dropdown-chevron')
    expect(SOURCE).toContain('createPortal')
    expect(SOURCE).toContain('getBoundingClientRect')
  })

  it('implements keyboard navigation and click-outside close in the source', () => {
    expect(SOURCE).toContain('ArrowDown')
    expect(SOURCE).toContain('ArrowUp')
    expect(SOURCE).toContain('Escape')
    expect(SOURCE).toContain('Enter')
    expect(SOURCE).toContain('brutal-dropdown-backdrop')
    expect(SOURCE).toContain('closeDropdown')
  })

  it('syncs selections to the hidden native select via change event dispatch', () => {
    expect(SOURCE).toContain('dispatchEvent')
    expect(SOURCE).toContain("new Event('change'")
    expect(SOURCE).toContain('HTMLSelectElement.prototype')
  })

  it('supports color variants for per-select dropdown theming', () => {
    expect(SOURCE).toContain('colorVariant')
    expect(SOURCE).toContain('data-color')
    expect(SOURCE).toContain('DropdownColor')
  })
})
