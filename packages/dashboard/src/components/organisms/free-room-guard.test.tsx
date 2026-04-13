import { beforeEach, describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { useUiStore } from '~/stores/ui-store'
import { FreeRoomGuard } from '~/components/organisms/free-room-guard'

describe('FreeRoomGuard', () => {
  beforeEach(() => {
    useUiStore.setState({ freeRoomEnabled: false })
  })

  it('renders null (empty string) when freeRoomEnabled is false', () => {
    useUiStore.setState({ freeRoomEnabled: false })
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(FreeRoomGuard, null, createElement('div', null, 'protected content')),
      ),
    )
    expect(html).toBe('')
  })

  it('renders children when freeRoomEnabled is true', () => {
    useUiStore.setState({ freeRoomEnabled: true })
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(FreeRoomGuard, null, createElement('div', null, 'protected content')),
      ),
    )
    expect(html).toContain('protected content')
  })

  it('calls navigate on the client when disabled (source check)', async () => {
    const source = await Bun.file(new URL('./free-room-guard.tsx', import.meta.url)).text()
    expect(source).toContain('navigate')
    expect(source).toContain('replace: true')
  })
})
