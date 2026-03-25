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

  it('applies the hydrangea multicolor treatment instead of a mostly monochrome shell', async () => {
    const html = renderToStaticMarkup(createElement(RoomListPage))
    const css = await Bun.file(new URL('./styles/global.css', import.meta.url)).text()

    expect(html).toContain('theme-card-lilac')
    expect(html).toContain('theme-card-blush')
    expect(html).toContain('theme-card-sky')
    expect(html).toContain('theme-card-mint')

    expect(css).toContain('--accent: #6e77e5;')
    expect(css).toContain('--warning: #ffe08a;')
    expect(css).toContain('--success: #8fd7be;')
    expect(css).toContain('--organic-circle-1: #d7d1ff;')
    expect(css).toContain('--organic-circle-2: #ffd9ee;')
    expect(css).toContain('--organic-circle-3: #bfeaf6;')
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
