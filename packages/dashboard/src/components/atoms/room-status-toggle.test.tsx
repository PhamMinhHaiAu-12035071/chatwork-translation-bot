import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RoomStatusToggle } from '~/components/atoms/room-status-toggle'

const noop = () => undefined

describe('RoomStatusToggle', () => {
  it('renders tog-track-on and tog-thumb-on when enabled', () => {
    const html = renderToStaticMarkup(
      createElement(RoomStatusToggle, { enabled: true, loading: false, onToggle: noop }),
    )
    expect(html).toContain('tog-track-on')
    expect(html).toContain('tog-thumb-on')
  })

  it('does not render tog-track-on or tog-thumb-on when not enabled', () => {
    const html = renderToStaticMarkup(
      createElement(RoomStatusToggle, { enabled: false, loading: false, onToggle: noop }),
    )
    expect(html).not.toContain('tog-track-on')
    expect(html).not.toContain('tog-thumb-on')
  })

  it('sets aria-checked="true" when enabled', () => {
    const html = renderToStaticMarkup(
      createElement(RoomStatusToggle, { enabled: true, loading: false, onToggle: noop }),
    )
    expect(html).toContain('aria-checked="true"')
  })

  it('sets aria-checked="false" when not enabled', () => {
    const html = renderToStaticMarkup(
      createElement(RoomStatusToggle, { enabled: false, loading: false, onToggle: noop }),
    )
    expect(html).toContain('aria-checked="false"')
  })

  it('renders as disabled with opacity-50 and aria-disabled when loading', () => {
    const html = renderToStaticMarkup(
      createElement(RoomStatusToggle, { enabled: false, loading: true, onToggle: noop }),
    )
    expect(html).toContain('disabled')
    expect(html).toContain('opacity-50')
    expect(html).toContain('aria-disabled="true"')
  })

  it('wires onToggle to the button click and uses role="switch"', async () => {
    const source = await Bun.file(new URL('./room-status-toggle.tsx', import.meta.url)).text()
    expect(source).toContain('onClick={onToggle}')
    expect(source).toContain('disabled={loading}')
    expect(source).toContain('role="switch"')
  })
})
