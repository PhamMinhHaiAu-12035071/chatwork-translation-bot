import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { RoomCreatePage } from '~/pages/room-create'
import { RoomDetailPage } from '~/pages/room-detail'
import { RoomListPage } from '~/pages/room-list'
import { WebhookGuidePage } from '~/pages/webhook-guide'

describe('phase 2 dashboard shells', () => {
  it('renders the redesigned room dashboard copy', () => {
    const html = renderToStaticMarkup(createElement(RoomListPage))

    expect(html).toContain('Phase 2 Preview')
    expect(html).toContain('Room Dashboard')
    expect(html).toContain('Create your first translation room')
  })

  it('applies the matcha milk backdrop with brighter candy accents', async () => {
    const html = renderToStaticMarkup(createElement(RoomListPage))
    const css = await Bun.file(new URL('./styles/global.css', import.meta.url)).text()

    expect(html).toContain('theme-card-matcha')
    expect(html).toContain('theme-card-cream')
    expect(html).toContain('theme-card-sky')
    expect(html).toContain('theme-card-mint')
    expect(html).toContain('theme-button-violet')
    expect(html).toContain('theme-button-warm')
    expect(html).toContain('Gamma Team')
    expect(html).toContain('Setup')

    expect(css).toContain('--bg-gradient-start: #f6f7e9;')
    expect(css).toContain('--bg-gradient-end: #fff1dc;')
    expect(css).toContain('--organic-circle-1: #dde9be;')
    expect(css).toContain('--organic-circle-2: #f3d5b1;')
    expect(css).toContain('--organic-circle-3: #e7e0c9;')
    expect(css).toContain('linear-gradient(180deg, #79a766 0%, #5c8b52 100%)')
    expect(css).toContain('linear-gradient(180deg, #8c93f5 0%, #6e77e5 100%)')
    expect(css).toContain('linear-gradient(180deg, #f07ca6 0%, #d44470 100%)')
    expect(css).toContain('linear-gradient(180deg, #ff9a72 0%, #f27a54 100%)')
    expect(css).toContain('linear-gradient(180deg, #8ed2f7 0%, #61b7e8 100%)')
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

  it('uses white text on saturated actions, improves room-status contrast, and gives the sidebar nav more breathing room', async () => {
    const html = renderToStaticMarkup(createElement(RoomListPage))
    const layoutSource = await Bun.file(new URL('./layouts/app-layout.tsx', import.meta.url)).text()
    const css = await Bun.file(new URL('./styles/global.css', import.meta.url)).text()
    const brutalButtonBlock = /\.brutal-button\s*\{[^}]+\}/.exec(css)?.[0]

    expect(html).toContain(
      'theme-button-violet px-5 py-3 font-heading text-sm font-bold text-white',
    )
    expect(html).toContain('theme-button-warm px-5 py-3 font-heading text-sm font-bold text-white')
    expect(html).toContain('theme-button-sky text-[var(--border)]')
    expect(html).toContain('theme-button-gold text-[var(--border)]')
    expect(html).toContain('theme-button-pink text-[#fff7ed]')
    expect(brutalButtonBlock).toBeDefined()
    expect(brutalButtonBlock).not.toContain('color:')
    expect(brutalButtonBlock).toContain('cursor: pointer;')
    expect(layoutSource).toContain('<nav className="space-y-5">')
    expect(layoutSource).toContain('<NavLink key={item.to} to={item.to} className="block">')
  })

  it('keeps top chrome stickers and sidebar nav straight while distributing controlled chaos across supporting UI', async () => {
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
    expect(layoutSource).toContain('animate={{ x: isActive ? -2 : 0, y: isActive ? -2 : 0 }}')
    expect(layoutSource).toContain('whileHover={{ x: -2, y: -2 }}')
    expect(layoutSource).not.toContain('rotate: item.tilt')
    expect(layoutSource).not.toContain('tilt: -0.9')
    expect(layoutSource).not.toContain('tilt: 0.9')
    expect(roomListSource).toContain("tilt={index === 0 ? 'left' : index === 2 ? 'right' : 'flat'}")
    expect(createSource).toContain(
      '<BrutalCard className="theme-card-matcha space-y-3" tilt="left">',
    )
    expect(createSource).toContain(
      '<BrutalCard className="theme-card-lilac space-y-3" tilt="right">',
    )
    expect(detailSource).toContain('<BrutalCard className="theme-card-sky space-y-4" tilt="left">')
    expect(detailSource).toContain(
      '<BrutalCard className="theme-card-peach space-y-4" tilt="right">',
    )
  })

  it('renders the redesigned room creation shell copy', () => {
    const html = renderToStaticMarkup(createElement(RoomCreatePage))

    expect(html).toContain('Create Flow Preview')
    expect(html).toContain('Set up a new translation room')
    expect(html).toContain('Phase 3 Enables Real Inputs')
  })

  it('renders the redesigned room detail shell for a route param', () => {
    const router = createMemoryRouter(
      [{ path: '/rooms/:id', element: createElement(RoomDetailPage) }],
      { initialEntries: ['/rooms/demo-room'] },
    )

    const html = renderToStaticMarkup(createElement(RouterProvider, { router }))

    expect(html).toContain('Activation Preview')
    expect(html).toContain('demo-room')
    expect(html).toContain('Create - Activate')
  })

  it('renders six webhook guide steps', () => {
    const html = renderToStaticMarkup(createElement(WebhookGuidePage))

    expect(html).toContain('Manual Guide')
    expect(html).toContain('Webhook Setup Guide')
    expect(html.match(/Step 0[1-6]/g)?.length).toBe(6)
  })
})
