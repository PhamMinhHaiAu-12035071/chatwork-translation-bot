import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { ToastProvider } from '~/components/ui/toast-provider'
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

  it('renders the live room detail surface for a seeded room', () => {
    const html = renderRoomDetailPage('/rooms/room-001')

    expect(html).toContain('Edit room configuration or complete webhook activation to go live.')
    expect(html).toContain('Sakura Desk JP')
    expect(html).toContain('Room Config')
    expect(html).toContain('Webhook URL')
    expect(html).toContain('View Webhook Guide')
    expect(html).toContain('Save Changes')
    expect(html).toContain('Activate Webhook')
  })

  it('renders a not-found state for an unknown room id', () => {
    const html = renderRoomDetailPage('/rooms/missing-room')

    expect(html).toContain('Room not found')
    expect(html).toContain('Back to Dashboard')
  })

  it('keeps separate edit and activation flows in the source', async () => {
    const source = await Bun.file(new URL('./room-detail.tsx', import.meta.url)).text()

    expect(source).toContain('useForm<RoomEditInput>')
    expect(source).toContain('useForm<WebhookActivationInput>')
    expect(source).toContain('activateWebhook')
    expect(source).toContain('generateWebhookUrl')
    expect(source).toContain('onEditSubmit')
    expect(source).toContain('onActivateSubmit')
    expect(source).toContain('getRoomUpdatedToastMessage')
    expect(source).toContain('data.destinationRoomName')
    expect(source).not.toContain("toast('Room updated successfully!')")
    expect(source).toContain("'info'")
  })

  it('applies the approved pixel-scatter text treatment to the detail status surfaces', async () => {
    const source = await Bun.file(new URL('./room-detail.tsx', import.meta.url)).text()

    expect(source).toContain('PixelScatterText')
    expect(source).toContain('reserveText="Inactive"')
    expect(source).toContain('reserveText="Webhook Activation"')
  })
})
