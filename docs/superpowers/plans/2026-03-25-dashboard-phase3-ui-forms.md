# Dashboard Phase 3: UI Forms — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all mock/placeholder content in the 4 dashboard pages with real interactive forms, a live Zustand store with mock seed data, a reusable toast system, and an interactive webhook stepper — all validated with React Hook Form + Zod, styled in the existing Neubrutalism+Glassmorphism design language.

**Architecture:** Introduce a typed Zustand store (`room-store.ts`) seeded with mock rooms. Add shared form primitives (`BrutalInput`, `BrutalSelect`, `BrutalToast`) that follow the `brutal-surface` + hard-shadow token system already established by `BrutalCard`. Pages consume the store and form primitives; no API calls are made — all mutations operate against in-memory state only. The webhook guide becomes a stateful stepper component driven by local `useState`.

**Tech Stack:** React Hook Form, @hookform/resolvers/zod, Zod, Zustand v5, Framer Motion, React Router v7, bun:test

**Spec:** `docs/superpowers/specs/2026-03-25-dashboard-multi-room-design.md`

**Ship & Review:** `bun run dev:dashboard` → user tests forms, validation errors, enable/disable toggles, delete buttons, webhook guide stepper, copy-to-clipboard, and toast notifications.

---

## File Map

| File                                                       | Action | Responsibility                                                                  |
| ---------------------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| `packages/dashboard/package.json`                          | Modify | Add `react-hook-form`, `@hookform/resolvers`, `zod` runtime deps                |
| `packages/dashboard/src/stores/room-store.ts`              | Modify | Full typed store: `Room` type, mock seed data, add/update/delete/toggle actions |
| `packages/dashboard/src/lib/room-schema.ts`                | Create | Zod schemas for create/edit forms and webhook activation                        |
| `packages/dashboard/src/lib/provider-models.ts`            | Create | Static provider→model map used by form selects                                  |
| `packages/dashboard/src/components/ui/brutal-input.tsx`    | Create | Neubrutalism-styled text/password/number `<input>` wrapper                      |
| `packages/dashboard/src/components/ui/brutal-select.tsx`   | Create | Neubrutalism-styled `<select>` wrapper                                          |
| `packages/dashboard/src/components/ui/brutal-toast.tsx`    | Create | Framer Motion toast with success/error variants                                 |
| `packages/dashboard/src/components/ui/toast-provider.tsx`  | Create | Context + `useToast` hook, renders `BrutalToast` stack                          |
| `packages/dashboard/src/components/ui/webhook-stepper.tsx` | Create | Interactive 6-step stepper with Copy-to-clipboard on Step 3                     |
| `packages/dashboard/src/pages/room-list.tsx`               | Modify | Replace mocks with real room cards from store, enable/disable toggle, delete    |
| `packages/dashboard/src/pages/room-create.tsx`             | Modify | Replace `MockField`s with RHF form, Zod validation, store dispatch, redirect    |
| `packages/dashboard/src/pages/room-detail.tsx`             | Modify | Replace mocks with edit form + Webhook Activation section                       |
| `packages/dashboard/src/pages/webhook-guide.tsx`           | Modify | Replace static cards with `WebhookStepper` component                            |
| `packages/dashboard/src/main.tsx`                          | Modify | Wrap app in `ToastProvider`                                                     |
| `packages/dashboard/src/phase3-forms.test.tsx`             | Create | bun:test — Zod schema validation + store actions + component behaviour          |

---

## Task 1: Install dependencies

**Files:**

- Modify: `packages/dashboard/package.json`

- [ ] **Step 1: Add form and validation deps to `packages/dashboard/package.json`**

```json
{
  "name": "@chatwork-bot/dashboard",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint \"src/**/*.{ts,tsx}\"",
    "lint:fix": "eslint \"src/**/*.{ts,tsx}\" --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx,json,md}\"",
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.9.0",
    "framer-motion": "^12.6.3",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-hook-form": "^7.54.0",
    "react-router": "^7.0.0",
    "zod": "^3.23.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Install deps**

```bash
cd packages/dashboard && bun install
```

---

## Task 2: Typed Zustand store with mock seed data

**Files:**

- Modify: `packages/dashboard/src/stores/room-store.ts`

- [ ] **Step 1: Replace the stub store with a fully typed store and mock seed data**

```typescript
import { create } from 'zustand'

export type TranslationStyle =
  | 'AUTO_CONTEXT'
  | 'NATURAL_CASUAL'
  | 'PROFESSIONAL_BUSINESS'
  | 'TECHNICAL'

export type AiProvider = 'openai' | 'gemini'

export interface Room {
  id: string
  originalRoomId: number
  destinationRoomName: string
  aiProvider: AiProvider
  aiModel: string | null
  translationStyle: TranslationStyle
  aiApiToken: string
  webhookToken: string | null
  enabled: boolean
  createdAt: string
}

interface RoomStore {
  rooms: Room[]
  addRoom: (room: Omit<Room, 'id' | 'webhookToken' | 'enabled' | 'createdAt'>) => string
  updateRoom: (id: string, patch: Partial<Omit<Room, 'id' | 'createdAt'>>) => void
  deleteRoom: (id: string) => void
  toggleRoom: (id: string) => void
  activateWebhook: (id: string, webhookToken: string) => void
}

const MOCK_ROOMS: Room[] = [
  {
    id: 'room-001',
    originalRoomId: 123456789,
    destinationRoomName: 'Sakura Desk JP',
    aiProvider: 'openai',
    aiModel: 'gpt-4o',
    translationStyle: 'PROFESSIONAL_BUSINESS',
    aiApiToken: 'sk-live-mock-001',
    webhookToken: 'cw-token-abc123',
    enabled: true,
    createdAt: '2026-03-20T09:00:00Z',
  },
  {
    id: 'room-002',
    originalRoomId: 987654321,
    destinationRoomName: 'Gamma Team EN',
    aiProvider: 'gemini',
    aiModel: null,
    translationStyle: 'TECHNICAL',
    aiApiToken: 'gemini-mock-002',
    webhookToken: null,
    enabled: false,
    createdAt: '2026-03-22T14:30:00Z',
  },
]

