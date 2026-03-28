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
          className="font-ui-body block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={[
            'brutal-input w-full min-w-0 px-4 py-2.5',
            'font-ui-body text-sm text-[var(--text-primary)]',
            'truncate',
            'placeholder:text-[var(--text-secondary)] placeholder:opacity-50',
            error ? 'brutal-input-error' : '',
            className ?? '',
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        />
        {hint && !error ? (
          <p className="font-ui-body text-xs leading-5 text-[var(--text-secondary)]">{hint}</p>
        ) : null}
        {error ? (
          <p className="font-ui-body text-xs leading-5 text-[var(--error)]">{error}</p>
        ) : null}
      </div>
    )
  },
)

BrutalInput.displayName = 'BrutalInput'
