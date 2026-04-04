import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { ToastProvider } from '~/components/organisms/toast-provider'
import { FreeRoomDetailPage } from '~/pages/free-room-detail'
import { toastMessages } from '~/lib/toast-messages'

function renderFreeRoomDetailPage(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/free-rooms/:id',
        element: createElement(ToastProvider, null, createElement(FreeRoomDetailPage)),
      },
    ],
    { initialEntries: [path] },
  )

  return renderToStaticMarkup(createElement(RouterProvider, { router }))
}

describe('FreeRoomDetailPage', () => {
  it('builds update success toasts with the room name', () => {
    expect(toastMessages.roomUpdated('Sakura Desk JP Free')).toBe(
      '"Sakura Desk JP Free" was updated successfully',
    )
  })

  it('renders a loading shell before the free room payload is fetched', () => {
    const html = renderFreeRoomDetailPage('/free-rooms/free-room-001')

    expect(html).toContain('Loading…')
    expect(html).toContain('Free Room Detail')
    expect(html).toContain('theme-card-cream')
  })

  it('reuses the shared context and keyword sections with free-room store actions', async () => {
    const source = await Bun.file(new URL('./free-room-detail.tsx', import.meta.url)).text()

    expect(source).toContain('useForm<FreeRoomEditInput>')
    expect(source).toContain('selectFetchFreeRooms')
    expect(source).toContain('selectUpdateFreeRoom')
    expect(source).toContain('selectEnableFreeRoom')
    expect(source).toContain('selectDisableFreeRoom')
    expect(source).toContain('useAsyncAction<FreeRoom>')
    expect(source).toContain('RoomSkeletonCard')
    expect(source).toContain('ContextField')
    expect(source).toContain('maxLength={100}')
    expect(source).toContain('This context helps guide the translation output.')
    expect(source).toContain("const selectedKagiStyle = editForm.watch('kagiStyle')")
    expect(source).toContain('getFreeRoomKagiStyleDescription')
    expect(source).toContain('KeywordProtectionField')
    expect(source).toContain('Translation Style')
    expect(source).toContain('Translate Free')
    expect(source).toContain('Room Status')
    expect(source).toContain('useFreeRoomStore.setState')
    expect(source).not.toContain('AI API Token')
    expect(source).toMatch(
      /navigate\(\s*['"`]\/free-rooms['"`]\s*,[\s\S]*state:\s*\{[\s\S]*spotlightRoomId:\s*result\.data\.id[\s\S]*\}\s*\)/,
    )
  })

  it('displays originalRoomName as read-only in edit form', async () => {
    const source = await Bun.file(new URL('./free-room-detail.tsx', import.meta.url)).text()

    expect(source).toContain('Original Room Name')
    expect(source).toContain("...editForm.register('originalRoomName')")
    expect(source).toContain('Cannot be changed after creation.')

    const readOnlyPattern = /label="Original Room Name"[\s\S]*?readOnly/
    expect(source).toMatch(readOnlyPattern)
  })
})
