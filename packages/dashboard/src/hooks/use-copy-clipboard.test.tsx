import { describe, expect, it } from 'bun:test'

describe('useCopyClipboard', () => {
  it('guards navigator.clipboard access and exposes copied-state reset behavior in the source', async () => {
    const source = await Bun.file(new URL('./use-copy-clipboard.ts', import.meta.url)).text()

    expect(source).toContain('export function useCopyClipboard(resetMs = 2000)')
    expect(source).toContain('const [copied, setCopied] = useState(false)')
    expect(source).toContain('const clipboard = navigator.clipboard')
    expect(source).toContain('if (!clipboard?.writeText)')
    expect(source).toContain('await clipboard.writeText(text)')
    expect(source).toContain('setCopied(true)')
    expect(source).toContain('setTimeout(() => {')
    expect(source).toContain('setCopied(false)')
    expect(source).toContain('return { copied, copy }')
  })
})
