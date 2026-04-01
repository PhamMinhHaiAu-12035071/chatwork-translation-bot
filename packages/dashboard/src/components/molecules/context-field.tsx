import { useState, useRef, useEffect } from 'react'
import type { ChangeEvent, CSSProperties } from 'react'
import type { MotionStyle } from 'framer-motion'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Icon } from '~/components/atoms/icons'
import { CONTEXT_TEMPLATES } from '~/lib/context-templates'

interface ContextFieldProps {
  value: string
  onChange: (value: string) => void
  error?: string
}

const CANDY_PROGRESS_SEGMENTS = [
  { base: '#e63946', stripe: '#fff2f2', shadow: 'rgba(196, 57, 70, 0.32)' },
  { base: '#f77f00', stripe: '#fff4e9', shadow: 'rgba(212, 112, 0, 0.32)' },
  { base: '#fcbf49', stripe: '#fff9df', shadow: 'rgba(210, 165, 60, 0.3)' },
  { base: '#90be6d', stripe: '#f8fbdc', shadow: 'rgba(120, 160, 90, 0.3)' },
  { base: '#43aa8b', stripe: '#f3fff4', shadow: 'rgba(67, 140, 115, 0.28)' },
] as const

const TEMPLATE_MOTION_TONES = {
  client: {
    accent: '#d9a235',
    soft: 'rgb(255, 245, 220)',
    stripe: 'rgba(255, 255, 255, 0.5)',
    shadow: 'rgba(217, 162, 53, 0.3)',
    glow: 'transparent',
  },
  internal: {
    accent: '#5c8b52',
    soft: 'rgb(233, 250, 218)',
    stripe: 'rgba(255, 255, 255, 0.5)',
    shadow: 'rgba(92, 139, 82, 0.3)',
    glow: 'transparent',
  },
  tech: {
    accent: '#61b7e8',
    soft: 'rgb(213, 240, 255)',
    stripe: 'rgba(255, 255, 255, 0.5)',
    shadow: 'rgba(97, 183, 232, 0.3)',
    glow: 'transparent',
  },
  crossteam: {
    accent: '#6e77e5',
    soft: 'rgb(228, 219, 255)',
    stripe: 'rgba(255, 255, 255, 0.5)',
    shadow: 'rgba(110, 119, 229, 0.3)',
    glow: 'transparent',
  },
  exec: {
    accent: '#e8a065',
    soft: 'rgb(255, 228, 196)',
    stripe: 'rgba(255, 255, 255, 0.5)',
    shadow: 'rgba(232, 160, 101, 0.3)',
    glow: 'transparent',
  },
} as const

const DEFAULT_TEMPLATE_MOTION_TONE = {
  accent: '#6e77e5',
  soft: 'rgb(228, 219, 255)',
  stripe: 'rgba(255, 255, 255, 0.5)',
  shadow: 'rgba(110, 119, 229, 0.3)',
  glow: 'transparent',
} as const

function findTemplateForValue(value: string) {
  return CONTEXT_TEMPLATES.find((template) => template.body === value) ?? null
}

function getTemplateMotionTone(templateKey: string | null) {
  if (templateKey === null) {
    return DEFAULT_TEMPLATE_MOTION_TONE
  }

  if (templateKey in TEMPLATE_MOTION_TONES) {
    return TEMPLATE_MOTION_TONES[templateKey as keyof typeof TEMPLATE_MOTION_TONES]
  }

  return DEFAULT_TEMPLATE_MOTION_TONE
}

function renderCandyProgressSegments(layer: 'ghost' | 'filled') {
  return CANDY_PROGRESS_SEGMENTS.map((segment, index) => (
    <span
      key={`${layer}-${index.toString()}`}
      className="context-candy-progress-segment"
      data-candy-segment="true"
      aria-hidden="true"
      style={
        {
          '--candy-base': segment.base,
          '--candy-stripe': segment.stripe,
          '--candy-shadow': segment.shadow,
        } as CSSProperties
      }
    />
  ))
}

