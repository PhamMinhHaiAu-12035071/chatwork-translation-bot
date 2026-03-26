import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { ToastProvider } from '~/components/organisms/toast-provider'
import { RoomDetailPage, getRoomUpdatedToastMessage } from '~/pages/room-detail'

function renderRoomDetailPage(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/rooms/:id',
        element: createElement(ToastProvider, null, createElement(RoomDetailPage)),
      },
    ],
    { initialEntries: [path] },
  )

  return renderToStaticMarkup(createElement(RouterProvider, { router }))
}

describe('RoomDetailPage', () => {
  it('builds update success toasts with the room name', () => {
    expect(getRoomUpdatedToastMessage('Sakura Desk JP')).toBe(
      '"Sakura Desk JP" was updated successfully',
    )
  })

  it('renders a loading shell before the room payload is fetched', () => {
    const html = renderRoomDetailPage('/rooms/room-001')

    expect(html).toContain('Loading…')
    expect(html).toContain('Room Detail')
    expect(html).toContain('theme-card-cream')
  })

  it('replaces activation flow with fetch + enable/disable wiring in the source', async () => {
    const source = await Bun.file(new URL('./room-detail.tsx', import.meta.url)).text()

    expect(source).toContain('useForm<RoomEditInput>')
    expect(source).toContain('fetchRooms')
    expect(source).toContain('enableRoom')
    expect(source).toContain('disableRoom')
    expect(source).toContain('RoomSkeletonCard')
    expect(source).toContain('ApiError')
    expect(source).toContain("register('webhookSecret')")
    expect(source).toContain('generateWebhookUrl')
    expect(source).toContain('onEditSubmit')
    expect(source).toContain('getRoomUpdatedToastMessage')
    expect(source).toContain('data.destinationRoomName')
    expect(source).toContain("data.webhookSecret !== ''")
    expect(source).toContain('Room Status')
    expect(source).toContain('Disable Room')
    expect(source).toContain('Room not found')
    expect(source).toContain('View Webhook Guide')
    expect(source).not.toContain("toast('Room updated successfully!')")
    expect(source).not.toContain('WebhookActivationInput')
    expect(source).not.toContain('webhookActivationSchema')
    expect(source).not.toContain('activateWebhook')
    expect(source).not.toContain('room.webhookToken')
    expect(source).toContain("'info'")
    expect(source).toContain("'error'")
  })

  it('applies the approved pixel-scatter text treatment to the detail status surfaces', async () => {
    const source = await Bun.file(new URL('./room-detail.tsx', import.meta.url)).text()

    expect(source).toContain('PixelScatterText')
    expect(source).toContain('reserveText="Inactive"')
    expect(source).toContain('reserveText="Disable Room"')
  })
})
