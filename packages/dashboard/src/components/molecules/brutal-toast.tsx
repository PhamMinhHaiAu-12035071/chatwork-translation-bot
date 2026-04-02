import { motion } from 'framer-motion'

export type ToastVariant = 'success' | 'info' | 'warning' | 'error'

export interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
}

interface BrutalToastProps {
  item: ToastItem
  onDismiss: (id: string) => void
}

const variantConfig: Record<
  ToastVariant,
  {
    cardClass: string
    badgeClass: string
    badgeTextClass: string
    ringColor: string
    label: string
    icon: string
  }
> = {
  success: {
    cardClass: 'bg-[var(--card-matcha)]',
    badgeClass: 'bg-[#4ade80]',
    badgeTextClass: 'text-[var(--border)]',
    ringColor: '#22c55e',
    label: 'Success',
    icon: '✓',
  },
  error: {
    cardClass: 'bg-[rgba(255,228,228,0.96)]',
    badgeClass: 'bg-[#ff6f9f]',
    badgeTextClass: 'text-white',
    ringColor: '#e4406e',
    label: 'Error',
    icon: '✕',
  },
  warning: {
    cardClass: 'bg-[var(--card-cream)]',
    badgeClass: 'bg-[#fbbf24]',
    badgeTextClass: 'text-[var(--border)]',
    ringColor: '#d97706',
    label: 'Warning',
    icon: '!',
  },
  info: {
    cardClass: 'bg-[var(--card-sky)]',
    badgeClass: 'bg-[#93c5fd]',
    badgeTextClass: 'text-[var(--border)]',
    ringColor: '#3b82f6',
    label: 'Info',
    icon: 'i',
  },
}

export function BrutalToast({ item, onDismiss }: BrutalToastProps) {
  const cfg = variantConfig[item.variant]

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{
        opacity: [0, 1, 1, 1, 1],
        scaleX: [0.5, 1.06, 0.97, 1.01, 1],
        scaleY: [0.5, 0.94, 1.03, 0.99, 1],
      }}
      exit={{
        opacity: 0,
        scale: 0.65,
        y: -14,
        transition: { duration: 0.25, ease: [0.4, 0, 0.6, 1] },
      }}
      transition={{
        duration: 0.48,
        times: [0, 0.45, 0.65, 0.82, 1],
        ease: 'easeOut',
      }}
      whileHover={{ y: -2, x: -2 }}
      whileTap={{ y: 1, x: 1 }}
      className={[
        'flex items-center gap-3 rounded-[18px] border-[4px] border-[var(--border)] px-4 py-3',
        'shadow-[6px_6px_0_var(--border)] transition-shadow',
        cfg.cardClass,
      ].join(' ')}
    >
      {/* Stamp badge with ring pulse */}
      <div className="relative flex-shrink-0">
        <motion.div
          className="absolute inset-[-6px] rounded-full border-2"
          style={{ borderColor: cfg.ringColor }}
          initial={{ scale: 0.7, opacity: 0.65 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: 'easeOut' }}
          aria-hidden
        />
        <div
          className={[
            'flex size-[42px] items-center justify-center rounded-full',
            'border-[3.5px] border-[var(--border)] shadow-[3px_3px_0_var(--border)]',
            'font-heading text-lg font-black leading-none',
            cfg.badgeClass,
            cfg.badgeTextClass,
          ].join(' ')}
        >
          {cfg.icon}
        </div>
      </div>

      {/* Label + message */}
      <div className="flex flex-1 flex-col gap-px">
        <span className="font-heading text-[10px] font-black uppercase tracking-[0.08em] opacity-40">
          {cfg.label}
        </span>
        <span className="text-sm font-semibold leading-snug">{item.message}</span>
      </div>

      {/* Close button */}
      <motion.button
        type="button"
        onClick={() => {
          onDismiss(item.id)
        }}
        whileHover={{ x: -1, y: -1 }}
        whileTap={{ x: 1, y: 1 }}
        className={[
          'ml-auto flex size-6 shrink-0 items-center justify-center',
          'rounded-[8px] border-[2.5px] border-[var(--border)]',
          'bg-black/[0.07] shadow-[2px_2px_0_var(--border)]',
          'font-heading text-xs font-black transition-colors hover:bg-black/[0.15]',
        ].join(' ')}
        aria-label="Dismiss"
      >
        ✕
      </motion.button>
    </motion.div>
  )
}
