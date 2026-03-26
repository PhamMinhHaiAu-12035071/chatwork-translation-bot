import { AnimatePresence } from 'framer-motion'
import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { BrutalToast } from '~/components/molecules/brutal-toast'
import type { ToastItem, ToastVariant } from '~/components/molecules/brutal-toast'

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, variant: ToastVariant = 'success') => {
      const id = `toast-${String(Date.now())}-${Math.random().toString(36).slice(2)}`

      setItems((prev) => [...prev, { id, message, variant }])
      setTimeout(() => {
        dismiss(id)
      }, 4000)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        <AnimatePresence mode="popLayout">
          {items.map((item) => (
            <div key={item.id} className="pointer-events-auto">
              <BrutalToast item={item} onDismiss={dismiss} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast must be used inside <ToastProvider>')
  }

  return context
}
