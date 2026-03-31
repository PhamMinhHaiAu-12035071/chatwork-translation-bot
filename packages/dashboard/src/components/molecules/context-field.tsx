import { useState } from 'react'
import { CONTEXT_TEMPLATES } from '~/lib/context-templates'

interface ContextFieldProps {
  value: string
  onChange: (value: string) => void
  error?: string
}

export function ContextField({ value, onChange, error }: ContextFieldProps) {
  const [isOpen, setIsOpen] = useState(value.length > 0)
  const [activeKey, setActiveKey] = useState<string | null>(null)

  const charCount = value.length
  const charPct = Math.min((charCount / 500) * 100, 100)
  const isNearLimit = charCount > 450

  function handleLoadTemplate(key: string, body: string) {
    onChange(body)
    setActiveKey(key)
  }

  function handleClear() {
    onChange('')
    setActiveKey(null)
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value)
    setActiveKey(null)
  }

  return (
    <div>
      {/* Collapsible trigger */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen)
        }}
        className={[
          'brutal-button w-full px-4 py-3',
          'flex items-center justify-between gap-3 text-left',
          isOpen ? 'border-[var(--accent)] bg-[var(--card-lilac)]' : '',
        ].join(' ')}
        style={isOpen ? { boxShadow: '4px 4px 0 var(--accent)' } : {}}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] border-2 border-[var(--border)] text-sm"
            style={{
              background: 'linear-gradient(180deg,#fde7b7 0%,#f5c34b 100%)',
              boxShadow: '2px 2px 0 var(--border)',
            }}
            aria-hidden
          >
            🧠
          </span>
          <span className="flex flex-col">
            <span className="font-heading text-sm font-extrabold text-[var(--text-primary)]">
              Translation Context
            </span>
            <span className="font-ui-body text-xs text-[var(--text-secondary)]">
              {isOpen ? 'Editing room context' : 'Add context to improve translations'}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isOpen && charCount > 0 ? (
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
              {charCount} / 500
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
          <span
            className="flex h-6 w-7 items-center justify-center rounded-lg border-2 border-[var(--border)] text-[10px]"
            style={{
              background: 'linear-gradient(168deg,#fff 0%,#f3f1ff 42%,#e2def8 100%)',
              boxShadow:
                'inset 1px 2px 4px rgba(255,255,255,0.78),inset -1px -2px 4px rgba(90,80,160,0.09),2px 2px 0 var(--border)',
              transform: isOpen ? 'rotate(180deg)' : undefined,
              transition: 'transform 200ms ease',
            }}
            aria-hidden
          >
            ▾
          </span>
        </div>
      </button>

      {/* Expanded panel */}
      {isOpen && (
        <div className="mt-2.5 rounded-2xl border-2 border-dashed border-[rgba(26,26,46,0.35)] bg-white/50 p-3.5">
          <div className="grid grid-cols-[1.5fr_1fr] gap-3.5">
            {/* Left: editor */}
            <div className="flex flex-col gap-1.5">
              <label className="font-ui-body block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                Context
              </label>
              <textarea
                className={[
                  'brutal-input h-28 w-full resize-none px-4 py-3',
                  'font-ui-body text-sm text-[var(--text-primary)]',
                  'placeholder:text-[var(--text-secondary)] placeholder:opacity-50',
                  error ? 'brutal-input-error' : '',
                ].join(' ')}
                value={value}
                onChange={handleTextareaChange}
                maxLength={500}
                placeholder="Select a template → or write directly here…"
              />
              {/* char bar */}
              <div className="flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-[rgba(26,26,46,0.1)]">
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{
                      width: `${charPct.toString()}%`,
                      background: 'linear-gradient(90deg,#6dd4ad 0%,#ffe19a 60%,#f07ca6 100%)',
                    }}
                  />
                </div>
                <span
                  className={`font-metric text-xs font-medium whitespace-nowrap ${isNearLimit ? 'text-[var(--error)]' : 'text-[var(--text-secondary)]'}`}
                >
                  {charCount} / 500
                </span>
              </div>
              {charCount > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="font-ui-body self-start text-xs text-[var(--text-secondary)] underline underline-offset-2 opacity-70 hover:opacity-100"
                >
                  ✕ Clear
                </button>
              )}
              {error ? <p className="font-ui-body text-xs text-[var(--error)]">{error}</p> : null}
            </div>

            {/* Right: template gallery */}
            <div>
              <p className="font-ui-body mb-2 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                ⚡ Quick templates
              </p>
              <div className="flex flex-col gap-1.5">
                {CONTEXT_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.key}
                    type="button"
                    onClick={() => {
                      handleLoadTemplate(tpl.key, tpl.body)
                    }}
                    className="flex items-center gap-2 rounded-xl border-[2.5px] border-[var(--border)] bg-white/85 px-2.5 py-2 text-left"
                    style={
                      activeKey === tpl.key
                        ? {
                            background: 'linear-gradient(180deg,#dddcff 0%,#c8c5ff 100%)',
                            borderColor: 'var(--accent)',
                            boxShadow: '3px 3px 0 var(--accent)',
                          }
                        : { boxShadow: '3px 3px 0 var(--border)' }
                    }
                  >
                    <span className="flex-shrink-0 text-sm leading-none" aria-hidden>
                      {tpl.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-heading block text-[0.72rem] font-extrabold text-[var(--text-primary)]">
                        {tpl.name}
                      </span>
                      <span className="font-ui-body block truncate text-[0.62rem] text-[var(--text-secondary)]">
                        {tpl.description}
                      </span>
                    </span>
                    {activeKey === tpl.key && (
                      <span className="flex-shrink-0 text-xs font-bold text-[var(--accent)]">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="font-ui-body mt-3 flex items-start gap-2 rounded-xl border-2 border-dashed border-[rgba(110,119,229,0.4)] bg-[rgba(228,219,255,0.4)] px-3 py-2 text-xs leading-relaxed text-[var(--text-secondary)]">
            <span aria-hidden>💡</span>
            <span>Context được đính vào system prompt cho mọi bản dịch của room này.</span>
          </p>
        </div>
      )}
    </div>
  )
}
