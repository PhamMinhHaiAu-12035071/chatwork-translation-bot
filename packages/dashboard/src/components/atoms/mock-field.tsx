interface MockFieldProps {
  label: string
  hint: string
  value?: string
}

export function MockField({ label, hint, value = 'Preview only in Phase 2' }: MockFieldProps) {
  return (
    <div className="space-y-2 rounded-[18px] border-[3px] border-[var(--border)] bg-white/70 p-4 shadow-[4px_4px_0_var(--border)]">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
        {label}
      </div>
      <div className="font-heading text-lg font-bold">{value}</div>
      <p className="text-sm leading-6 text-[var(--text-secondary)]">{hint}</p>
    </div>
  )
}
