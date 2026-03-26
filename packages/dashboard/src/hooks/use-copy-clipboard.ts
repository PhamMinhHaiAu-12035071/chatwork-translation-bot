import { useCallback, useRef, useState } from 'react'

interface ClipboardWriter {
  writeText?: (value: string) => Promise<void>
}

export function useCopyClipboard(resetMs = 2000) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearPendingReset = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      const clipboard = navigator.clipboard as ClipboardWriter | undefined

      if (!clipboard?.writeText) {
        return false
      }

      await clipboard.writeText(text)
      clearPendingReset()
      setCopied(true)
      timeoutRef.current = setTimeout(() => {
        setCopied(false)
        timeoutRef.current = null
      }, resetMs)

      return true
    },
    [clearPendingReset, resetMs],
  )

  return { copied, copy }
}