export function ContextField({ value, onChange, error }: ContextFieldProps) {
  const [isOpen, setIsOpen] = useState(value.length > 0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const shouldReduceMotion = useReducedMotion()
  const activeTemplate = findTemplateForValue(value)
  const activeTone = getTemplateMotionTone(activeTemplate?.key ?? null)

  // Auto-scroll khi mở để nhìn thấy toàn bộ expanded card (bao gồm mt-2.5)
  useEffect(() => {
    if (isOpen && panelRef.current) {
      // Delay để animation expand hoàn tất trước khi scroll
      const timer = setTimeout(() => {
        panelRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'end',
          inline: 'nearest',
        })
      }, 350)
      return () => {
        clearTimeout(timer)
      }
    }
  }, [isOpen])

  const charCount = value.length
  const charPct = Math.min((charCount / 500) * 100, 100)
  const isNearLimit = charCount > 450
  const progressStyle = {
    '--context-candy-progress': `${charPct.toString()}%`,
  } as CSSProperties
  const editorStyle = activeTemplate
    ? ({
        '--context-template-accent': activeTone.accent,
        '--context-template-soft': activeTone.soft,
        '--context-template-stripe': activeTone.stripe,
        '--context-template-shadow': activeTone.shadow,
        '--context-template-glow': activeTone.glow,
      } as CSSProperties)
    : ({} as CSSProperties)
  const sharedMotionTransition = shouldReduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 360, damping: 30, mass: 0.84 }

  function handleLoadTemplate(_key: string, body: string) {
    onChange(body)
  }

  function handleClear() {
    onChange('')
  }

  function handleTextareaChange(e: ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value)
  }

  return (
    <div ref={wrapperRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen)
        }}
        className={[
          'brutal-input w-full px-4 py-3',
          'flex items-center justify-between gap-3 text-left',
          'cursor-pointer',
        ].join(' ')}
        style={{
          background: isOpen ? '#b8c5ff' : '#f0f4ff',
          transition: 'all 0.12s ease',
          ...(isOpen
            ? {
                borderColor: '#6b7ae8',
                boxShadow: '5px 5px 0 #6b7ae8',
                transform: 'translate(-1px, -1px)',
              }
            : {}),
        }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] border-2 border-[var(--border)] text-sm"
            style={{
              background: 'var(--warning)',
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
          <span className="brutal-dropdown-chevron" data-open={isOpen ? 'true' : undefined}>
            <motion.span
              className="inline-flex will-change-transform"
              style={{ transformOrigin: '50% 55%' }}
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 520, damping: 34, mass: 0.55 }
              }
            >
              <Icon name="chevron-down" variant="stroke" size={14} aria-hidden />
            </motion.span>
          </span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{
              duration: 0.3,
              ease: [0.4, 0, 0.2, 1],
            }}
            className="overflow-hidden"
          >
            <div
              ref={panelRef}
              className="mt-2.5 rounded-2xl border-2 border-dashed border-[rgba(26,26,46,0.35)] bg-white/50 p-3.5"
            >
              <div className="grid grid-cols-[3fr_2fr] gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="font-ui-body block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                    Context
                  </label>
                  <div
                    className="context-editor-shell"
                    data-template-active={activeTemplate ? 'true' : undefined}
                    style={editorStyle}
                  >
                    <textarea
                      className={[
                        'brutal-input h-64 w-full resize-none overflow-hidden px-4 py-3',
                        'font-ui-body relative z-[2] text-sm text-[var(--text-primary)]',
                        'placeholder:text-[var(--text-secondary)] placeholder:opacity-50',
                        '',
                        error ? 'brutal-input-error' : '',
                      ].join(' ')}
                      value={value}
                      onChange={handleTextareaChange}
                      maxLength={500}
                      placeholder="Select a template → or write directly here…"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="context-candy-progress-track min-w-0 flex-1"
                      style={progressStyle}
                      role="progressbar"
                      aria-label="Translation context character usage"
                      aria-valuemin={0}
                      aria-valuemax={500}
                      aria-valuenow={charCount}
                    >
                      <div
                        className="context-candy-progress-layer context-candy-progress-layer--ghost"
                        data-candy-layer="ghost"
                      >
                        {renderCandyProgressSegments('ghost')}
                      </div>
                      <div
                        className="context-candy-progress-layer context-candy-progress-layer--filled"
                        data-candy-layer="filled"
                      >
                        {renderCandyProgressSegments('filled')}
                      </div>
                    </div>
                    <span
                      className={`font-metric w-[5.75rem] shrink-0 tabular-nums text-right text-xs font-medium whitespace-nowrap ${isNearLimit ? 'text-[var(--error)]' : 'text-[var(--text-secondary)]'}`}
                    >
                      {charCount} / 500
                    </span>
                  </div>
                  {charCount > 0 && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="brutal-clear-button self-start"
                      aria-label="Clear context"
                    >
                      <span style={{ fontSize: '0.85rem', lineHeight: 1 }}>✕</span>
                      Clear
                    </button>
                  )}
                  {error ? (
                    <p className="font-ui-body text-xs text-[var(--error)]">{error}</p>
                  ) : null}
                </div>

                <div>
                  <p className="font-ui-body mb-2 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                    ⚡ Quick templates
                  </p>
                  <div className="context-template-list-wrap">
                    <div className="context-template-list">
                      {CONTEXT_TEMPLATES.map((tpl) => {
                        const isActive = activeTemplate?.key === tpl.key
                        const tone = getTemplateMotionTone(tpl.key)
                        const templateStyle = {
                          '--template-accent': tone.accent,
                          '--template-soft': tone.soft,
                          '--template-stripe': tone.stripe,
                          '--template-shadow': tone.shadow,
                          '--template-glow': tone.glow,
                        } as MotionStyle

                        return (
                          <motion.button
                            layout
                            transition={sharedMotionTransition}
                            key={tpl.key}
                            type="button"
                            aria-pressed={isActive}
                            data-template-active={isActive ? 'true' : undefined}
                            onClick={() => {
                              handleLoadTemplate(tpl.key, tpl.body)
                            }}
                            className="context-template-card"
                            style={templateStyle}
                          >
                            <span className="context-template-icon" aria-hidden>
                              {tpl.icon}
                            </span>
                            <span className="context-template-copy min-w-0 flex-1">
                              <span className="font-heading block text-[0.9rem] font-extrabold text-[var(--text-primary)]">
                                {tpl.name}
                              </span>
                              <span className="font-ui-body block text-[0.72rem] text-[var(--text-secondary)]">
                                {tpl.description}
                              </span>
                            </span>
                            <AnimatePresence initial={false}>
                              {isActive ? (
                                <motion.span
                                  className="context-template-check"
                                  aria-hidden
                                  initial={
                                    shouldReduceMotion
                                      ? { opacity: 1, scale: 1 }
                                      : { opacity: 0, y: -8, scale: 0.62, rotate: -10 }
                                  }
                                  animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                                  exit={
                                    shouldReduceMotion
                                      ? { opacity: 0 }
                                      : { opacity: 0, y: -4, scale: 0.9 }
                                  }
                                  transition={
                                    shouldReduceMotion
                                      ? { duration: 0 }
                                      : { duration: 0.34, ease: [0.22, 1, 0.36, 1] }
                                  }
                                >
                                  ✓
                                </motion.span>
                              ) : null}
                            </AnimatePresence>
                          </motion.button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <p className="font-ui-body mt-3 flex items-start gap-2 rounded-xl border-2 border-dashed border-[rgba(110,119,229,0.4)] bg-[rgba(228,219,255,0.4)] px-3 py-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                <span aria-hidden>💡</span>
                <span>
                  This context will be included in the system prompt for every translation in this
                  room.
                </span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
