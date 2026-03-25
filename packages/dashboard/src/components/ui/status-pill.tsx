interface StatusPillProps {
  children: string
  tone?: 'neutral' | 'accent' | 'success' | 'warning'
}

const toneClassMap: Record<NonNullable<StatusPillProps['tone']>, string> = {
  neutral: 'bg-white/80 text-[var(--text-primary)]',
  accent: 'bg-[var(--accent)] text-white',
  success: 'bg-[var(--success)] text-[var(--border)]',
  warning: 'bg-[var(--warning)] text-[var(--border)]',
}

export function StatusPill({ children, tone = 'neutral' }: StatusPillProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border-[3px] border-[var(--border)] px-3 py-1 text-xs font-semibold shadow-[3px_3px_0_var(--border)]',
        toneClassMap[tone],
      ].join(' ')}
    >
      {children}
    </span>
  )
}
