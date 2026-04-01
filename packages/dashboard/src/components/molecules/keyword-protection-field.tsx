import { useState } from 'react'
import type { KeywordEntryFormInput } from '~/lib/room-schema'
import { BrutalSelect } from '~/components/atoms/brutal-select'
import { Icon } from '~/components/atoms/icons'

type KeywordCategory = 'company' | 'person' | 'project' | 'code' | 'other'

interface KeywordProtectionFieldProps {
  value: KeywordEntryFormInput[]
  onChange: (value: KeywordEntryFormInput[]) => void
}

// ── Category config ────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<
  KeywordCategory,
  { label: string; bg: string; accent: string; number: string }
> = {
  company: { label: 'COMPANY', bg: '#dbeafe', accent: '#61b7e8', number: '#1d6c9f' },
  person: { label: 'PERSON', bg: '#fce7f3', accent: '#d44470', number: '#9b2556' },
  project: { label: 'PROJECT', bg: '#dcfce7', accent: '#a1cf8e', number: '#3d8a50' },
  code: { label: 'CODE', bg: '#fef9c3', accent: '#d4ac0d', number: '#7a6200' },
  other: { label: 'OTHER', bg: '#f3f4f6', accent: '#9ca3af', number: '#4b5563' },
}

const CATEGORY_PREFIX: Record<KeywordCategory, string> = {
  company: 'COMPANY',
  person: 'PERSON',
  project: 'PROJECT',
  code: 'CODE',
  other: 'TERM',
}

function getAutoPlaceholder(category: KeywordCategory, index: number): string {
  return `[${CATEGORY_PREFIX[category]}_${(index + 1).toString()}]`
}

function getEffectivePlaceholder(entry: KeywordEntryFormInput, indexInCategory: number): string {
  return (
    entry.placeholder?.trim() ??
    getAutoPlaceholder(entry.category as KeywordCategory, indexInCategory)
  )
}

