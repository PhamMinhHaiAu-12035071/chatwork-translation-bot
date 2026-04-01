import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import type { SelectHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Icon } from '~/components/atoms/icons'
import type { ClayIconName } from '~/components/atoms/icons'

interface SelectOption {
  value: string
  label: string
}

type DropdownColor = 'accent' | 'mint' | 'peach' | 'rose'

interface BrutalSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  options: SelectOption[]
  placeholder?: string | undefined
  hint?: string | undefined
  error?: string | undefined
  colorVariant?: DropdownColor | undefined
  icon?: ClayIconName | undefined
}

export const BrutalSelect = forwardRef<HTMLSelectElement, BrutalSelectProps>(
  (
    {
      label,
      options,
      placeholder,
      hint,
      error,
      colorVariant,
      icon,
      className,
      id,
      onChange,
      value: valueProp,
      defaultValue,
      ...rest
    },
    ref,
  ) => {
    const selectId = id ?? label.toLowerCase().replace(/\s+/g, '-')
    const reducedMotion = useReducedMotion()
    const [isOpen, setIsOpen] = useState(false)
    const [activeIndex, setActiveIndex] = useState(-1)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const panelRef = useRef<HTMLDivElement>(null)
    const hiddenSelectRef = useRef<HTMLSelectElement | null>(null)
    const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 0 })

    const setHiddenRef = useCallback(
      (node: HTMLSelectElement | null) => {
        hiddenSelectRef.current = node
        if (typeof ref === 'function') {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
      },
      [ref],
    )

    const fallback = (defaultValue as string | undefined) ?? ''
    // Prefer controlled `value` from RHF/parent so the trigger label stays in sync when options
    // change (e.g. switching AI provider) — reading only the DOM ref can leave a stale/invalid value.
    const currentValue =
      valueProp !== undefined ? String(valueProp) : (hiddenSelectRef.current?.value ?? fallback)
    const selectedOption = options.find((opt) => opt.value === currentValue)
    const displayLabel = selectedOption?.label ?? placeholder ?? ''

    const openDropdown = () => {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      setPanelPos({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      })
      setIsOpen(true)
      const idx = options.findIndex((opt) => opt.value === currentValue)
      setActiveIndex(idx >= 0 ? idx : 0)
    }

    const closeDropdown = () => {
      setIsOpen(false)
      setActiveIndex(-1)
      triggerRef.current?.focus()
    }

    const selectOption = (value: string) => {
      const select = hiddenSelectRef.current
      if (!select) return

      const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')

      if (descriptor?.set) {
        descriptor.set.call(select, value)
      } else {
        select.value = value
      }

      select.dispatchEvent(new Event('change', { bubbles: true }))
      closeDropdown()
    }

    const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openDropdown()
      }
    }

    const handlePanelKeyDown = (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setActiveIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0))
          break
        case 'ArrowUp':
          e.preventDefault()
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1))
          break
        case 'Enter':
        case ' ': {
          e.preventDefault()
          const opt = options[activeIndex]
          if (activeIndex >= 0 && opt) {
            selectOption(opt.value)
          }
          break
        }
        case 'Escape':
          e.preventDefault()
          closeDropdown()
          break
        case 'Tab':
          closeDropdown()
          break
      }
    }

    useEffect(() => {
      if (!isOpen || !panelRef.current) return
      panelRef.current.focus()
    }, [isOpen])

    useEffect(() => {
      if (!isOpen || !panelRef.current || activeIndex < 0) return
      const activeEl = panelRef.current.querySelector<HTMLElement>(
        `[data-index="${String(activeIndex)}"]`,
      )
      activeEl?.scrollIntoView({ block: 'nearest' })
    }, [activeIndex, isOpen])

    const dropdownPanel = isOpen ? (
      <>
        <div className="brutal-dropdown-backdrop" onClick={closeDropdown} />
        <div
          ref={panelRef}
          className="brutal-dropdown"
          style={{ top: panelPos.top, left: panelPos.left, width: panelPos.width }}
          role="listbox"
          aria-label={label}
          tabIndex={-1}
          onKeyDown={handlePanelKeyDown}
          data-color={colorVariant && colorVariant !== 'accent' ? colorVariant : undefined}
        >
          {options.map((option, idx) => (
            <div
              key={option.value}
              className="brutal-dropdown-option"
              role="option"
              aria-selected={option.value === currentValue}
              data-selected={option.value === currentValue ? 'true' : undefined}
              data-active={idx === activeIndex ? 'true' : undefined}
              data-index={idx}
              onClick={() => {
                selectOption(option.value)
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      </>
    ) : null

    return (
      <div className="space-y-1.5">
        <label
          htmlFor={selectId}
          className="font-ui-body block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]"
        >
          {label}
        </label>

        <select
          ref={setHiddenRef}
          id={selectId}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={onChange}
          {...rest}
          {...(valueProp !== undefined
            ? { value: String(valueProp) }
            : defaultValue !== undefined
              ? { defaultValue }
              : {})}
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

        <button
          ref={triggerRef}
          type="button"
          className={[
            'brutal-input flex w-full min-w-0 items-center justify-between px-4 py-2.5',
            'font-ui-body text-sm text-[var(--text-primary)]',
            'cursor-pointer text-left',
            error ? 'brutal-input-error' : '',
            className ?? '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={openDropdown}
          onKeyDown={handleTriggerKeyDown}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={label}
        >
          <span className="flex min-w-0 flex-1 items-center gap-x-2">
            {icon ? <Icon name={icon} variant="clay" size={20} aria-hidden /> : null}
            <span
              className={[
                'min-w-0 flex-1 truncate',
                selectedOption ? '' : 'text-[var(--text-secondary)]',
              ]
                .filter(Boolean)
                .join(' ')}
              title={displayLabel || undefined}
            >
              {displayLabel}
            </span>
          </span>
          <span className="brutal-dropdown-chevron" data-open={isOpen ? 'true' : undefined}>
            <motion.span
              className="inline-flex will-change-transform"
              style={{ transformOrigin: '50% 55%' }}
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 520, damping: 34, mass: 0.55 }
              }
            >
              <Icon name="chevron-down" variant="stroke" size={14} aria-hidden />
            </motion.span>
          </span>
        </button>

        {hint && !error ? (
          <p className="font-ui-body text-xs leading-5 text-[var(--text-secondary)]">{hint}</p>
        ) : null}
        {error ? (
          <p className="font-ui-body text-xs leading-5 text-[var(--error)]">{error}</p>
        ) : null}

        {typeof document !== 'undefined' ? createPortal(dropdownPanel, document.body) : null}
      </div>
    )
  },
)

BrutalSelect.displayName = 'BrutalSelect'
