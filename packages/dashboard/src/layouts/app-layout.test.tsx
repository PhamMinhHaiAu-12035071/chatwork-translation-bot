import { describe, expect, it } from 'bun:test'

describe('AppLayout', () => {
  it('removes redundant sidebar helper copy', async () => {
    const source = await Bun.file(new URL('./app-layout.tsx', import.meta.url)).text()

    expect(source).not.toContain("blurb: 'overview + empty state'")
    expect(source).not.toContain("blurb: 'future creation flow'")
    expect(source).not.toContain("blurb: 'manual setup steps'")
    expect(source).not.toContain(
      'Multi-room dashboard shell for setup, guidance, and future activation flows.',
    )
  })
})
