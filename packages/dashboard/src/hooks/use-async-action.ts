import { useCallback, useState } from 'react'

interface AsyncActionState<T> {
  data: T | null
  error: string | null
  loading: boolean
}

interface UseAsyncActionOptions {
  fallbackErrorMessage?: string
  getErrorMessage?: (error: unknown) => string
}

export type AsyncActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; cause: unknown }

export function useAsyncAction<T>(options: UseAsyncActionOptions = {}) {
  const { fallbackErrorMessage = 'Unknown error', getErrorMessage } = options
  const [state, setState] = useState<AsyncActionState<T>>({
    data: null,
    error: null,
    loading: false,
  })

  const execute = useCallback(
    async (fn: () => Promise<T>): Promise<AsyncActionResult<T>> => {
      setState({ data: null, error: null, loading: true })

      try {
        const data = await fn()
        setState({ data, error: null, loading: false })
        return { ok: true, data }
      } catch (error) {
        const message =
          getErrorMessage?.(error) ??
          (error instanceof Error ? error.message : fallbackErrorMessage)

        setState({ data: null, error: message, loading: false })
        return { ok: false, error: message, cause: error }
      }
    },
    [fallbackErrorMessage, getErrorMessage],
  )

  const reset = useCallback(() => {
    setState({ data: null, error: null, loading: false })
  }, [])

  return { ...state, execute, reset }
}
