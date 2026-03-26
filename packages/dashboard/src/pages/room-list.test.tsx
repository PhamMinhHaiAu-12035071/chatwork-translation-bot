import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { ToastProvider } from '~/components/ui/toast-provider'
import { RoomListPage } from '~/pages/room-list'

function renderRoomListPage() {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: createElement(ToastProvider, null, createElement(RoomListPage)),
      },
    ],
    { initialEntries: ['/'] },
  )

  return renderToStaticMarkup(createElement(RouterProvider, { router }))
}

describe('RoomListPage', () => {
  it('renders seeded room data and live dashboard actions', () => {
    const html = renderRoomListPage()

    expect(html).toContain('Translation Rooms')
    expect(html).toContain('Total Rooms')
    expect(html).toContain('Awaiting Webhook')
    expect(html).toContain('Sakura Desk JP')
    expect(html).toContain('Gamma Team EN')
    expect(html).toContain('OpenAI')
    expect(html).toContain('Technical')
    expect(html).toContain('+ New Room')
    expect(html).toContain('Webhook Guide')
    expect(html).toContain('Edit')
    expect(html).toContain('Pause')
    expect(html).toContain('Enable')
    expect(html).toContain('Delete')
  })

  it('keeps room toggle/delete logic in the source', async () => {
    const source = await Bun.file(new URL('./room-list.tsx', import.meta.url)).text()

    expect(source).toContain('toggleRoom')
    expect(source).toContain('deleteRoom')
    expect(source).toContain('window.confirm')
    expect(source).toContain("toast(currentlyEnabled ? 'Room disabled' : 'Room enabled')")
  })
})
