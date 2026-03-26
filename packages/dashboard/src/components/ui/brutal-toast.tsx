import { motion } from 'framer-motion'

export type ToastVariant = 'success' | 'error'

export interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
}

interface BrutalToastProps {
  item: ToastItem
  onDismiss: (id: string) => void
}

const variantStyles: Record<ToastVariant, string> = {
  success: 'bg-[var(--success)] text-[var(--border)] border-[var(--border)]',
  error: 'bg-[#fde8ee] text-[var(--error)] border-[var(--error)]',
}

const variantIcon: Record<ToastVariant, string> = {
  success: 'OK',
  error: 'X',
}

export function BrutalToast({ item, onDismiss }: BrutalToastProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={[
        'flex items-center gap-3 rounded-[14px] border-[3px] px-5 py-3',
        'shadow-[4px_4px_0_var(--border)] text-sm font-semibold',
        variantStyles[item.variant],
      ].join(' ')}
    >
      <span className="font-heading text-base font-extrabold">{variantIcon[item.variant]}</span>
      <span>{item.message}</span>
      <button
        type="button"
        onClick={() => {
          onDismiss(item.id)
        }}
        className="ml-auto opacity-60 hover:opacity-100"
        aria-label="Dismiss"
      >
        X
      </button>
    </motion.div>
  )
}
