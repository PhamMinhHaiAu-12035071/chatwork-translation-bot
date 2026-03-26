import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RoomSkeletonCard, RoomSkeletonList } from '~/components/organisms/room-skeleton'

describe('RoomSkeleton', () => {
  it('renders a brutal loading card shell', () => {
    const html = renderToStaticMarkup(createElement(RoomSkeletonCard))

    expect(html).toContain('brutal-surface')
    expect(html).toContain('theme-card-cream')
    expect(html).toContain('bg-[var(--card-glass)]')
  })

  it('renders the requested number of placeholder cards', () => {
    const html = renderToStaticMarkup(createElement(RoomSkeletonList, { count: 4 }))

    expect(html.match(/theme-card-cream/g)?.length ?? 0).toBe(4)
  })
})
