import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { ToastProvider } from '~/components/organisms/toast-provider'
import { RoomDetailPage, getRoomUpdatedToastMessage } from '~/pages/room-detail'

const removedWebhookActivationSchema = ['webhook', 'Activation', 'Schema'].join('')
const removedActivateWebhookSymbol = ['activate', 'Webhook'].join('')
const removedRoomWebhookTokenProperty = `room.${['webhook', 'Token'].join('')}`

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
    expect(source).toContain('selectRoomById(id)')
    expect(source).toContain('selectFetchRooms')
    expect(source).toContain('selectUpdateRoom')
    expect(source).toContain('selectEnableRoom')
    expect(source).toContain('selectDisableRoom')
    expect(source).not.toContain('useRoomStore((state) => state.')
    expect(source).toContain('useCopyClipboard')
    expect(source).toContain('useAsyncAction<Room>')
    expect(source).toContain('RoomSkeletonCard')
    expect(source).toContain('ApiError')
    expect(source).toContain('generateWebhookUrl')
    expect(source).toContain('onEditSubmit')
    expect(source).toContain('handleRoomStatusToggle')
    expect(source).toContain('getRoomUpdatedToastMessage')
    expect(source).toContain('data.destinationRoomName')
    expect(source).toContain('Room Status')
    expect(source).toContain('Disable Room')
    expect(source).toContain('Room not found')
    expect(source).toContain('View Webhook Guide')
    expect(source).not.toContain("toast('Room updated successfully!')")
    expect(source).not.toContain('WebhookActivationInput')
    expect(source).not.toContain(removedWebhookActivationSchema)
    expect(source).not.toContain(removedActivateWebhookSymbol)
    expect(source).not.toContain(removedRoomWebhookTokenProperty)
    expect(source).toContain('toast(result.error,')
    expect(source).toContain("'info'")
    expect(source).toContain("'error'")
    expect(source).toMatch(
      /navigate\(\s*['"`]\/['"`]\s*,[\s\S]*state:\s*\{[\s\S]*spotlightRoomId:\s*result\.data\.id[\s\S]*\}\s*\)/,
    )
  })

  it('applies the approved pixel-scatter text treatment to the detail status surfaces', async () => {
    const source = await Bun.file(new URL('./room-detail.tsx', import.meta.url)).text()

    expect(source).toContain('PixelScatterText')
    expect(source).toContain('reserveText="Inactive"')
    expect(source).toContain('reserveText="Disable Room"')
  })

  it('does not render the room UUID badge next to Room Config', async () => {
    const source = await Bun.file(new URL('./room-detail.tsx', import.meta.url)).text()

    expect(source).not.toContain('<span className="opacity-60">#</span>')
  })

  it('includes the ContextField component in the form source code', async () => {
    const source = await Bun.file(new URL('./room-detail.tsx', import.meta.url)).text()

    expect(source).toContain('ContextField')
    expect(source).toContain("editForm.watch('context')")
  })
})
