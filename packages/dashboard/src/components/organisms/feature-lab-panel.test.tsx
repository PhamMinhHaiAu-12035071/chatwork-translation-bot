import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FeatureLabPanel } from '~/components/organisms/feature-lab-panel'

const noop = () => undefined

describe('FeatureLabPanel', () => {
  describe('collapsed state', () => {
    it('renders the ⚗️ icon', () => {
      const html = renderToStaticMarkup(
        createElement(FeatureLabPanel, { collapsed: true, enabled: false, onToggle: noop }),
      )
      expect(html).toContain('⚗️')
    })

    it('renders title="Feature Lab" for tooltip', () => {
      const html = renderToStaticMarkup(
        createElement(FeatureLabPanel, { collapsed: true, enabled: false, onToggle: noop }),
      )
      expect(html).toContain('title="Feature Lab"')
    })

    it('does not render the toggle button', () => {
      const html = renderToStaticMarkup(
        createElement(FeatureLabPanel, { collapsed: true, enabled: false, onToggle: noop }),
      )
      expect(html).not.toContain('role="switch"')
    })
  })

  describe('expanded state', () => {
    it('renders "FEATURE LAB" text', () => {
      const html = renderToStaticMarkup(
        createElement(FeatureLabPanel, { collapsed: false, enabled: false, onToggle: noop }),
      )
      expect(html).toContain('FEATURE LAB')
    })

    it('renders "Free Rooms" label', () => {
      const html = renderToStaticMarkup(
        createElement(FeatureLabPanel, { collapsed: false, enabled: false, onToggle: noop }),
      )
      expect(html).toContain('Free Rooms')
    })

    it('renders toggle button with role="switch"', () => {
      const html = renderToStaticMarkup(
        createElement(FeatureLabPanel, { collapsed: false, enabled: false, onToggle: noop }),
      )
      expect(html).toContain('role="switch"')
    })

    it('sets aria-checked="false" when disabled', () => {
      const html = renderToStaticMarkup(
        createElement(FeatureLabPanel, { collapsed: false, enabled: false, onToggle: noop }),
      )
      expect(html).toContain('aria-checked="false"')
    })

    it('sets aria-checked="true" when enabled', () => {
      const html = renderToStaticMarkup(
        createElement(FeatureLabPanel, { collapsed: false, enabled: true, onToggle: noop }),
      )
      expect(html).toContain('aria-checked="true"')
    })

    it('wires onToggle to the toggle button click', async () => {
      const source = await Bun.file(new URL('./feature-lab-panel.tsx', import.meta.url)).text()
      expect(source).toContain('onClick={onToggle}')
    })
  })
})
