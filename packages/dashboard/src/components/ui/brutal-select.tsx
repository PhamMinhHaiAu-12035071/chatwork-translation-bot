import { forwardRef } from 'react'
import type { SelectHTMLAttributes } from 'react'

interface SelectOption {
  value: string
  label: string
}

interface BrutalSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  options: SelectOption[]
  placeholder?: string | undefined
  hint?: string | undefined
  error?: string | undefined
}

export const BrutalSelect = forwardRef<HTMLSelectElement, BrutalSelectProps>(
  ({ label, options, placeholder, hint, error, className, id, ...rest }, ref) => {
    const selectId = id ?? label.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="space-y-1.5">
        <label
          htmlFor={selectId}
          className="block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]"
        >
          {label}
        </label>
        <select
          ref={ref}
          id={selectId}
          className={[
            'w-full cursor-pointer appearance-none rounded-[14px] border-[3px] border-[var(--border)] bg-white/80 px-4 py-2.5',
            'text-sm text-[var(--text-primary)] shadow-[3px_3px_0_var(--border)]',
            'focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1',
            'transition-shadow duration-150',
            error ? 'border-[var(--error)] shadow-[3px_3px_0_var(--error)]' : '',
            className ?? '',
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {hint && !error ? (
          <p className="text-xs leading-5 text-[var(--text-secondary)]">{hint}</p>
        ) : null}
        {error ? <p className="text-xs leading-5 text-[var(--error)]">{error}</p> : null}
      </div>
    )
  },
)

BrutalSelect.displayName = 'BrutalSelect'
