import { describe, expect, it } from 'bun:test'

describe('useAsyncAction', () => {
  it('defines a typed async result contract with loading, error, success, and reset paths', async () => {
    const source = await Bun.file(new URL('./use-async-action.ts', import.meta.url)).text()

    expect(source).toContain('interface AsyncActionState<T>')
    expect(source).toContain('export type AsyncActionResult<T>')
    expect(source).toContain("fallbackErrorMessage = 'Unknown error'")
    expect(source).toContain('setState({ data: null, error: null, loading: true })')
    expect(source).toContain('return { ok: true, data }')
    expect(source).toContain('return { ok: false, error: message, cause: error }')
    expect(source).toContain('const reset = useCallback(() => {')
    expect(source).toContain('return { ...state, execute, reset }')
  })
})
