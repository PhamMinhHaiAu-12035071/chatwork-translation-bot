import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { ToastProvider } from '~/components/organisms/toast-provider'
import { RoomCreatePage, getRoomCreatedToastMessage } from '~/pages/room-create'

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
  it('builds create success toasts with the room name', () => {
    expect(getRoomCreatedToastMessage('Sakura Desk JP')).toBe(
      '"Sakura Desk JP" was created successfully',
    )
  })

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
    expect(html).toContain('Before You Start')
    expect(html).not.toContain('paste the token into the dashboard to go live')
  })

  it('wires form submission through react-hook-form, api store actions, and conflict handling', async () => {
    const source = await Bun.file(new URL('./room-create.tsx', import.meta.url)).text()

    expect(source).toContain('useForm<RoomCreateInput>')
    expect(source).toContain('const roomCreateResolver = zodResolver(roomCreateSchema as never)')
    expect(source).toContain('selectCreateRoom')
    expect(source).not.toContain('useRoomStore((state) => state.')
    expect(source).toContain('useAsyncAction<Room>')
    expect(source).toContain('setError')
    expect(source).toContain('ApiError')
    expect(source).toContain('result.cause instanceof ApiError')
    expect(source).toContain('result.cause.status === 409')
    expect(source).toContain('getRoomCreatedToastMessage')
    expect(source).toContain('data.destinationRoomName')
    expect(source).toContain('toast(result.error,')
    expect(source).toContain("'error'")
    expect(source).not.toContain("toast('Room created successfully!')")
    expect(source).not.toContain('addRoom')
    expect(source).toMatch(
      /navigate\(\s*['"`]\/['"`]\s*,[\s\S]*state:\s*\{[\s\S]*spotlightRoomId:\s*result\.data\.id[\s\S]*\}\s*\)/,
    )
    expect(source).not.toContain('navigate(`/rooms/${result.data.id}`)')
  })

  it('pre-fills originalRoomId when Router location state contains originalRoomId', async () => {
    const source = await Bun.file(new URL('./room-create.tsx', import.meta.url)).text()

    expect(source).toContain('useLocation')
    expect(source).toContain(
      'const prefillRoomId = (location.state as { originalRoomId?: string } | null)?.originalRoomId',
    )
    expect(source).toContain(
      'prefillRoomId !== undefined ? { originalRoomId: Number(prefillRoomId) } : {}',
    )
  })

  it('leaves originalRoomId empty when Router location state is absent', () => {
    const html = renderRoomCreatePage()
    // the field must not contain a pre-filled number when arriving without state
    expect(html).not.toContain('424846369')
  })

  it('renders the Translation Context collapsible section', () => {
    const html = renderRoomCreatePage()
    expect(html).toContain('Translation Context')
    expect(html).toContain('Optional')
  })
})
