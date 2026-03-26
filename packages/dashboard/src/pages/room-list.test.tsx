import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { ToastProvider } from '~/components/organisms/toast-provider'
import { RoomListPage, getRoomToggleToastMessage } from '~/pages/room-list'

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
  it('builds toggle toasts with the room name and resulting status', () => {
    expect(getRoomToggleToastMessage('Sakura Desk JP', false)).toBe(
      '"Sakura Desk JP" is now enabled',
    )
    expect(getRoomToggleToastMessage('Sakura Desk JP', true)).toBe('"Sakura Desk JP" is now paused')
  })

  it('renders the dashboard shell, stats, and loading placeholders before hydration', () => {
    const html = renderRoomListPage()

    expect(html).toContain('Translation Rooms')
    expect(html).toContain('Total Rooms')
    expect(html).toContain('Inactive')
    expect(html).toContain('+ New Room')
    expect(html).toContain('Webhook Guide')
    expect(html).toContain('theme-card-cream')
    expect(html).toContain('bg-[var(--card-glass)]')
  })

  it('wires fetch, loading, error, enable/disable, delete, and retry logic in the source', async () => {
    const source = await Bun.file(new URL('./room-list.tsx', import.meta.url)).text()

    expect(source).toContain('fetchRooms')
    expect(source).toContain('enableRoom')
    expect(source).toContain('disableRoom')
    expect(source).toContain('deleteRoom')
    expect(source).toContain('selectRooms')
    expect(source).toContain('selectFetchRooms')
    expect(source).toContain('selectEnableRoom')
    expect(source).toContain('selectDisableRoom')
    expect(source).toContain('selectDeleteRoom')
    expect(source).not.toContain('useRoomStore((state) => state.')
    expect(source).toContain('useAsyncAction<undefined>')
    expect(source).toContain('RoomSkeletonList')
    expect(source).toContain('ApiError')
    expect(source).toContain('DeleteRoomConfirmModal')
    expect(source).toContain('selectedRoom')
    expect(source).toContain('setSelectedRoom')
    expect(source).toContain('deleteRoomAction.loading')
    expect(source).not.toContain('window.confirm')
    expect(source).not.toContain('toggleRoom')
    expect(source).not.toContain('webhookToken')
    expect(source).toContain('getRoomToggleToastMessage')
    expect(source).toContain('room.destinationRoomName')
    expect(source).toContain('toast(result.error,')
    expect(source).toContain('Retry')
    expect(source).toContain("'info'")
    expect(source).toContain("'warning'")
    expect(source).toContain("'error'")
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
