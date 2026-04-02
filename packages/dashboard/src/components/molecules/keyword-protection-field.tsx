import { useState, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { BrutalInput } from '~/components/atoms/brutal-input'
import { BrutalSelect } from '~/components/atoms/brutal-select'
import { Icon } from '~/components/atoms/icons'

export type KeywordProtectionCategory = 'company' | 'person' | 'project' | 'code' | 'other'

export interface KeywordProtectionEntry {
  keyword: string
  category: KeywordProtectionCategory
  placeholder?: string | undefined
}

interface KeywordProtectionFieldProps {
  value: KeywordProtectionEntry[]
  onChange: (value: KeywordProtectionEntry[]) => void
}

// ── Category config ────────────────────────────────────────────────
// Colors aligned with dashboard design system using CSS variables:
// company → --sky-accent, person → --pink-accent, project → --success, code → --warning
const CATEGORY_CONFIG: Record<
  KeywordProtectionCategory,
  { label: string; bg: string; accent: string; number: string }
> = {
  company: {
    label: 'COMPANY',
    bg: 'rgba(97, 183, 232, 0.12)',
    accent: '#61b7e8',
    number: '#1d6c9f',
  },
  person: { label: 'PERSON', bg: 'rgba(212, 68, 112, 0.11)', accent: '#d44470', number: '#9b2556' },
  project: {
    label: 'PROJECT',
    bg: 'rgba(161, 207, 142, 0.14)',
    accent: '#a1cf8e',
    number: '#3d8a50',
  },
  code: { label: 'CODE', bg: 'rgba(255, 225, 154, 0.28)', accent: '#ffe19a', number: '#d4ac0d' },
  other: { label: 'OTHER', bg: 'rgba(156, 163, 175, 0.11)', accent: '#9ca3af', number: '#6b7280' },
}

const CATEGORY_PREFIX: Record<KeywordProtectionCategory, string> = {
  company: 'COMPANY',
  person: 'PERSON',
  project: 'PROJECT',
  code: 'CODE',
  other: 'TERM',
}

function getAutoPlaceholder(category: KeywordProtectionCategory, index: number): string {
  return `[${CATEGORY_PREFIX[category]}_${(index + 1).toString()}]`
}

function getEffectivePlaceholder(entry: KeywordProtectionEntry, indexInCategory: number): string {
  return entry.placeholder?.trim() ?? getAutoPlaceholder(entry.category, indexInCategory)
}

// ── Component ─────────────────────────────────────────────────────
export function KeywordProtectionField({ value, onChange }: KeywordProtectionFieldProps) {
  const [isOpen, setIsOpen] = useState(value.length > 0)
  const [internalKeywords, setInternalKeywords] = useState(value)
  const panelRef = useRef<HTMLDivElement>(null)

  // Add-form state
  const [addKeyword, setAddKeyword] = useState('')
  const [addCategory, setAddCategory] = useState<KeywordProtectionCategory>('company')
  const [addPlaceholder, setAddPlaceholder] = useState('')
  const [addError, setAddError] = useState('')
  const shouldReduceMotion = useReducedMotion()

  function handleToggle() {
    const next = !isOpen
    setIsOpen(next)
    if (next) {
      onChange(internalKeywords)
      // Auto-scroll khi user nhấn mở để nhìn thấy toàn bộ expanded panel
      // Delay để animation expand hoàn tất trước khi scroll
      setTimeout(() => {
        panelRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'end',
          inline: 'nearest',
        })
      }, 350)
    } else {
      onChange([])
    }
  }

  function handleAdd() {
    const trimmed = addKeyword.trim()
    if (!trimmed) {
      setAddError('Keyword is required')
      return
    }
    if (trimmed.length > 100) {
      setAddError('Max 100 characters')
      return
    }
    const duplicate = internalKeywords.some(
      (k) => k.keyword.toLowerCase() === trimmed.toLowerCase(),
    )
    if (duplicate) {
      setAddError('Keyword already exists (case-insensitive)')
      return
    }
    if (internalKeywords.length >= 50) {
      setAddError('Maximum 50 keywords reached')
      return
    }

    const entry: KeywordProtectionEntry = {
      keyword: trimmed,
      category: addCategory,
      ...(addPlaceholder.trim() ? { placeholder: addPlaceholder.trim() } : {}),
    }

    const next = [...internalKeywords, entry]
    setInternalKeywords(next)
    if (isOpen) onChange(next)

    setAddKeyword('')
    setAddPlaceholder('')
    setAddError('')
  }

  function handleRemove(index: number) {
    const next = internalKeywords.filter((_, i) => i !== index)
    setInternalKeywords(next)
    if (isOpen) onChange(next)
  }

  // Compute category-indexed placeholders for display
  const categoryCounts: Partial<Record<KeywordProtectionCategory, number>> = {}
  const keywordsWithPlaceholder = internalKeywords.map((entry) => {
    const cat = entry.category
    categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1
    return {
      ...entry,
      effectivePlaceholder: getEffectivePlaceholder(entry, (categoryCounts[cat] ?? 1) - 1),
    }
  })

  // Preview placeholder for add form
  const previewCounts = { ...categoryCounts }
  const previewIdx = previewCounts[addCategory] ?? 0
  const previewPlaceholder =
    addPlaceholder.trim() || `[${CATEGORY_PREFIX[addCategory]}_${(previewIdx + 1).toString()}]`

  return (
    <div>
      {/* ── Header Banner ─────────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleToggle}
        className={[
          'brutal-input w-full px-4 py-3',
          'flex items-center justify-between gap-3 text-left',
          'cursor-pointer',
        ].join(' ')}
        style={{
          background: isOpen ? '#ffe19a' : '#fffbeb',
          borderColor: '#1a1a2e',
          boxShadow: isOpen ? '5px 5px 0 #1a1a2e' : '3px 3px 0 #1a1a2e',
          transform: isOpen ? 'translate(-1px, -1px)' : 'none',
          transition: 'all 0.12s ease',
        }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] border-2 border-[var(--border)] text-sm"
            style={{
              background: isOpen ? '#ffe19a' : '#fffbeb',
              boxShadow: '2px 2px 0 var(--border)',
            }}
            aria-hidden
          >
            🛡️
          </span>
          <span className="flex flex-col">
            <span className="font-heading text-sm font-extrabold text-[var(--text-primary)]">
              Keyword Protection
            </span>
            <span className="font-ui-body text-xs text-[var(--text-secondary)]">
              {isOpen
                ? `${internalKeywords.length.toString()} keyword${internalKeywords.length === 1 ? '' : 's'} protected`
                : 'Mask sensitive terms before sending to AI'}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isOpen && internalKeywords.length > 0 ? (
            <span
              className="font-heading text-[0.62rem] font-extrabold uppercase tracking-wide"
              style={{
                padding: '2px 8px',
                border: '1.5px solid #5c8b52',
                borderRadius: 999,
                background: 'linear-gradient(180deg,#a1cf8e,#79a766)',
                color: 'var(--border)',
                boxShadow: '1.5px 1.5px 0 #5c8b52',
              }}
            >
              {internalKeywords.length} / 50
            </span>
          ) : (
            <span
              className="font-heading text-[0.62rem] font-extrabold uppercase tracking-wide text-[var(--text-secondary)]"
              style={{
                padding: '2px 8px',
                border: '2px solid var(--border)',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.9)',
                boxShadow: '1.5px 1.5px 0 var(--border)',
              }}
            >
              Optional
            </span>
          )}
        </div>
      </button>

      {/* ── Expanded Panel ────────────────────────────────────────── */}
      {isOpen && (
        <div
          ref={panelRef}
          style={{
            marginTop: 10,
            border: '2px dashed rgba(26,26,46,0.35)',
            borderRadius: 14,
            background: 'rgba(255,255,255,0.6)',
            padding: 14,
          }}
        >
          {/* Keywords table */}
          {internalKeywords.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {/* Column headers */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '36px 1fr 126px 126px 36px',
                  gap: 10,
                  padding: '6px 12px 8px',
                  borderBottom: '2.5px solid var(--border)',
                  marginBottom: 6,
                }}
              >
                {['#', 'SENSITIVE TERM', 'CATEGORY', 'AI SEES', ''].map((col) => (
                  <span
                    key={col}
                    style={{
                      fontFamily: 'var(--font-heading, inherit)',
                      fontSize: '0.6rem',
                      fontWeight: 800,
                      color: '#6b7280',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {col}
                  </span>
                ))}
              </div>

              {/* Rows */}
              <AnimatePresence initial={false}>
                {keywordsWithPlaceholder.map((entry, index) => {
                  const cat = entry.category
                  const cfg = CATEGORY_CONFIG[cat]
                  return (
                    <motion.div
                      key={entry.keyword}
                      layout
                      initial={
                        shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -24, scale: 0.97 }
                      }
                      animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }}
                      exit={
                        shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 32, scale: 0.95 }
                      }
                      transition={
                        shouldReduceMotion
                          ? { duration: 0.15 }
                          : {
                              layout: { type: 'spring', stiffness: 400, damping: 32 },
                              opacity: { duration: 0.18 },
                              x: { type: 'spring', stiffness: 380, damping: 28 },
                              scale: { type: 'spring', stiffness: 380, damping: 28 },
                            }
                      }
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '36px 1fr 126px 126px 36px',
                        gap: 10,
                        alignItems: 'center',
                        padding: '11px 12px',
                        background: cfg.bg,
                        borderRadius: 10,
                        border: '2px solid rgba(26,26,46,0.14)',
                        marginBottom: 5,
                      }}
                    >
                      {/* Row number */}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          border: '2.5px solid var(--border)',
                          background: cfg.number,
                          color: '#fff',
                          fontFamily: "'Shantell Sans', cursive",
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          boxShadow: '2px 2px 0 var(--border)',
                          flexShrink: 0,
                        }}
                      >
                        {index + 1}
                      </span>

                      {/* Keyword */}
                      <span
                        style={{
                          fontFamily: 'var(--font-heading, inherit)',
                          fontSize: '0.875rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {entry.keyword}
                      </span>

                      {/* Category pill */}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 10px',
                          border: '2.5px solid var(--border)',
                          borderRadius: 999,
                          background: cfg.accent,
                          boxShadow: '2px 2px 0 var(--border)',
                          fontFamily: 'var(--font-heading, inherit)',
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          color: 'var(--border)',
                          letterSpacing: '0.08em',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: 110,
                        }}
                      >
                        {cfg.label}
                      </span>

                      {/* Placeholder badge */}
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          padding: '4px 8px',
                          border: '2.5px solid var(--border)',
                          borderRadius: 8,
                          background: '#fff',
                          boxShadow: '2px 2px 0 var(--border)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: 110,
                        }}
                        title={entry.effectivePlaceholder}
                      >
                        {entry.effectivePlaceholder}
                      </span>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => {
                          handleRemove(index)
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 26,
                          height: 26,
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          flexShrink: 0,
                          padding: 0,
                          transition: 'transform 140ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.15)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)'
                        }}
                        onMouseDown={(e) => {
                          e.currentTarget.style.transform = 'scale(0.95)'
                        }}
                        onMouseUp={(e) => {
                          e.currentTarget.style.transform = 'scale(1.15)'
                        }}
                        aria-label={`Remove keyword ${entry.keyword}`}
                      >
                        <Icon name="clear" variant="clay" size={20} aria-hidden />
                      </button>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}

          {/* Add form */}
          <div
            id="tour-keyword-addform"
            style={{
              border: '2px solid rgba(26,26,46,0.25)',
              borderRadius: 10,
              padding: 12,
              background: '#fffbeb',
            }}
          >
            {/* Row 1: Keyword + Category — same height because both have labels via BrutalInput/BrutalSelect */}
            <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 160px' }}>
              <BrutalInput
                label="Keyword Term"
                type="text"
                value={addKeyword}
                onChange={(e) => {
                  setAddKeyword(e.target.value)
                  setAddError('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAdd()
                  }
                }}
                placeholder="e.g. Asia Vion"
                maxLength={100}
              />

              <BrutalSelect
                label="Category"
                options={[
                  { value: 'company', label: 'Company' },
                  { value: 'person', label: 'Person' },
                  { value: 'project', label: 'Project' },
                  { value: 'code', label: 'Code' },
                  { value: 'other', label: 'Other' },
                ]}
                value={addCategory}
                onChange={(e) => {
                  setAddCategory(e.target.value as KeywordProtectionCategory)
                }}
                colorVariant="rose"
                className="bg-[#ffe4e6]"
              />
            </div>

            {/* Row 2: Custom placeholder + Add button (aligned to bottom) */}
            <div className="grid items-end gap-3 mt-3" style={{ gridTemplateColumns: '1fr auto' }}>
              <BrutalInput
                label="Custom Placeholder (optional)"
                type="text"
                value={addPlaceholder}
                onChange={(e) => {
                  setAddPlaceholder(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAdd()
                  }
                }}
                placeholder={previewPlaceholder}
                maxLength={50}
                style={{ fontFamily: 'monospace' }}
              />

              {/* Add button — matches dashboard button pattern */}
              <button
                type="button"
                onClick={handleAdd}
                className="brutal-button theme-button-violet inline-flex items-center gap-1.5 px-5 py-2.5 font-heading text-sm font-bold text-white"
              >
                <Icon name="plus" variant="clay" size={18} aria-hidden />
                <span style={{ lineHeight: 1, display: 'inline-block' }}>Add</span>
              </button>
            </div>

            {addError && (
              <p
                style={{
                  marginTop: 6,
                  fontFamily: 'var(--font-ui-body, inherit)',
                  fontSize: '0.72rem',
                  color: '#d44470',
                  fontWeight: 600,
                }}
              >
                {addError}
              </p>
            )}
          </div>

          {/* Info bar */}
          <p
            style={{
              marginTop: 10,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              borderRadius: 10,
              border: '2px dashed rgba(110,119,229,0.4)',
              background: 'rgba(228,219,255,0.4)',
              padding: '8px 12px',
              fontFamily: 'var(--font-ui-body, inherit)',
              fontSize: '0.72rem',
              lineHeight: 1.5,
              color: '#4b5563',
            }}
          >
            <span aria-hidden>🔍</span>
            <span>
              Smart matching: each keyword also matches compound forms (AsiaVion), hyphens
              (Asia-Vion), underscores, and case variants. Vietnamese diacritics and Japanese
              full-width spaces are handled automatically.
            </span>
          </p>
        </div>
      )}
    </div>
  )
}