// ── Component ─────────────────────────────────────────────────────
export function KeywordProtectionField({ value, onChange }: KeywordProtectionFieldProps) {
  const [isOpen, setIsOpen] = useState(value.length > 0)
  const [internalKeywords, setInternalKeywords] = useState(value)

  // Add-form state
  const [addKeyword, setAddKeyword] = useState('')
  const [addCategory, setAddCategory] = useState<KeywordCategory>('company')
  const [addPlaceholder, setAddPlaceholder] = useState('')
  const [addError, setAddError] = useState('')

  function handleToggle() {
    const next = !isOpen
    setIsOpen(next)
    if (next) {
      onChange(internalKeywords)
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

    const entry: KeywordEntryFormInput = {
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
  const categoryCounts: Partial<Record<KeywordCategory, number>> = {}
  const keywordsWithPlaceholder = internalKeywords.map((entry) => {
    const cat = entry.category as KeywordCategory
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
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: isOpen ? '#ffe19a' : '#fffbeb',
          border: '3px solid #1a1a2e',
          borderRadius: 12,
          boxShadow: isOpen ? '4px 4px 0 #1a1a2e' : '3px 3px 0 #1a1a2e',
          cursor: 'pointer',
          transform: isOpen ? 'translate(-1px,-1px)' : 'none',
          transition: 'all 0.12s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              borderRadius: 10,
              border: '2px solid #1a1a2e',
              background: '#ffe19a',
              boxShadow: '2px 2px 0 #1a1a2e',
              fontSize: '1rem',
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
                  gridTemplateColumns: '32px 1fr 120px 120px 32px',
                  gap: 8,
                  padding: '4px 8px 6px',
                  borderBottom: '2px solid #1a1a2e',
                  marginBottom: 4,
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
              {keywordsWithPlaceholder.map((entry, index) => {
                const cat = entry.category as KeywordCategory
                const cfg = CATEGORY_CONFIG[cat]
                return (
                  <div
                    key={`${entry.keyword}-${index.toString()}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '32px 1fr 120px 120px 32px',
                      gap: 8,
                      alignItems: 'center',
                      padding: '7px 8px',
                      background: cfg.bg,
                      borderRadius: 8,
                      border: '1.5px solid rgba(26,26,46,0.12)',
                      marginBottom: 4,
                    }}
                  >
                    {/* Row number */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        border: '2px solid #1a1a2e',
                        background: cfg.number,
                        color: '#fff',
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        boxShadow: '2px 2px 0 #1a1a2e',
                        flexShrink: 0,
                      }}
                    >
                      {index + 1}
                    </span>

                    {/* Keyword */}
                    <span
                      style={{
                        fontFamily: 'var(--font-heading, inherit)',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: '#1a1a2e',
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
                        padding: '2px 8px',
                        border: '2px solid #1a1a2e',
                        borderRadius: 999,
                        background: cfg.accent,
                        boxShadow: '2px 2px 0 #1a1a2e',
                        fontFamily: 'var(--font-heading, inherit)',
                        fontSize: '0.6rem',
                        fontWeight: 800,
                        color: '#1a1a2e',
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
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: '#1a1a2e',
                        padding: '2px 6px',
                        border: '2px solid #1a1a2e',
                        borderRadius: 6,
                        background: '#fff',
                        boxShadow: '2px 2px 0 #1a1a2e',
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
                        width: 24,
                        height: 24,
                        border: '2px solid #1a1a2e',
                        borderRadius: 6,
                        background: '#fff',
                        boxShadow: '2px 2px 0 #1a1a2e',
                        cursor: 'pointer',
                        color: '#d44470',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        flexShrink: 0,
                      }}
                      aria-label={`Remove keyword ${entry.keyword}`}
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add form */}
          <div
            style={{
              border: '2px solid rgba(26,26,46,0.25)',
              borderRadius: 10,
              padding: 12,
              background: '#fffbeb',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-heading, inherit)',
                fontSize: '0.65rem',
                fontWeight: 800,
                color: '#6b7280',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              Add Keyword
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 12 }}>
              {/* Keyword input */}
              <input
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
                style={{
                  padding: '10px 16px',
                  border: '2px solid #1a1a2e',
                  borderRadius: 8,
                  background: '#fff',
                  boxShadow: '3px 3px 0 #1a1a2e',
                  fontFamily: 'var(--font-ui-body, inherit)',
                  fontSize: '0.8rem',
                  color: '#1a1a2e',
                  outline: 'none',
                }}
              />

              {/* Category dropdown with BrutalSelect */}
              <div style={{ minWidth: 0 }}>
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
                    setAddCategory(e.target.value as KeywordCategory)
                  }}
                  colorVariant="peach"
                />
              </div>
            </div>

            {/* Second row: Placeholder and Add button */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 12,
                marginTop: 12,
              }}
            >
              {/* Custom placeholder input (optional, dashed) */}
              <input
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
                style={{
                  padding: '10px 16px',
                  border: '2px dashed #1a1a2e',
                  borderRadius: 8,
                  background: '#fff',
                  boxShadow: '3px 3px 0 #1a1a2e',
                  fontFamily: 'monospace',
                  fontSize: '0.72rem',
                  color: '#1a1a2e',
                  outline: 'none',
                }}
              />

              {/* Add button */}
              <button
                type="button"
                onClick={handleAdd}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  border: '2px solid #1a1a2e',
                  borderRadius: 8,
                  background: '#6e77e5',
                  boxShadow: '3px 3px 0 #1a1a2e',
                  fontFamily: 'var(--font-heading, inherit)',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  lineHeight: 1,
                  color: '#fff',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'transform 0.1s ease, box-shadow 0.1s ease',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget
                  el.style.transform = 'translate(-2px,-2px)'
                  el.style.boxShadow = '5px 5px 0 #1a1a2e'
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget
                  el.style.transform = 'none'
                  el.style.boxShadow = '3px 3px 0 #1a1a2e'
                }}
              >
                <Icon name="plus" variant="clay" size={18} aria-hidden />
                Add
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
