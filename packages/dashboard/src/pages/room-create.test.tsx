import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { ToastProvider } from '~/components/ui/toast-provider'
import { RoomCreatePage } from '~/pages/room-create'

function renderRoomCreatePage() {
  const router = createMemoryRouter(
    [
      {
        path: '/rooms/new',
        element: createElement(ToastProvider, null, createElement(RoomCreatePage)),
      },
    ],
    { initialEntries: ['/rooms/new'] },
  )

  return renderToStaticMarkup(createElement(RouterProvider, { router }))
}

describe('RoomCreatePage', () => {
  it('renders the real room configuration form', () => {
    const html = renderRoomCreatePage()

    expect(html).toContain('Set up a translation room')
    expect(html).toContain('Room Configuration')
    expect(html).toContain('Original Room ID')
    expect(html).toContain('Destination Room Name')
    expect(html).toContain('AI Provider')
    expect(html).toContain('AI Model')
    expect(html).toContain('Translation Style')
    expect(html).toContain('AI API Token')
    expect(html).toContain('Create Room')
    expect(html).toContain('Cancel')
    expect(html).toContain('Open Webhook Guide')
  })

  it('wires form submission through react-hook-form, zod, store, and navigation', async () => {
    const source = await Bun.file(new URL('./room-create.tsx', import.meta.url)).text()

    expect(source).toContain('useForm<RoomCreateInput>')
    expect(source).toContain('const roomCreateResolver = zodResolver(roomCreateSchema as never)')
    expect(source).toContain('const addRoom = useRoomStore')
    expect(source).toContain("toast('Room created successfully!')")
    expect(source).toContain('navigate(`/rooms/${newId}`)')
  })
})
