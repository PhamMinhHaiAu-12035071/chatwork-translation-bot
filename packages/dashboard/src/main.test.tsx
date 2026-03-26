import { describe, expect, it } from 'bun:test'

describe('main entrypoint', () => {
  it('wraps the router in ToastProvider', async () => {
    const source = await Bun.file(new URL('./main.tsx', import.meta.url)).text()

    expect(source).toContain("import { ToastProvider } from '~/components/ui/toast-provider'")
    expect(source).toContain('<ToastProvider>')
    expect(source).toContain('<RouterProvider router={router} />')
  })
})
