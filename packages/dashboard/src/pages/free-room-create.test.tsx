import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { ToastProvider } from '~/components/organisms/toast-provider'
import { FreeRoomCreatePage } from '~/pages/free-room-create'
import { toastMessages } from '~/lib/toast-messages'

function renderFreeRoomCreatePage() {
  const router = createMemoryRouter(
    [
      {
        path: '/free-rooms/new',
        element: createElement(ToastProvider, null, createElement(FreeRoomCreatePage)),
      },
    ],
    { initialEntries: ['/free-rooms/new'] },
  )

  return renderToStaticMarkup(createElement(RouterProvider, { router }))
}

describe('FreeRoomCreatePage', () => {
  it('builds create success toasts with the room name', () => {
    expect(toastMessages.roomCreated('Sakura Desk JP Free')).toBe(
      '"Sakura Desk JP Free" was created successfully',
    )
  })

  it('renders the free room configuration form without API token fields', () => {
    const html = renderFreeRoomCreatePage()

    expect(html).toContain('Set up a free translation room')
    expect(html).toContain('Original Room ID')
    expect(html).toContain('Original Room Name')
    expect(html).toContain('Destination Room Name')
    expect(html).toContain('Provider')
    expect(html).toContain('Translation Style')
    expect(html).toContain('Casual Vietnamese, suitable for friends or peers')
    expect(html).toContain('Create Room')
    expect(html).toContain('Cancel')
    expect(html).toContain('Open Webhook Guide')
    expect(html).toContain('Before You Start')
    expect(html).not.toContain('AI API Token')
    expect(html).not.toContain('AI Model')
  })

  it('wires the form through the free-room store and keeps provider fixed to free', async () => {
    const source = await Bun.file(new URL('./free-room-create.tsx', import.meta.url)).text()

    expect(source).toContain('useForm<FreeRoomCreateInput>')
    expect(source).toContain('const freeRoomCreateResolver = zodResolver(')
    expect(source).toContain('freeRoomCreateSchema as never')
    expect(source).toContain('selectCreateFreeRoom')
    expect(source).toContain('useAsyncAction<FreeRoom>')
    expect(source).toContain('disabled')
    expect(source).toContain('Translate Free')
    expect(source).toContain('ContextField')
    expect(source).toContain('maxLength={100}')
    expect(source).toContain('This context helps guide the translation output.')
    expect(source).toContain('getFreeRoomKagiStyleDescription')
    expect(source).toContain('KeywordProtectionField')
    expect(source).not.toContain('AI API Token')
    expect(source).toMatch(
      /navigate\(\s*['"`]\/free-rooms['"`]\s*,[\s\S]*state:\s*\{[\s\S]*spotlightRoomId:\s*result\.data\.id[\s\S]*\}\s*\)/,
    )
  })

  it('registers router paths and sidebar entries for free room navigation', async () => {
    const routerSource = await Bun.file(new URL('../router.tsx', import.meta.url)).text()
    const layoutSource = await Bun.file(
      new URL('../layouts/app-layout.tsx', import.meta.url),
    ).text()

    expect(routerSource).toContain("'/free-rooms'")
    expect(routerSource).toContain("'/free-rooms/new'")
    expect(routerSource).toContain("'/free-rooms/:id'")
    expect(layoutSource).toContain('Free Rooms')
    expect(layoutSource).toContain('New Free Room')
  })
})
