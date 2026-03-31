import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { ToastProvider } from '~/components/organisms/toast-provider'
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
    expect(html).toContain('New Room')
    expect(html).toContain('Webhook Guide')
    expect(html).toContain('theme-card-cream')
  })

  it('keeps the matcha milk backdrop with brighter candy accents after wiring live data', async () => {
    const html = renderWithRoute('/', '/', createElement(RoomListPage))
    const css = await Bun.file(new URL('./styles/global.css', import.meta.url)).text()
    const dashboardHtml = await Bun.file(new URL('../index.html', import.meta.url)).text()
    const brutalSurfaceRule = /\.brutal-surface\s*\{[^}]+\}/.exec(css)?.[0]

    expect(html).toContain('theme-card-mint')
    expect(html).toContain('theme-card-butter')
    expect(css).toContain('--bg-gradient-start: #fffdf5;')
    expect(css).toContain('--bg-gradient-end: #fff7e8;')
    expect(css).toContain('--organic-circle-1: #d9f0c9;')
    expect(css).toContain('--organic-circle-2: #fde7b7;')
    expect(css).toContain('--organic-circle-3: #e5f0d8;')
    expect(dashboardHtml).toContain('family=Shantell+Sans')
    expect(dashboardHtml).toContain('family=Fredoka')
    expect(dashboardHtml).toContain('family=Zen+Maru+Gothic')
    expect(css).toContain("font-family: 'Zen Maru Gothic', sans-serif;")
    expect(css).toContain('--card-glass: rgba(255, 255, 255, 0.78);')
    expect(css).toContain('--card-matcha: rgba(233, 250, 218, 0.92);')
    expect(css).toContain('--card-cream: rgba(255, 245, 220, 0.92);')
    expect(css).toContain('--card-lilac: rgba(228, 219, 255, 0.92);')
    expect(css).toContain('--card-blush: rgba(255, 230, 242, 0.92);')
    expect(css).toContain('--card-sky: rgba(213, 240, 255, 0.9);')
    expect(css).toContain('--card-mint: rgba(110, 231, 183, 0.9);')
    expect(css).toContain('--card-butter: rgba(253, 230, 138, 0.9);')
    expect(css).toContain('--card-peach: rgba(255, 228, 196, 0.92);')
    expect(css).toContain(
      '--surface-clay-shine: inset 0 3px 10px rgba(255, 255, 255, 0.42), inset 0 -4px 10px rgba(255, 183, 120, 0.16);',
    )
    expect(brutalSurfaceRule).toBeDefined()
    expect(brutalSurfaceRule).toContain('background: var(--card-glass);')
    expect(brutalSurfaceRule).toContain('var(--surface-clay-shine)')
    expect(html).toContain('theme-button-violet')
    expect(html).toContain('theme-button-warm')
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
      new URL('./components/layout/page-shell.tsx', import.meta.url),
    ).text()
    const brutalCardSource = await Bun.file(
      new URL('./components/molecules/brutal-card.tsx', import.meta.url),
    ).text()
    const stickerSource = await Bun.file(
      new URL('./components/atoms/sticker-label.tsx', import.meta.url),
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

  it('renders five webhook guide steps', () => {
    const router = createMemoryRouter([
      {
        path: '/',
        element: createElement(WebhookGuidePage),
      },
    ])

    const html = renderToStaticMarkup(createElement(RouterProvider, { router }))

    expect(html).toContain('Manual Guide')
    expect(html).toContain('Webhook Setup Guide')
    expect(html).toContain('Step 01')
    expect(html).toContain('Access Chatwork Admin')
    expect(html.match(/>0[1-6]</g)?.length).toBe(6)
  })
})
