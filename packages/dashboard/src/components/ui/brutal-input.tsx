import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'

interface BrutalInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string | undefined
  error?: string | undefined
}

export const BrutalInput = forwardRef<HTMLInputElement, BrutalInputProps>(
  ({ label, hint, error, className, id, ...rest }, ref) => {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="space-y-1.5">
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={[
            'w-full rounded-[14px] border-[3px] border-[var(--border)] bg-white/80 px-4 py-2.5',
            'text-sm text-[var(--text-primary)] shadow-[3px_3px_0_var(--border)]',
            'placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1',
            'transition-shadow duration-150',
            error ? 'border-[var(--error)] shadow-[3px_3px_0_var(--error)]' : '',
            className ?? '',
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        />
        {hint && !error ? (
          <p className="text-xs leading-5 text-[var(--text-secondary)]">{hint}</p>
        ) : null}
        {error ? <p className="text-xs leading-5 text-[var(--error)]">{error}</p> : null}
      </div>
    )
  },
)

BrutalInput.displayName = 'BrutalInput'