export const useRoomStore = create<RoomStore>()((set) => ({
  rooms: MOCK_ROOMS,

  addRoom: (data) => {
    const id = `room-${Date.now()}`
    set((state) => ({
      rooms: [
        ...state.rooms,
        {
          ...data,
          id,
          webhookToken: null,
          enabled: false,
          createdAt: new Date().toISOString(),
        },
      ],
    }))
    return id
  },

  updateRoom: (id, patch) =>
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })),

  deleteRoom: (id) =>
    set((state) => ({
      rooms: state.rooms.filter((r) => r.id !== id),
    })),

  toggleRoom: (id) =>
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    })),

  activateWebhook: (id, webhookToken) =>
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === id ? { ...r, webhookToken, enabled: true } : r)),
    })),
}))
```

---

## Task 3: Zod schemas and provider→model map

**Files:**

- Create: `packages/dashboard/src/lib/room-schema.ts`
- Create: `packages/dashboard/src/lib/provider-models.ts`

- [ ] **Step 1: Create `packages/dashboard/src/lib/room-schema.ts`**

```typescript
import { z } from 'zod'

export const TRANSLATION_STYLES = [
  'AUTO_CONTEXT',
  'NATURAL_CASUAL',
  'PROFESSIONAL_BUSINESS',
  'TECHNICAL',
] as const

export const AI_PROVIDERS = ['openai', 'gemini'] as const

export const roomCreateSchema = z.object({
  originalRoomId: z
    .number({ required_error: 'Room ID is required' })
    .int('Room ID must be a whole number')
    .positive('Room ID must be positive'),
  destinationRoomName: z
    .string({ required_error: 'Destination room name is required' })
    .min(1, 'Destination room name is required')
    .max(100, 'Max 100 characters'),
  aiProvider: z.enum(AI_PROVIDERS, { required_error: 'AI Provider is required' }),
  aiModel: z.string().nullable().optional(),
  translationStyle: z.enum(TRANSLATION_STYLES, {
    required_error: 'Translation style is required',
  }),
  aiApiToken: z
    .string({ required_error: 'AI API token is required' })
    .min(1, 'AI API token is required'),
})

export type RoomCreateInput = z.infer<typeof roomCreateSchema>

export const roomEditSchema = roomCreateSchema

export type RoomEditInput = z.infer<typeof roomEditSchema>

export const webhookActivationSchema = z.object({
  webhookToken: z
    .string({ required_error: 'Webhook token is required' })
    .min(1, 'Webhook token is required'),
})

export type WebhookActivationInput = z.infer<typeof webhookActivationSchema>
```

- [ ] **Step 2: Create `packages/dashboard/src/lib/provider-models.ts`**

```typescript
import type { AiProvider } from '~/stores/room-store'

export interface ModelOption {
  value: string
  label: string
}

export const PROVIDER_MODELS: Record<AiProvider, ModelOption[]> = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
  gemini: [
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  ],
}

export const TRANSLATION_STYLE_LABELS: Record<string, string> = {
  AUTO_CONTEXT: 'Auto Context',
  NATURAL_CASUAL: 'Natural Casual',
  PROFESSIONAL_BUSINESS: 'Professional Business',
  TECHNICAL: 'Technical',
}

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  openai: 'OpenAI',
  gemini: 'Google Gemini',
}
```

---

## Task 4: Neubrutalism form primitive components

**Files:**

- Create: `packages/dashboard/src/components/ui/brutal-input.tsx`
- Create: `packages/dashboard/src/components/ui/brutal-select.tsx`

- [ ] **Step 1: Create `packages/dashboard/src/components/ui/brutal-input.tsx`**

```typescript
import type { InputHTMLAttributes } from 'react'
import { forwardRef } from 'react'

interface BrutalInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string
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
            'font-body text-sm text-[var(--text-primary)] shadow-[3px_3px_0_var(--border)]',
            'placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1',
            'transition-shadow duration-150',
            error ? 'border-red-500 shadow-[3px_3px_0_#ef4444]' : '',
            className ?? '',
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        />
        {hint && !error && (
          <p className="text-xs leading-5 text-[var(--text-secondary)]">{hint}</p>
        )}
        {error && <p className="text-xs leading-5 text-red-500">{error}</p>}
      </div>
    )
  },
)

BrutalInput.displayName = 'BrutalInput'
```

- [ ] **Step 2: Create `packages/dashboard/src/components/ui/brutal-select.tsx`**

```typescript
import type { SelectHTMLAttributes } from 'react'
import { forwardRef } from 'react'

interface SelectOption {
  value: string
  label: string
}

interface BrutalSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  options: SelectOption[]
  placeholder?: string
  hint?: string
  error?: string
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
            'font-body text-sm text-[var(--text-primary)] shadow-[3px_3px_0_var(--border)]',
            'focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1',
            'transition-shadow duration-150',
            error ? 'border-red-500 shadow-[3px_3px_0_#ef4444]' : '',
            className ?? '',
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {hint && !error && (
          <p className="text-xs leading-5 text-[var(--text-secondary)]">{hint}</p>
        )}
        {error && <p className="text-xs leading-5 text-red-500">{error}</p>}
      </div>
    )
  },
)

BrutalSelect.displayName = 'BrutalSelect'
```

---

## Task 5: Toast notification system

**Files:**

- Create: `packages/dashboard/src/components/ui/brutal-toast.tsx`
- Create: `packages/dashboard/src/components/ui/toast-provider.tsx`
- Modify: `packages/dashboard/src/main.tsx`

- [ ] **Step 1: Create `packages/dashboard/src/components/ui/brutal-toast.tsx`**

```typescript
import { motion } from 'framer-motion'

export type ToastVariant = 'success' | 'error'

export interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
}

interface BrutalToastProps {
  item: ToastItem
  onDismiss: (id: string) => void
}

const variantStyles: Record<ToastVariant, string> = {
  success: 'bg-[var(--success)] text-[var(--border)] border-[var(--border)]',
  error: 'bg-red-100 text-red-800 border-red-500',
}

const variantIcon: Record<ToastVariant, string> = {
  success: '✓',
  error: '✕',
}

