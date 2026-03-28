import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Icon } from '~/components/atoms/icons'

// ── Stroke variant ─────────────────────────────────────────────
describe('Icon stroke — arrow-left', () => {
  it('renders stroke-icon-wrap wrapper with slide-left anim class', () => {
    const html = renderToStaticMarkup(
      createElement(Icon, { name: 'arrow-left', variant: 'stroke' }),
    )
    expect(html).toContain('stroke-icon-wrap')
    expect(html).toContain('icon-anim-slide-left')
  })

  it('renders main path with correct d attribute', () => {
    const html = renderToStaticMarkup(
      createElement(Icon, { name: 'arrow-left', variant: 'stroke' }),
    )
    expect(html).toContain('M17 10H3')
  })

  it('renders a shadow path with opacity 0.22 at offset transform', () => {
    const html = renderToStaticMarkup(
      createElement(Icon, { name: 'arrow-left', variant: 'stroke' }),
    )
    expect(html).toContain('opacity="0.22"')
    expect(html).toContain('translate(1.3,1.3)')
  })
})

describe('Icon stroke — arrow-right', () => {
  it('renders main path and slide-right anim class', () => {
    const html = renderToStaticMarkup(
      createElement(Icon, { name: 'arrow-right', variant: 'stroke' }),
    )
    expect(html).toContain('M3 10H17')
    expect(html).toContain('icon-anim-slide-right')
  })
})

describe('Icon stroke — chevron-down', () => {
  it('renders correct viewBox and path', () => {
    const html = renderToStaticMarkup(
      createElement(Icon, { name: 'chevron-down', variant: 'stroke' }),
    )
    expect(html).toContain('0 0 18 12')
    expect(html).toContain('M2 2L9 10L16 2')
    expect(html).toContain('icon-anim-lift')
  })
})

describe('Icon stroke — close', () => {
  it('renders X paths and wiggle anim class', () => {
    const html = renderToStaticMarkup(createElement(Icon, { name: 'close', variant: 'stroke' }))
    expect(html).toContain('M3 3L15 15')
    expect(html).toContain('icon-anim-wiggle')
  })
})

describe('Icon stroke — external-link', () => {
  it('renders box + diagonal arrow paths', () => {
    const html = renderToStaticMarkup(
      createElement(Icon, { name: 'external-link', variant: 'stroke' }),
    )
    expect(html).toContain('M9 4H4')
    expect(html).toContain('M17 3L10 10')
    expect(html).toContain('icon-anim-slide-right')
  })
})

describe('Icon stroke — aria props', () => {
  it('forwards aria-hidden', () => {
    const html = renderToStaticMarkup(
      createElement(Icon, { name: 'close', variant: 'stroke', 'aria-hidden': true }),
    )
    expect(html).toContain('aria-hidden="true"')
  })

  it('forwards aria-label for interactive usage', () => {
    const html = renderToStaticMarkup(
      createElement(Icon, {
        name: 'close',
        variant: 'stroke',
        'aria-label': 'Dismiss notification',
      }),
    )
    expect(html).toContain('aria-label="Dismiss notification"')
  })
})

// ── Clay variant ───────────────────────────────────────────────
describe('Icon clay — structure', () => {
  it('renders clay-icon-wrap wrapper', () => {
    const html = renderToStaticMarkup(createElement(Icon, { name: 'plus', variant: 'clay' }))
    expect(html).toContain('clay-icon-wrap')
  })

  it('renders shadow rect with opacity 0.2', () => {
    const html = renderToStaticMarkup(createElement(Icon, { name: 'plus', variant: 'clay' }))
    expect(html).toContain('opacity="0.2"')
  })

  it('renders inner shine ellipse with opacity 0.42', () => {
    const html = renderToStaticMarkup(createElement(Icon, { name: 'plus', variant: 'clay' }))
    expect(html).toContain('opacity="0.42"')
  })

  it('references linearGradient with clay-grad- prefix', () => {
    const html = renderToStaticMarkup(createElement(Icon, { name: 'plus', variant: 'clay' }))
    expect(html).toMatch(/id="clay-grad-/)
    expect(html).toMatch(/fill="url\(#clay-grad-/)
  })

  it('respects custom size prop', () => {
    const html = renderToStaticMarkup(
      createElement(Icon, { name: 'plus', variant: 'clay', size: 48 }),
    )
    expect(html).toContain('width="48"')
    expect(html).toContain('height="48"')
  })
})

describe('Icon clay — plus', () => {
  it('renders violet gradient and plus symbol', () => {
    const html = renderToStaticMarkup(createElement(Icon, { name: 'plus', variant: 'clay' }))
    expect(html).toContain('#ede8ff')
    expect(html).toContain('#bfb3f7')
    expect(html).toContain('M22 12V32')
  })
})

describe('Icon clay — pencil', () => {
  it('renders sky blue gradient and pencil body path', () => {
    const html = renderToStaticMarkup(createElement(Icon, { name: 'pencil', variant: 'clay' }))
    expect(html).toContain('#d5f0ff')
    expect(html).toContain('#7dc8ec')
    expect(html).toContain('M29.5 10.5L33.5 14.5')
  })
})

describe('Icon clay — trash', () => {
  it('renders pink gradient, lid path, body rect, and 3 lines', () => {
    const html = renderToStaticMarkup(createElement(Icon, { name: 'trash', variant: 'clay' }))
    expect(html).toContain('#ffe0f0')
    expect(html).toContain('M17 15H27')
    expect(html).toContain('x1="19"')
    expect(html).toContain('x1="22"')
    expect(html).toContain('x1="25"')
  })
})

describe('Icon clay — book', () => {
  it('renders amber gradient and two book-wing paths', () => {
    const html = renderToStaticMarkup(createElement(Icon, { name: 'book', variant: 'clay' }))
    expect(html).toContain('#fde7c0')
    expect(html).toContain('#f4a060')
    expect(html).toContain('M22 13V33')
  })
})

describe('Icon clay — link', () => {
  it('renders matcha gradient and chain paths', () => {
    const html = renderToStaticMarkup(createElement(Icon, { name: 'link', variant: 'clay' }))
    expect(html).toContain('#e9fad8')
    expect(html).toContain('#7abf64')
    expect(html).toContain('14.5 22')
  })
})
