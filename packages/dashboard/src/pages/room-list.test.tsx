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
    const roomIdOccurrences = html.match(/Room ID:/g) ?? []

    expect(html).toContain('Translation Rooms')
    expect(html).toContain('Total Rooms')
    expect(html).toContain('Awaiting Webhook')
    expect(html).toContain('Sakura Desk JP')
    expect(html).toContain('Gamma Team EN')
    expect(html).toContain('Kyoto Finance Hub')
    expect(html).toContain('Nagoya CX Lab')
    expect(html).toContain('OpenAI')
    expect(html).toContain('Technical')
    expect(html).toContain('+ New Room')
    expect(html).toContain('Webhook Guide')
    expect(html).toContain('Edit')
    expect(html).toContain('Pause')
    expect(html).toContain('Enable')
    expect(html).toContain('Delete')
    expect(roomIdOccurrences).toHaveLength(12)
  })

  it('keeps room toggle/delete logic in the source', async () => {
    const source = await Bun.file(new URL('./room-list.tsx', import.meta.url)).text()

    expect(source).toContain('toggleRoom')
    expect(source).toContain('deleteRoom')
    expect(source).toContain('DeleteRoomConfirmModal')
    expect(source).toContain('selectedRoom')
    expect(source).toContain('setSelectedRoom')
    expect(source).not.toContain('window.confirm')
    expect(source).toContain("toast(currentlyEnabled ? 'Room disabled' : 'Room enabled')")
  })

  it('keeps a stable room-card header footprint when the status label changes', async () => {
    const source = await Bun.file(new URL('./room-list.tsx', import.meta.url)).text()

    expect(source).toContain('flex-1 min-w-0')
    expect(source).toContain('min-w-24 justify-center shrink-0')
  })

  it('wires the approved runtime motion primitives into the dashboard list surface', async () => {
    const source = await Bun.file(new URL('./room-list.tsx', import.meta.url)).text()

    expect(source).toContain('PixelScatterText')
    expect(source).toContain('SlideStackNumber')
    expect(source).toContain('reserveText="Paused"')
    expect(source).toContain('reserveText="Enable"')
    expect(source).toContain('minimumDigits={2}')
  })

  it('applies the Combo A typography roles to metrics, titles, and room metadata', async () => {
    const source = await Bun.file(new URL('./room-list.tsx', import.meta.url)).text()

    expect(source).toContain('className="font-metric"')
    expect(source).toContain('font-heading text-lg font-bold leading-tight')
    expect(source).toContain('font-ui-body text-xs text-[var(--text-secondary)]')
    expect(source).toContain('font-ui-body space-y-1.5 text-xs text-[var(--text-secondary)]')
  })
})
