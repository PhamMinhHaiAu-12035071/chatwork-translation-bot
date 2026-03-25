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
