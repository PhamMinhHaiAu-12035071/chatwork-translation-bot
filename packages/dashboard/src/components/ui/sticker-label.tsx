import type { ReactNode } from 'react'

interface StickerLabelProps {
  children: ReactNode
  tone?: 'accent' | 'success' | 'warning' | 'default'
}

const toneClassMap: Record<NonNullable<StickerLabelProps['tone']>, string> = {
  accent: 'bg-[var(--accent)] text-white',
  success: 'bg-[var(--success)] text-[var(--border)]',
  warning: 'bg-[var(--warning)] text-[var(--border)]',
  default: 'bg-white text-[var(--border)]',
}

export function StickerLabel({ children, tone = 'default' }: StickerLabelProps) {
  return <span className={['sticker-label', toneClassMap[tone]].join(' ')}>{children}</span>
}
