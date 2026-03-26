import type { ReactNode } from 'react'

interface StickerLabelProps {
  children: ReactNode
  tone?: 'accent' | 'success' | 'warning' | 'default'
  tilt?: 'left' | 'right' | 'flat'
}

const toneClassMap: Record<NonNullable<StickerLabelProps['tone']>, string> = {
  accent: 'bg-[var(--accent)] text-white',
  success: 'bg-[var(--success)] text-[var(--border)]',
  warning: 'bg-[var(--warning)] text-[var(--border)]',
  default: 'bg-white text-[var(--border)]',
}

const tiltClassMap: Record<NonNullable<StickerLabelProps['tilt']>, string> = {
  left: 'sticker-tilt-left',
  right: 'sticker-tilt-right',
  flat: 'sticker-tilt-flat',
}

export function StickerLabel({ children, tone = 'default', tilt = 'left' }: StickerLabelProps) {
  return (
    <span className={['sticker-label', toneClassMap[tone], tiltClassMap[tilt]].join(' ')}>
      {children}
    </span>
  )
}
