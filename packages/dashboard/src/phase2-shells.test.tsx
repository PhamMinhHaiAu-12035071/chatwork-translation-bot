import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { ToastProvider } from '~/components/ui/toast-provider'
import { RoomCreatePage } from '~/pages/room-create'
import { RoomDetailPage } from '~/pages/room-detail'
import { RoomListPage } from '~/pages/room-list'
import { WebhookGuidePage } from '~/pages/webhook-guide'

function renderWithRoute(path: string, routePath: string, element: ReactElement) {
  const router = createMemoryRouter(
    [
      {
        path: routePath,
        element: createElement(ToastProvider, null, element),
      },
    ],
    { initialEntries: [path] },
  )

  return renderToStaticMarkup(createElement(RouterProvider, { router }))
}

describe('dashboard visual shells', () => {
  it('renders the live room dashboard shell before client hydration', () => {
    const html = renderWithRoute('/', '/', createElement(RoomListPage))

    expect(html).toContain('Translation Rooms')
    expect(html).toContain('+ New Room')
    expect(html).toContain('Webhook Guide')
    expect(html).toContain('theme-card-cream')
  })

  it('keeps the matcha milk backdrop with brighter candy accents after wiring live data', async () => {
    const html = renderWithRoute('/', '/', createElement(RoomListPage))
    const css = await Bun.file(new URL('./styles/global.css', import.meta.url)).text()
    const dashboardHtml = await Bun.file(new URL('../index.html', import.meta.url)).text()

    expect(html).toContain('theme-card-mint')
    expect(html).toContain('theme-card-butter')
    expect(html).toContain(
      'theme-button-violet px-5 py-3 font-heading text-sm font-bold text-white',
    )
    expect(html).toContain('theme-button-warm px-5 py-3 font-heading text-sm font-bold text-white')
    expect(css).toContain('--bg-gradient-start: #f6f7e9;')
    expect(css).toContain('--bg-gradient-end: #fff1dc;')
    expect(css).toContain('--organic-circle-1: #dde9be;')
    expect(css).toContain('--organic-circle-2: #f3d5b1;')
    expect(css).toContain('--organic-circle-3: #e7e0c9;')
    expect(dashboardHtml).toContain('family=Shantell+Sans')
    expect(dashboardHtml).toContain('family=Fredoka')
    expect(dashboardHtml).toContain('family=Zen+Maru+Gothic')
    expect(css).toContain("font-family: 'Zen Maru Gothic', sans-serif;")
    expect(css).toContain('linear-gradient(180deg, #79a766 0%, #5c8b52 100%)')
    expect(css).toContain('linear-gradient(180deg, #8c93f5 0%, #6e77e5 100%)')
    expect(css).toContain('linear-gradient(180deg, #f07ca6 0%, #d44470 100%)')
    expect(css).toContain('linear-gradient(180deg, #ff9a72 0%, #f27a54 100%)')
    expect(css).toContain('linear-gradient(180deg, #8ed2f7 0%, #61b7e8 100%)')
  })

  it('formalizes distinct display, metric, and body typography roles', async () => {
    const css = await Bun.file(new URL('./styles/global.css', import.meta.url)).text()

    expect(css).toContain('.font-heading {')
    expect(css).toContain("font-family: 'Shantell Sans', cursive;")
    expect(css).toContain('.font-metric {')
    expect(css).toContain("font-family: 'Fredoka', cursive;")
    expect(css).toContain('.font-ui-body {')
    expect(css).toContain("font-family: 'Zen Maru Gothic', sans-serif;")
  })

  it('uses a peach-milk candy scrollbar that harmonizes with the warm page chrome', async () => {
    const css = await Bun.file(new URL('./styles/global.css', import.meta.url)).text()
    const pageScrollbarTrack = /html::-webkit-scrollbar-track\s*\{[^}]+\}/.exec(css)?.[0]
    const pageScrollbarThumb = /html::-webkit-scrollbar-thumb\s*\{[^}]+\}/.exec(css)?.[0]

    expect(css).toContain('@keyframes candy-scroll')
    expect(css).toContain('html::-webkit-scrollbar { width: 18px; }')
    expect(pageScrollbarTrack).toBeDefined()
    expect(pageScrollbarTrack).toContain('background: #f7e7d3;')
    expect(pageScrollbarTrack).toContain('border: 3px solid var(--border);')
    expect(pageScrollbarThumb).toBeDefined()
    expect(pageScrollbarThumb).toContain('repeating-linear-gradient(')
    expect(pageScrollbarThumb).toContain('#f4b38b 0px')
    expect(pageScrollbarThumb).toContain('#fff7ed 8px')
    expect(pageScrollbarThumb).toContain('background-size: 22px 22px;')
    expect(pageScrollbarThumb).toContain('animation: candy-scroll 0.6s linear infinite;')
    expect(css).toContain('scrollbar-color: #f4b38b #f7e7d3;')
    expect(css).toContain('scrollbar-width: thin;')
  })

  it('keeps top chrome stickers and sidebar nav straight while live pages use controlled tilt', async () => {
    const roomListSource = await Bun.file(new URL('./pages/room-list.tsx', import.meta.url)).text()
    const createSource = await Bun.file(new URL('./pages/room-create.tsx', import.meta.url)).text()
    const detailSource = await Bun.file(new URL('./pages/room-detail.tsx', import.meta.url)).text()
    const layoutSource = await Bun.file(new URL('./layouts/app-layout.tsx', import.meta.url)).text()
    const pageShellSource = await Bun.file(
      new URL('./components/ui/page-shell.tsx', import.meta.url),
    ).text()
    const brutalCardSource = await Bun.file(
      new URL('./components/ui/brutal-card.tsx', import.meta.url),
    ).text()
    const stickerSource = await Bun.file(
      new URL('./components/ui/sticker-label.tsx', import.meta.url),
    ).text()

    expect(stickerSource).toContain("tilt?: 'left' | 'right' | 'flat'")
    expect(brutalCardSource).toContain("tilt?: 'left' | 'right' | 'flat'")
    expect(pageShellSource).toContain('<StickerLabel tone="warning" tilt="flat">')
    expect(pageShellSource).toContain('{eyebrow}')
    expect(layoutSource).toContain('<StickerLabel tone="accent" tilt="flat">')
    expect(layoutSource).toContain('Multi-Room Setup')
    expect(layoutSource).toContain('layoutId="nav-indicator"')
    expect(layoutSource).toContain('shadow-[5px_5px_0_var(--accent)]')
    expect(layoutSource).toContain('whileHover={{ x: -2, y: -2 }}')
    expect(layoutSource).not.toContain('rotate: item.tilt')
    expect(layoutSource).not.toContain('tilt: -0.9')
    expect(layoutSource).not.toContain('tilt: 0.9')
    expect(roomListSource).toContain(
      "const tiltByIndex = ['left', 'flat', 'right', 'left', 'flat', 'right'] as const",
    )
    expect(createSource).toContain(
      '<BrutalCard className="theme-card-matcha space-y-3" tilt="left">',
    )
    expect(createSource).toContain(
      '<BrutalCard className="theme-card-lilac space-y-3" tilt="right">',
    )
    expect(detailSource).toContain('<BrutalCard className="theme-card-sky space-y-5" tilt="left">')
    expect(detailSource).toContain(
      '<BrutalCard className="theme-card-peach space-y-4" tilt="right">',
    )
  })

  it('renders the live room creation form copy', () => {
    const html = renderWithRoute('/rooms/new', '/rooms/new', createElement(RoomCreatePage))

    expect(html).toContain('New Room')
    expect(html).toContain('Set up a translation room')
    expect(html).toContain('Room Configuration')
    expect(html).toContain('Create Room')
  })

  it('renders the live room detail loading shell for a route param', () => {
    const html = renderWithRoute('/rooms/room-001', '/rooms/:id', createElement(RoomDetailPage))

    expect(html).toContain('Room Detail')
    expect(html).toContain('Loading…')
    expect(html).toContain('theme-card-cream')
  })

  it('renders six webhook guide steps', () => {
    const html = renderToStaticMarkup(createElement(WebhookGuidePage))

    expect(html).toContain('Manual Guide')
    expect(html).toContain('Webhook Setup Guide')
    expect(html).toContain('Step 01')
    expect(html).toContain('Access Chatwork Admin')
    expect(html.match(/>0[1-6]</g)?.length).toBe(6)
  })
})