export function BrutalToast({ item, onDismiss }: BrutalToastProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={[
        'flex items-center gap-3 rounded-[14px] border-[3px] px-5 py-3',
        'shadow-[4px_4px_0_var(--border)] font-body text-sm font-semibold',
        variantStyles[item.variant],
      ].join(' ')}
    >
      <span className="font-heading text-base font-extrabold">{variantIcon[item.variant]}</span>
      <span>{item.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className="ml-auto opacity-60 hover:opacity-100"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </motion.div>
  )
}
```

- [ ] **Step 2: Create `packages/dashboard/src/components/ui/toast-provider.tsx`**

```typescript
import { AnimatePresence } from 'framer-motion'
import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { BrutalToast } from '~/components/ui/brutal-toast'
import type { ToastItem, ToastVariant } from '~/components/ui/brutal-toast'

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setItems((prev) => [...prev, { id, message, variant }])
    setTimeout(() => dismiss(id), 4000)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        <AnimatePresence mode="popLayout">
          {items.map((item) => (
            <div key={item.id} className="pointer-events-auto">
              <BrutalToast item={item} onDismiss={dismiss} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
```

- [ ] **Step 3: Wrap app with `ToastProvider` in `packages/dashboard/src/main.tsx`**

Read `main.tsx` first, then wrap `<RouterProvider>` inside `<ToastProvider>`:

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { ToastProvider } from '~/components/ui/toast-provider'
import { router } from '~/router'
import '~/styles/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  </StrictMode>,
)
```

---

## Task 6: Webhook Stepper component

**Files:**

- Create: `packages/dashboard/src/components/ui/webhook-stepper.tsx`

- [ ] **Step 1: Create `packages/dashboard/src/components/ui/webhook-stepper.tsx`**

```typescript
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { BrutalCard } from '~/components/ui/brutal-card'
import { StickerLabel } from '~/components/ui/sticker-label'
import { StatusPill } from '~/components/ui/status-pill'

interface WebhookStepperProps {
  webhookUrl?: string
}

interface Step {
  number: string
  title: string
  body: string
  action?: 'link' | 'copy' | 'none'
  actionLabel?: string
}

const STEPS: Step[] = [
  {
    number: '01',
    title: 'Access Chatwork Admin',
    body: 'Log in to your Chatwork account. Open the Admin panel and navigate to Integrations → Webhooks.',
    action: 'link',
    actionLabel: 'Open Chatwork Admin →',
  },
  {
    number: '02',
    title: 'Create New Webhook',
    body: 'Click "Add webhook". Give it a descriptive name — for example, the room name you are setting up — so you can recognise it later.',
    action: 'none',
  },
  {
    number: '03',
    title: 'Paste Webhook URL',
    body: 'Copy the URL below and paste it into the "Webhook URL" field in the Chatwork form.',
    action: 'copy',
    actionLabel: 'Copy URL',
  },
  {
    number: '04',
    title: 'Select Events',
    body: 'Tick "Message created" and "Message updated". Enter the original Room ID in the room filter so Chatwork only fires events for that room.',
    action: 'none',
  },
  {
    number: '05',
    title: 'Save & Copy Token',
    body: 'Click Save. Chatwork will display a webhook token only once. Copy it immediately — you will paste it into the dashboard in the next step.',
    action: 'none',
  },
  {
    number: '06',
    title: 'Activate on Dashboard',
    body: 'Return to the room detail page. Paste the Chatwork webhook token into the Activation section and click "Activate Webhook". The room will go live.',
    action: 'none',
  },
]

const cardThemes = [
  'theme-card-matcha',
  'theme-card-cream',
  'theme-card-sky',
  'theme-card-matcha',
  'theme-card-cream',
  'theme-card-blush',
]

const tiltsByIndex: Array<'left' | 'right' | 'flat'> = [
  'left',
  'right',
  'flat',
  'left',
  'right',
  'right',
]

export function WebhookStepper({ webhookUrl }: WebhookStepperProps) {
  const [activeStep, setActiveStep] = useState(0)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const url = webhookUrl ?? 'https://your-server.example.com/webhook'
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Step indicator pills */}
      <div className="flex flex-wrap gap-2">
        {STEPS.map((step, index) => (
          <button
            key={step.number}
            type="button"
            onClick={() => setActiveStep(index)}
            className={[
              'rounded-full border-[3px] border-[var(--border)] px-4 py-1.5',
              'font-heading text-xs font-bold shadow-[3px_3px_0_var(--border)] transition-all duration-150',
              index === activeStep
                ? 'bg-[var(--accent)] text-white shadow-[3px_3px_0_var(--border)]'
                : index < activeStep
                  ? 'bg-[var(--success)] text-[var(--border)]'
                  : 'bg-white/80 text-[var(--text-primary)]',
            ].join(' ')}
          >
            {index < activeStep ? '✓' : step.number}
          </button>
        ))}
      </div>

      {/* Active step card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeStep}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <BrutalCard
            className={[cardThemes[activeStep], 'space-y-4'].join(' ')}
            tilt={tiltsByIndex[activeStep]}
          >
            <div className="flex flex-wrap items-center gap-3">
              <StickerLabel
                tone={activeStep === 5 ? 'accent' : 'warning'}
                tilt={activeStep % 2 === 0 ? 'left' : 'right'}
              >
                {`Step ${STEPS[activeStep].number}`}
              </StickerLabel>
              {activeStep < STEPS.length - 1 && (
                <StatusPill tone="neutral">{`${activeStep + 1} of ${STEPS.length}`}</StatusPill>
              )}
              {activeStep === STEPS.length - 1 && (
                <StatusPill tone="success">Final step</StatusPill>
              )}
            </div>

            <div className="space-y-2">
              <h2 className="font-heading text-2xl font-bold">{STEPS[activeStep].title}</h2>
              <p className="text-sm leading-7 text-[var(--text-secondary)]">
                {STEPS[activeStep].body}
              </p>
            </div>

            {/* Step-specific action areas */}
            {activeStep === 0 && (
              <a
                href="https://www.chatwork.com/service/packages/chatwork/admin/webhook.php"
                target="_blank"
                rel="noopener noreferrer"
                className="brutal-button theme-button-violet inline-flex items-center px-5 py-2.5 font-heading text-sm font-bold text-white"
              >
                {STEPS[0].actionLabel}
              </a>
            )}

            {activeStep === 2 && (
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-[14px] border-[3px] border-[var(--border)] bg-white/80 px-4 py-2.5 shadow-[3px_3px_0_var(--border)]">
                  <code className="flex-1 truncate font-body text-xs text-[var(--text-primary)]">
                    {webhookUrl ?? 'https://your-server.example.com/webhook'}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={[
                      'brutal-button shrink-0 px-4 py-1.5 font-heading text-xs font-bold',
                      copied ? 'theme-button-gold' : 'theme-button-violet text-white',
                    ].join(' ')}
                  >
                    {copied ? 'Copied!' : 'Copy URL'}
                  </button>
                </div>
              </div>
            )}
          </BrutalCard>
        </motion.div>
      </AnimatePresence>

      {/* Prev / Next navigation */}
      <div className="flex justify-between">
        <button
          type="button"
          disabled={activeStep === 0}
          onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
          className="brutal-button theme-button-warm px-5 py-2.5 font-heading text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Previous
        </button>
        {activeStep < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setActiveStep((s) => Math.min(STEPS.length - 1, s + 1))}
            className="brutal-button theme-button-violet px-5 py-2.5 font-heading text-sm font-bold text-white"
          >
            Next →
          </button>
        ) : (
          <StatusPill tone="success">All steps complete ✓</StatusPill>
        )}
      </div>
    </div>
  )
}
```

---

## Task 7: Room List page with real data

**Files:**

- Modify: `packages/dashboard/src/pages/room-list.tsx`

- [ ] **Step 1: Replace mock content with real room cards from the Zustand store**

```typescript
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router'
import { BrutalCard } from '~/components/ui/brutal-card'
import { PageShell } from '~/components/ui/page-shell'
import { StatusPill } from '~/components/ui/status-pill'
import { StickerLabel } from '~/components/ui/sticker-label'
import { useToast } from '~/components/ui/toast-provider'
import { PROVIDER_LABELS, TRANSLATION_STYLE_LABELS } from '~/lib/provider-models'
import { useRoomStore } from '~/stores/room-store'

const cardThemeByIndex = [
  'theme-card-lilac',
  'theme-card-matcha',
  'theme-card-cream',
  'theme-card-sky',
  'theme-card-peach',
  'theme-card-blush',
]

export function RoomListPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const rooms = useRoomStore((s) => s.rooms)
  const toggleRoom = useRoomStore((s) => s.toggleRoom)
  const deleteRoom = useRoomStore((s) => s.deleteRoom)

  const activeCount = rooms.filter((r) => r.enabled).length
  const pendingWebhook = rooms.filter((r) => !r.webhookToken).length

  const handleToggle = (id: string, currentlyEnabled: boolean) => {
    toggleRoom(id)
    toast(currentlyEnabled ? 'Room disabled' : 'Room enabled')
  }

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    deleteRoom(id)
    toast(`Room "${name}" deleted`)
  }

  return (
    <PageShell
      eyebrow="Room Dashboard"
      title="Translation Rooms"
      description="Manage all your Chatwork translation rooms. Toggle to pause, or set up a new webhook from the guide."
      actions={
        <>
          <button
            type="button"
            onClick={() => navigate('/rooms/new')}
            className="brutal-button theme-button-violet px-5 py-3 font-heading text-sm font-bold text-white"
          >
            + New Room
          </button>
          <button
            type="button"
            onClick={() => navigate('/guide')}
            className="brutal-button theme-button-warm px-5 py-3 font-heading text-sm font-bold text-white"
          >
            Webhook Guide
          </button>
        </>
      }
    >
      {/* Summary stats */}
      <div className="grid gap-4 xl:grid-cols-3">
        {[
          {
            label: 'Total Rooms',
            value: String(rooms.length),
            tone: 'accent' as const,
            theme: 'theme-card-lilac',
            tilt: 'left' as const,
          },
          {
            label: 'Active',
            value: String(activeCount),
            tone: 'success' as const,
            theme: 'theme-card-mint',
            tilt: 'flat' as const,
          },
          {
            label: 'Awaiting Webhook',
            value: String(pendingWebhook),
            tone: 'warning' as const,
            theme: 'theme-card-butter',
            tilt: 'right' as const,
          },
        ].map((stat) => (
          <BrutalCard key={stat.label} tilt={stat.tilt} className={[stat.theme, 'space-y-3'].join(' ')}>
            <StickerLabel tone={stat.tone}>{stat.label}</StickerLabel>
            <div className="font-heading text-4xl font-extrabold">{stat.value}</div>
          </BrutalCard>
        ))}
      </div>

      {/* Room list or empty state */}
      {rooms.length === 0 ? (
        <BrutalCard className="theme-card-sky space-y-5">
          <StatusPill tone="warning">Empty State</StatusPill>
          <div className="space-y-3">
            <h2 className="font-heading text-3xl font-bold">Create your first translation room</h2>
            <p className="max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
              Set up your Chatwork source room, choose an AI provider, and configure translation
              preferences to get started.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/rooms/new')}
            className="brutal-button theme-button-violet px-5 py-3 font-heading text-sm font-bold text-white"
          >
            + Create First Room
          </button>
        </BrutalCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room, index) => (
            <motion.div
              key={room.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18, delay: index * 0.04 }}
            >
              <BrutalCard
                className={[cardThemeByIndex[index % cardThemeByIndex.length], 'space-y-4'].join(' ')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="font-heading text-lg font-bold leading-tight">
                      {room.destinationRoomName}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      Room ID: {room.originalRoomId}
                    </div>
                  </div>
                  <StatusPill tone={room.enabled ? 'success' : 'neutral'}>
                    {room.enabled ? 'Live' : 'Paused'}
                  </StatusPill>
                </div>

                <div className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                  <div>
                    <span className="font-semibold">Provider: </span>
                    {PROVIDER_LABELS[room.aiProvider]}
                    {room.aiModel ? ` · ${room.aiModel}` : ' · default model'}
                  </div>
                  <div>
                    <span className="font-semibold">Style: </span>
                    {TRANSLATION_STYLE_LABELS[room.translationStyle] ?? room.translationStyle}
                  </div>
                  {!room.webhookToken && (
                    <StatusPill tone="warning">Webhook not configured</StatusPill>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => navigate(`/rooms/${room.id}`)}
                    className="brutal-button theme-button-sky px-4 py-1.5 font-heading text-xs font-bold text-[var(--border)]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggle(room.id, room.enabled)}
                    className={[
                      'brutal-button px-4 py-1.5 font-heading text-xs font-bold',
                      room.enabled
                        ? 'theme-button-gold text-[var(--border)]'
                        : 'theme-button-violet text-white',
                    ].join(' ')}
                  >
                    {room.enabled ? 'Pause' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(room.id, room.destinationRoomName)}
                    className="brutal-button theme-button-pink px-4 py-1.5 font-heading text-xs font-bold text-[#fff7ed]"
                  >
                    Delete
                  </button>
                </div>
              </BrutalCard>
            </motion.div>
          ))}
        </div>
      )}
    </PageShell>
  )
}
```

---

## Task 8: Room Create page with React Hook Form

**Files:**

- Modify: `packages/dashboard/src/pages/room-create.tsx`

- [ ] **Step 1: Replace MockFields with a real validated form**

```typescript
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { BrutalCard } from '~/components/ui/brutal-card'
import { BrutalInput } from '~/components/ui/brutal-input'
import { BrutalSelect } from '~/components/ui/brutal-select'
import { PageShell } from '~/components/ui/page-shell'
import { StickerLabel } from '~/components/ui/sticker-label'
import { useToast } from '~/components/ui/toast-provider'
import {
  PROVIDER_LABELS,
  PROVIDER_MODELS,
  TRANSLATION_STYLE_LABELS,
} from '~/lib/provider-models'
import { AI_PROVIDERS, TRANSLATION_STYLES, roomCreateSchema } from '~/lib/room-schema'
import type { RoomCreateInput } from '~/lib/room-schema'
import { useRoomStore } from '~/stores/room-store'

const providerOptions = AI_PROVIDERS.map((p) => ({ value: p, label: PROVIDER_LABELS[p] }))

const styleOptions = TRANSLATION_STYLES.map((s) => ({
  value: s,
  label: TRANSLATION_STYLE_LABELS[s] ?? s,
}))

export function RoomCreatePage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const addRoom = useRoomStore((s) => s.addRoom)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RoomCreateInput>({
    resolver: zodResolver(roomCreateSchema),
    defaultValues: {
      aiProvider: 'openai',
      translationStyle: 'PROFESSIONAL_BUSINESS',
      aiModel: null,
    },
  })

  const selectedProvider = watch('aiProvider')
  const modelOptions = selectedProvider
    ? [
        { value: '', label: 'Default model' },
        ...PROVIDER_MODELS[selectedProvider].map((m) => ({ value: m.value, label: m.label })),
      ]
    : [{ value: '', label: 'Default model' }]

  // Reset model when provider changes
  useEffect(() => {
    setValue('aiModel', null)
  }, [selectedProvider, setValue])

  const onSubmit = (data: RoomCreateInput) => {
    const newId = addRoom({
      ...data,
      aiModel: data.aiModel || null,
    })
    toast('Room created successfully!')
    navigate(`/rooms/${newId}`)
  }

  return (
    <PageShell
      eyebrow="New Room"
      title="Set up a translation room"
      description="Configure the Chatwork source room, AI provider, and translation preferences. Webhook activation happens after saving."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.8fr)]">
          <BrutalCard className="theme-card-cream space-y-5">
            <StickerLabel tone="accent">Room Configuration</StickerLabel>
            <div className="grid gap-5 md:grid-cols-2">
              <BrutalInput
                label="Original Room ID"
                type="number"
                hint="The numeric ID of the source Chatwork room."
                error={errors.originalRoomId?.message}
                {...register('originalRoomId', { valueAsNumber: true })}
              />
              <BrutalInput
                label="Destination Room Name"
                type="text"
                hint="Internal name for the translated output room."
                error={errors.destinationRoomName?.message}
                {...register('destinationRoomName')}
              />
              <BrutalSelect
                label="AI Provider"
                options={providerOptions}
                hint="Choose which AI service handles translations."
                error={errors.aiProvider?.message}
                {...register('aiProvider')}
              />
              <BrutalSelect
                label="AI Model"
                options={modelOptions}
                hint="Leave blank to use the provider default."
                error={errors.aiModel?.message}
                {...register('aiModel')}
              />
              <BrutalSelect
                label="Translation Style"
                options={styleOptions}
                hint="Controls the tone and formality of output."
                error={errors.translationStyle?.message}
                {...register('translationStyle')}
              />
              <BrutalInput
                label="AI API Token"
                type="password"
                hint="Your provider API key. Stored in memory only."
                error={errors.aiApiToken?.message}
                {...register('aiApiToken')}
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="brutal-button theme-button-violet px-6 py-3 font-heading text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Creating…' : 'Create Room'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="brutal-button theme-button-warm px-6 py-3 font-heading text-sm font-bold text-white"
              >
                Cancel
              </button>
            </div>
          </BrutalCard>

          <div className="space-y-6">
            <BrutalCard className="theme-card-matcha space-y-3" tilt="left">
              <StickerLabel tone="warning">Manual Step Required</StickerLabel>
              <p className="text-sm leading-7 text-[var(--text-secondary)]">
                After creating the room you will need to configure a Chatwork webhook and paste the
                token into the dashboard to go live.
              </p>
              <button
                type="button"
                onClick={() => navigate('/guide')}
                className="brutal-button theme-button-sky px-4 py-2 font-heading text-xs font-bold text-[var(--border)]"
              >
                Open Webhook Guide →
              </button>
            </BrutalCard>

            <BrutalCard className="theme-card-lilac space-y-3" tilt="right">
              <StickerLabel tone="success" tilt="right">
                Tip
              </StickerLabel>
              <p className="text-sm leading-7 text-[var(--text-secondary)]">
                The AI API token is kept in browser memory only. No data leaves your browser until
                the API integration is wired up in Phase 5.
              </p>
            </BrutalCard>
          </div>
        </div>
      </form>
    </PageShell>
  )
}
```

---

## Task 9: Room Detail page with edit form and webhook activation

**Files:**

- Modify: `packages/dashboard/src/pages/room-detail.tsx`

- [ ] **Step 1: Replace mocks with an edit form and the Webhook Activation section**

```typescript
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router'
import { BrutalCard } from '~/components/ui/brutal-card'
import { BrutalInput } from '~/components/ui/brutal-input'
import { BrutalSelect } from '~/components/ui/brutal-select'
import { PageShell } from '~/components/ui/page-shell'
import { StatusPill } from '~/components/ui/status-pill'
import { StickerLabel } from '~/components/ui/sticker-label'
import { useToast } from '~/components/ui/toast-provider'
import {
  PROVIDER_LABELS,
  PROVIDER_MODELS,
  TRANSLATION_STYLE_LABELS,
} from '~/lib/provider-models'
import {
  AI_PROVIDERS,
  TRANSLATION_STYLES,
  roomEditSchema,
  webhookActivationSchema,
} from '~/lib/room-schema'
import type { RoomEditInput, WebhookActivationInput } from '~/lib/room-schema'
import { useRoomStore } from '~/stores/room-store'

const providerOptions = AI_PROVIDERS.map((p) => ({ value: p, label: PROVIDER_LABELS[p] }))
const styleOptions = TRANSLATION_STYLES.map((s) => ({
  value: s,
  label: TRANSLATION_STYLE_LABELS[s] ?? s,
}))

function generateWebhookUrl(roomId: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://your-server.example.com'
  return `${base}/api/webhook?room_id=${roomId}`
}

export function RoomDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const room = useRoomStore((s) => s.rooms.find((r) => r.id === id))
  const updateRoom = useRoomStore((s) => s.updateRoom)
  const activateWebhook = useRoomStore((s) => s.activateWebhook)

  const editForm = useForm<RoomEditInput>({
    resolver: zodResolver(roomEditSchema),
    defaultValues: room
      ? {
          originalRoomId: room.originalRoomId,
          destinationRoomName: room.destinationRoomName,
          aiProvider: room.aiProvider,
          aiModel: room.aiModel,
          translationStyle: room.translationStyle,
          aiApiToken: room.aiApiToken,
        }
      : undefined,
  })

  const activationForm = useForm<WebhookActivationInput>({
    resolver: zodResolver(webhookActivationSchema),
  })

  const selectedProvider = editForm.watch('aiProvider')
  const modelOptions = selectedProvider
    ? [
        { value: '', label: 'Default model' },
        ...PROVIDER_MODELS[selectedProvider].map((m) => ({ value: m.value, label: m.label })),
      ]
    : [{ value: '', label: 'Default model' }]

  useEffect(() => {
    editForm.setValue('aiModel', null)
  }, [selectedProvider, editForm])

  const [copied, setCopied] = useState(false)

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!room) {
    return (
      <PageShell eyebrow="Not Found" title="Room not found" description="">
        <BrutalCard className="theme-card-peach space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            No room with ID <code>{id}</code> was found.
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="brutal-button theme-button-violet px-5 py-2.5 font-heading text-sm font-bold text-white"
          >
            ← Back to Dashboard
          </button>
        </BrutalCard>
      </PageShell>
    )
  }

  const webhookUrl = generateWebhookUrl(room.originalRoomId.toString())

  const onEditSubmit = (data: RoomEditInput) => {
    updateRoom(room.id, { ...data, aiModel: data.aiModel || null })
    toast('Room updated successfully!')
  }

  const onActivateSubmit = (data: WebhookActivationInput) => {
    activateWebhook(room.id, data.webhookToken)
    toast('Webhook activated! Room is now live.')
    activationForm.reset()
  }

  return (
    <PageShell
      eyebrow="Room Detail"
      title={room.destinationRoomName}
      description="Edit room configuration or complete webhook activation to go live."
      actions={
        <StatusPill tone={room.enabled ? 'success' : 'warning'}>
          {room.enabled ? 'Live' : 'Inactive'}
        </StatusPill>
      }
    >
      <form onSubmit={editForm.handleSubmit(onEditSubmit)} noValidate>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <BrutalCard className="theme-card-sky space-y-5" tilt="left">
            <div className="flex flex-wrap items-center gap-3">
              <StickerLabel tone="accent">Room Config</StickerLabel>
              <code className="rounded-full border-[3px] border-[var(--border)] bg-white px-4 py-2 text-sm shadow-[3px_3px_0_var(--border)]">
                {id}
              </code>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <BrutalInput
                label="Original Room ID"
                type="number"
                error={editForm.formState.errors.originalRoomId?.message}
                {...editForm.register('originalRoomId', { valueAsNumber: true })}
              />
              <BrutalInput
                label="Destination Room Name"
                type="text"
                error={editForm.formState.errors.destinationRoomName?.message}
                {...editForm.register('destinationRoomName')}
              />
              <BrutalSelect
                label="AI Provider"
                options={providerOptions}
                error={editForm.formState.errors.aiProvider?.message}
                {...editForm.register('aiProvider')}
              />
              <BrutalSelect
                label="AI Model"
                options={modelOptions}
                error={editForm.formState.errors.aiModel?.message}
                {...editForm.register('aiModel')}
              />
              <BrutalSelect
                label="Translation Style"
                options={styleOptions}
                error={editForm.formState.errors.translationStyle?.message}
                {...editForm.register('translationStyle')}
              />
              <BrutalInput
                label="AI API Token"
                type="password"
                hint="Leave unchanged to keep the existing token."
                error={editForm.formState.errors.aiApiToken?.message}
                {...editForm.register('aiApiToken')}
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                className="brutal-button theme-button-violet px-6 py-3 font-heading text-sm font-bold text-white"
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="brutal-button theme-button-warm px-6 py-3 font-heading text-sm font-bold text-white"
              >
                ← Back
              </button>
            </div>
          </BrutalCard>

          {/* Webhook Activation Panel */}
          <div className="space-y-5">
            <BrutalCard className="theme-card-peach space-y-4" tilt="right">
              <StickerLabel tone={room.webhookToken ? 'success' : 'warning'} tilt="right">
                {room.webhookToken ? 'Webhook Active' : 'Webhook Activation'}
              </StickerLabel>

              {/* Generated URL + copy */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                  Webhook URL
                </div>
                <div className="flex items-center gap-2 rounded-[14px] border-[3px] border-[var(--border)] bg-white/80 px-4 py-2.5 shadow-[3px_3px_0_var(--border)]">
                  <code className="flex-1 truncate text-xs text-[var(--text-primary)]">
                    {webhookUrl}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className={[
                      'brutal-button shrink-0 px-3 py-1 font-heading text-xs font-bold',
                      copied ? 'theme-button-gold' : 'theme-button-sky text-[var(--border)]',
                    ].join(' ')}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <p className="text-sm leading-7 text-[var(--text-secondary)]">
                {room.webhookToken
                  ? 'Webhook token is configured. Room is active.'
                  : 'Paste the Chatwork webhook token below to activate translation.'}
              </p>

              <button
                type="button"
                onClick={() => navigate('/guide')}
                className="brutal-button theme-button-sky px-4 py-2 font-heading text-xs font-bold text-[var(--border)]"
              >
                View Webhook Guide →
              </button>
            </BrutalCard>

            <BrutalCard className="theme-card-cream space-y-4">
              <form onSubmit={activationForm.handleSubmit(onActivateSubmit)} noValidate>
                <div className="space-y-4">
                  <BrutalInput
                    label="Webhook Token"
                    type="password"
                    hint="The token shown by Chatwork after saving the webhook."
                    error={activationForm.formState.errors.webhookToken?.message}
                    {...activationForm.register('webhookToken')}
                  />
                  <button
                    type="submit"
                    className="brutal-button theme-button-violet w-full py-3 font-heading text-sm font-bold text-white"
                  >
                    Activate Webhook
                  </button>
                </div>
              </form>
            </BrutalCard>
          </div>
        </div>
      </form>
    </PageShell>
  )
}
```

Note: `useState` needs to be added to the import from `react` at the top of this file.

- [ ] **Step 2: Fix the `useState` import at the top of `room-detail.tsx`**

The final import block for `room-detail.tsx` should include `useState`:

```typescript
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router'
// ... rest of imports unchanged
```

---

## Task 10: Webhook Guide page with interactive stepper

**Files:**

- Modify: `packages/dashboard/src/pages/webhook-guide.tsx`

- [ ] **Step 1: Replace static step cards with `WebhookStepper`**

```typescript
import { BrutalCard } from '~/components/ui/brutal-card'
import { PageShell } from '~/components/ui/page-shell'
import { StickerLabel } from '~/components/ui/sticker-label'
import { WebhookStepper } from '~/components/ui/webhook-stepper'

export function WebhookGuidePage() {
  return (
    <PageShell
      eyebrow="Manual Guide"
      title="Webhook Setup Guide"
      description="Follow these six steps to connect your Chatwork room to the translation bot. Complete each step before moving on."
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
        <BrutalCard className="theme-card-cream space-y-5">
          <StickerLabel tone="accent">Step-by-Step</StickerLabel>
          <WebhookStepper />
        </BrutalCard>

        <div className="space-y-5">
          <BrutalCard className="theme-card-sky space-y-3" tilt="right">
            <StickerLabel tone="warning" tilt="right">
              Why manual?
            </StickerLabel>
            <p className="text-sm leading-7 text-[var(--text-secondary)]">
              Chatwork webhooks require operator-level access to the Chatwork Admin panel. The
              dashboard cannot create them on your behalf — this is a Chatwork API limitation.
            </p>
          </BrutalCard>

          <BrutalCard className="theme-card-matcha space-y-3" tilt="left">
            <StickerLabel tone="success">One-time setup</StickerLabel>
            <p className="text-sm leading-7 text-[var(--text-secondary)]">
              Once the webhook token is pasted into the Activation section of a room, no further
              manual steps are needed. Translation runs automatically.
            </p>
          </BrutalCard>
        </div>
      </div>
    </PageShell>
  )
}
```

---

## Task 11: Tests

**Files:**

- Create: `packages/dashboard/src/phase3-forms.test.tsx`

- [ ] **Step 1: Create `packages/dashboard/src/phase3-forms.test.tsx`**

```typescript
import { describe, expect, it, beforeEach } from 'bun:test'
import { roomCreateSchema, roomEditSchema, webhookActivationSchema } from '~/lib/room-schema'
import { useRoomStore } from '~/stores/room-store'

// ── Zod schema validation ───────────────────────────────────────────────────

describe('roomCreateSchema', () => {
  it('accepts a fully valid input', () => {
    const result = roomCreateSchema.safeParse({
      originalRoomId: 123456789,
      destinationRoomName: 'Sakura Desk',
      aiProvider: 'openai',
      aiModel: 'gpt-4o',
      translationStyle: 'PROFESSIONAL_BUSINESS',
      aiApiToken: 'sk-live-abc',
    })
    expect(result.success).toBe(true)
  })

  it('accepts null aiModel (use provider default)', () => {
    const result = roomCreateSchema.safeParse({
      originalRoomId: 123,
      destinationRoomName: 'Test',
      aiProvider: 'gemini',
      aiModel: null,
      translationStyle: 'TECHNICAL',
      aiApiToken: 'tok',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a non-positive Room ID', () => {
    const result = roomCreateSchema.safeParse({
      originalRoomId: -1,
      destinationRoomName: 'Test',
      aiProvider: 'openai',
      aiModel: null,
      translationStyle: 'TECHNICAL',
      aiApiToken: 'tok',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.originalRoomId).toBeDefined()
    }
  })

  it('rejects an empty destinationRoomName', () => {
    const result = roomCreateSchema.safeParse({
      originalRoomId: 1,
      destinationRoomName: '',
      aiProvider: 'openai',
      aiModel: null,
      translationStyle: 'TECHNICAL',
      aiApiToken: 'tok',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.destinationRoomName).toBeDefined()
    }
  })

  it('rejects an invalid aiProvider', () => {
    const result = roomCreateSchema.safeParse({
      originalRoomId: 1,
      destinationRoomName: 'X',
      aiProvider: 'anthropic',
      aiModel: null,
      translationStyle: 'TECHNICAL',
      aiApiToken: 'tok',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid translationStyle', () => {
    const result = roomCreateSchema.safeParse({
      originalRoomId: 1,
      destinationRoomName: 'X',
      aiProvider: 'openai',
      aiModel: null,
      translationStyle: 'SLANG',
      aiApiToken: 'tok',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty aiApiToken', () => {
    const result = roomCreateSchema.safeParse({
      originalRoomId: 1,
      destinationRoomName: 'X',
      aiProvider: 'openai',
      aiModel: null,
      translationStyle: 'TECHNICAL',
      aiApiToken: '',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.aiApiToken).toBeDefined()
    }
  })

  it('rejects a fractional Room ID', () => {
    const result = roomCreateSchema.safeParse({
      originalRoomId: 1.5,
      destinationRoomName: 'X',
      aiProvider: 'openai',
      aiModel: null,
      translationStyle: 'TECHNICAL',
      aiApiToken: 'tok',
    })
    expect(result.success).toBe(false)
  })

  it('accepts all four translation styles', () => {
    const styles = ['AUTO_CONTEXT', 'NATURAL_CASUAL', 'PROFESSIONAL_BUSINESS', 'TECHNICAL'] as const
    for (const style of styles) {
      const result = roomCreateSchema.safeParse({
        originalRoomId: 1,
        destinationRoomName: 'Test',
        aiProvider: 'openai',
        aiModel: null,
        translationStyle: style,
        aiApiToken: 'tok',
      })
      expect(result.success).toBe(true)
    }
  })
})

describe('webhookActivationSchema', () => {
  it('accepts a non-empty token', () => {
    const result = webhookActivationSchema.safeParse({ webhookToken: 'cw-abc123' })
    expect(result.success).toBe(true)
  })

  it('rejects an empty token', () => {
    const result = webhookActivationSchema.safeParse({ webhookToken: '' })
    expect(result.success).toBe(false)
  })
})

describe('roomEditSchema is identical to roomCreateSchema', () => {
  it('parses the same valid input', () => {
    const input = {
      originalRoomId: 42,
      destinationRoomName: 'Edit Room',
      aiProvider: 'gemini' as const,
      aiModel: null,
      translationStyle: 'AUTO_CONTEXT' as const,
      aiApiToken: 'tok-xyz',
    }
    expect(roomCreateSchema.safeParse(input).success).toBe(true)
    expect(roomEditSchema.safeParse(input).success).toBe(true)
  })
})

// ── Zustand store actions ───────────────────────────────────────────────────

describe('useRoomStore', () => {
  it('starts with the two mock seed rooms', () => {
    const { rooms } = useRoomStore.getState()
    expect(rooms.length).toBe(2)
  })

  it('addRoom appends a new room with correct defaults', () => {
    const { addRoom } = useRoomStore.getState()
    const id = addRoom({
      originalRoomId: 999,
      destinationRoomName: 'New Test',
      aiProvider: 'openai',
      aiModel: null,
      translationStyle: 'TECHNICAL',
      aiApiToken: 'sk-test',
    })
    const { rooms } = useRoomStore.getState()
    const newRoom = rooms.find((r) => r.id === id)
    expect(newRoom).toBeDefined()
    expect(newRoom?.enabled).toBe(false)
    expect(newRoom?.webhookToken).toBeNull()
    expect(newRoom?.destinationRoomName).toBe('New Test')
  })

  it('toggleRoom flips the enabled flag', () => {
    const { rooms, toggleRoom } = useRoomStore.getState()
    const first = rooms[0]
    const before = first.enabled
    toggleRoom(first.id)
    const after = useRoomStore.getState().rooms.find((r) => r.id === first.id)?.enabled
    expect(after).toBe(!before)
    // reset
    toggleRoom(first.id)
  })

  it('updateRoom patches fields without touching other fields', () => {
    const { rooms, updateRoom } = useRoomStore.getState()
    const target = rooms[0]
    updateRoom(target.id, { destinationRoomName: 'Patched Name' })
    const updated = useRoomStore.getState().rooms.find((r) => r.id === target.id)
    expect(updated?.destinationRoomName).toBe('Patched Name')
    expect(updated?.aiProvider).toBe(target.aiProvider)
  })

  it('deleteRoom removes the room by id', () => {
    const { addRoom, deleteRoom } = useRoomStore.getState()
    const id = addRoom({
      originalRoomId: 77777,
      destinationRoomName: 'Temp Room',
      aiProvider: 'gemini',
      aiModel: null,
      translationStyle: 'NATURAL_CASUAL',
      aiApiToken: 'tok',
    })
    deleteRoom(id)
    const after = useRoomStore.getState().rooms.find((r) => r.id === id)
    expect(after).toBeUndefined()
  })

  it('activateWebhook sets token and enables room', () => {
    const { rooms, activateWebhook } = useRoomStore.getState()
    const target = rooms.find((r) => !r.webhookToken) ?? rooms[1]
    activateWebhook(target.id, 'cw-new-token')
    const updated = useRoomStore.getState().rooms.find((r) => r.id === target.id)
    expect(updated?.webhookToken).toBe('cw-new-token')
    expect(updated?.enabled).toBe(true)
  })
})

// ── provider-models map ─────────────────────────────────────────────────────

describe('PROVIDER_MODELS', () => {
  it('openai has at least one model', async () => {
    const { PROVIDER_MODELS } = await import('~/lib/provider-models')
    expect(PROVIDER_MODELS.openai.length).toBeGreaterThan(0)
  })

  it('gemini has at least one model', async () => {
    const { PROVIDER_MODELS } = await import('~/lib/provider-models')
    expect(PROVIDER_MODELS.gemini.length).toBeGreaterThan(0)
  })

  it('each model entry has a non-empty value and label', async () => {
    const { PROVIDER_MODELS } = await import('~/lib/provider-models')
    for (const models of Object.values(PROVIDER_MODELS)) {
      for (const m of models) {
        expect(m.value.length).toBeGreaterThan(0)
        expect(m.label.length).toBeGreaterThan(0)
      }
    }
  })
})
```

---

## Task 12: Commit

- [ ] **Step 1: Commit all changes**

```bash
cd /path/to/repo
git add \
  packages/dashboard/package.json \
  packages/dashboard/src/stores/room-store.ts \
  packages/dashboard/src/lib/room-schema.ts \
  packages/dashboard/src/lib/provider-models.ts \
  packages/dashboard/src/components/ui/brutal-input.tsx \
  packages/dashboard/src/components/ui/brutal-select.tsx \
  packages/dashboard/src/components/ui/brutal-toast.tsx \
  packages/dashboard/src/components/ui/toast-provider.tsx \
  packages/dashboard/src/components/ui/webhook-stepper.tsx \
  packages/dashboard/src/pages/room-list.tsx \
  packages/dashboard/src/pages/room-create.tsx \
  packages/dashboard/src/pages/room-detail.tsx \
  packages/dashboard/src/pages/webhook-guide.tsx \
  packages/dashboard/src/main.tsx \
  packages/dashboard/src/phase3-forms.test.tsx

git commit -m "$(cat <<'EOF'
feat(dashboard): phase 3 — real forms, Zustand store, and interactive webhook guide

Replace all Phase 2 mock content with React Hook Form + Zod validated forms across
Room Create, Room Detail, and a live room list driven by a typed Zustand store with
mock seed data. Add BrutalInput/BrutalSelect primitives, a Framer Motion toast system,
and a 6-step interactive WebhookStepper with copy-to-clipboard. Phase 3 is client-side
only — no API calls.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Definition of Done

Run from the `packages/dashboard` directory:

```bash
bun test && bun run typecheck && bun run lint
```

Then verify manually via `bun run dev:dashboard`:

- Room List shows two seeded mock rooms with enable/disable toggles and delete buttons
- Toggling a room shows a Framer Motion toast notification
- Clicking "+ New Room" navigates to the create form
- Submitting the create form with empty fields shows inline Zod validation errors
- A valid create form submission adds a room, shows a success toast, and redirects to the detail page
- Room Detail shows the edit form pre-populated from the store
- The Webhook URL has a working Copy button
- Pasting a token and clicking Activate enables the room and shows a success toast
- Webhook Guide shows the interactive stepper with Prev/Next navigation, step completion indicators, and the copy-URL action on Step 3
