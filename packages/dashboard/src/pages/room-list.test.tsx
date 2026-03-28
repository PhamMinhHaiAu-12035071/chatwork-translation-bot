import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { ToastProvider } from '~/components/organisms/toast-provider'
import {
  RoomListPage,
  getDeleteRoomToastMessage,
  getRoomToggleToastMessage,
} from '~/pages/room-list'

const removedToggleRoomSymbol = ['toggle', 'Room'].join('')
const removedWebhookTokenSymbol = ['webhook', 'Token'].join('')

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

  it('builds delete toasts with different messages for deleted and already-deleted outcomes', () => {
    expect(getDeleteRoomToastMessage('Sakura Desk JP', 'deleted')).toBe(
      'Room "Sakura Desk JP" deleted from Chatwork and dashboard',
    )
    expect(getDeleteRoomToastMessage('Sakura Desk JP', 'already_deleted')).toBe(
      'Room "Sakura Desk JP" was already gone on Chatwork. Dashboard cleanup is complete',
    )
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
    expect(source).toContain('useAsyncAction<DeleteRoomResult>')
    expect(source).toContain('RoomSkeletonList')
    expect(source).toContain('ApiError')
    expect(source).toContain('DeleteRoomConfirmModal')
    expect(source).toContain('selectedRoom')
    expect(source).toContain('setSelectedRoom')
    expect(source).toContain('deleteRoomAction.loading')
    expect(source).not.toContain('window.confirm')
    expect(source).not.toContain(removedToggleRoomSymbol)
    expect(source).not.toContain(removedWebhookTokenSymbol)
    expect(source).toContain('getRoomToggleToastMessage')
    expect(source).toContain('getDeleteRoomToastMessage')
    expect(source).toContain('room.destinationRoomName')
    expect(source).toContain('result.data.outcome')
    expect(source).toContain('toast(result.error,')
    expect(source).toContain('Retry')
    expect(source).toContain("'info'")
    expect(source).toContain("'warning'")
    expect(source).toContain("'error'")
  })

  it('uses StatusRibbon and RoomStatusToggle in the card header, not StatusPill', async () => {
    const source = await Bun.file(new URL('./room-list.tsx', import.meta.url)).text()

    expect(source).toContain('StatusRibbon')
    expect(source).toContain('RoomStatusToggle')
    expect(source).toContain('roomToggleAction.loading')
    expect(source).not.toContain('min-w-24 justify-center shrink-0')
  })

  it('keeps SlideStackNumber for stat metrics and removes PixelScatterText from room cards', async () => {
    const source = await Bun.file(new URL('./room-list.tsx', import.meta.url)).text()

    expect(source).toContain('SlideStackNumber')
    expect(source).toContain('minimumDigits={2}')
    expect(source).not.toContain('reserveText="Paused"')
    expect(source).not.toContain('reserveText="Enable"')
  })

  it('applies the Combo A typography roles to metrics, titles, and room metadata', async () => {
    const source = await Bun.file(new URL('./room-list.tsx', import.meta.url)).text()

    expect(source).toContain('className="font-metric"')
    expect(source).toContain('font-heading text-lg font-bold leading-tight')
    expect(source).toContain('font-ui-body text-xs text-[var(--text-secondary)]')
    expect(source).toContain('font-ui-body space-y-1.5 text-xs text-[var(--text-secondary)]')
  })

  it('tracks a transient spotlight for the newly created room and clears it after the timer', async () => {
    const source = await Bun.file(new URL('./room-list.tsx', import.meta.url)).text()

    expect(source).toMatch(/room\.id\s*===\s*spotlightRoomId/)
    expect(source).toContain('setSpotlightRoomId(routeState.spotlightRoomId)')
    expect(source).toMatch(/spotlightRoomId[\s\S]*setTimeout[\s\S]*clearTimeout/)
    expect(source).toContain('setSpotlightRoomId(null)')
    expect(source).toContain('replace: true')
    expect(source).toContain('<StickerLabel tone="warning" tilt="right">')
    expect(source).toContain('New')
    expect(source).toContain('backgroundColor')
    expect(source).toContain('boxShadow')
  })
})
