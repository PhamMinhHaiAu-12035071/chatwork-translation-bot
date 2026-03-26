# Dashboard Phase 2: Visual Design System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Apply the user-approved hybrid design direction to the existing dashboard skeleton so all 4 routes feel production-grade visually on `localhost:5173`, while keeping the phase strictly presentation-only.

**Architecture:** Keep the Phase 1 SPA structure intact and layer a reusable design system on top of it: global tokens in CSS, reusable presentational components in `src/components/ui/`, and layout/page refactors that consume those primitives. The visual composition, palette, glass cards, organic circles, and button treatment follow brainstorm `V3. Grandstander Glass — Elegant Brutal`, while the typography follows brainstorm `V5. Shantell Sans — Handwritten Pro` (`Shantell Sans` headings/labels + `Kiwi Maru` body). Add Framer Motion for page/card motion only; do not introduce real forms, API integration, or backend coupling in this phase.

**Tech Stack:** React 19, Vite 6, TailwindCSS v4, Framer Motion, React Router v7, TypeScript 5.4+ strict

**Spec:** `docs/superpowers/specs/2026-03-25-dashboard-multi-room-design.md`

**Phase Boundary:** This phase is visual only. No React Hook Form, no Zod form schemas, no real API calls, no Zustand logic changes beyond what already exists.

**Ship & Review:** `bun run dev:dashboard` → open `http://localhost:5173` → user sees V3 visual styling, V5 typography, animated transitions, and polished page shells on all 4 routes.

**Chosen Design Lock:**

- Visual source of truth: `.superpowers/brainstorm/10072-1774437025/design-v4-refined.html` → `V3. Grandstander Glass — Elegant Brutal`
- Typography source of truth: `.superpowers/brainstorm/10072-1774437025/design-v4-refined.html` → `V5. Shantell Sans — Handwritten Pro`
- Do **not** adopt Grandstander or Zen Maru Gothic in implementation
- Do **not** switch to the orange V5 visual palette; keep V3 palette and layout language
- Result required: V3 composition + V3 palette + V3 glassmorphism + V5 fonts

---

## File Map

| File                                                     | Action | Responsibility                                                       |
| -------------------------------------------------------- | ------ | -------------------------------------------------------------------- |
| `packages/dashboard/package.json`                        | Modify | Add `framer-motion` runtime dependency                               |
| `bun.lock`                                               | Modify | Lock dependency graph after install                                  |
| `packages/dashboard/src/styles/global.css`               | Modify | Design tokens, background, noise texture, scrollbar, utility classes |
| `packages/dashboard/src/components/ui/ambient-orbs.tsx`  | Create | Decorative pastel background elements                                |
| `packages/dashboard/src/components/ui/brutal-card.tsx`   | Create | Reusable glassmorphism + brutal border/shadow card                   |
| `packages/dashboard/src/components/ui/mock-field.tsx`    | Create | Static field shell for Phase 2 preview pages                         |
| `packages/dashboard/src/components/ui/page-shell.tsx`    | Create | Shared page header/content wrapper                                   |
| `packages/dashboard/src/components/ui/status-pill.tsx`   | Create | Visual status pill component                                         |
| `packages/dashboard/src/components/ui/sticker-label.tsx` | Create | Rotated sticker badge                                                |
| `packages/dashboard/src/layouts/app-layout.tsx`          | Modify | Elegant Brutal sidebar, animated route shell, ambient decoration     |
| `packages/dashboard/src/pages/room-list.tsx`             | Modify | Empty-state dashboard page with styled cards and CTA                 |
| `packages/dashboard/src/pages/room-create.tsx`           | Modify | Visual-only room setup shell                                         |
| `packages/dashboard/src/pages/room-detail.tsx`           | Modify | Styled room detail shell with webhook activation preview             |
| `packages/dashboard/src/pages/webhook-guide.tsx`         | Modify | 6-step visual webhook guide cards                                    |

---

## Task 1: Add motion dependency

**Files:**

- Modify: `packages/dashboard/package.json`
- Modify: `bun.lock`

- [ ] **Step 1: Add `framer-motion` to `packages/dashboard/package.json`**

Update dependencies:

```json
{
  "dependencies": {
    "framer-motion": "^12.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.0.0",
    "zustand": "^5.0.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `bun install`
Expected: `bun.lock` updated, no install errors.

- [ ] **Step 3: Verify dashboard still typechecks before styling work**

Run: `bun run --cwd packages/dashboard typecheck`
Expected: exits successfully.

- [ ] **Step 4: Commit dependency update**

```bash
git add packages/dashboard/package.json bun.lock
git commit -m "feat(dashboard): add motion dependency for phase 2"
```

---

## Task 2: Build the global visual system

**Files:**

- Modify: `packages/dashboard/src/styles/global.css`

- [ ] **Step 1: Replace the minimal stylesheet with design tokens and app chrome**

Implement a full stylesheet with:

- CSS variables from the V3/spec color palette
- `body` gradient background
- SVG noise overlay
- candy scrollbar styling
- reusable utility classes for brutal surfaces, stickers, buttons, and dashed panels
- motion-safe keyframes for floating orbs
- `Shantell Sans` for headings/labels/buttons and `Kiwi Maru` for body copy

Use this structure:

```css
@import 'tailwindcss';

:root {
  --bg-gradient-start: #fff0e5;
  --bg-gradient-end: #ffe8f5;
  --border: #1a1a2e;
  --accent: #d44470;
  --success: #7ec8a0;
  --warning: #ffd166;
  --error: #ff6b8a;
  --card-glass: rgba(255, 255, 255, 0.68);
  --text-primary: #1a1a2e;
  --text-secondary: #636e72;
  --organic-circle-1: #ffd1dc;
  --organic-circle-2: #e8deff;
  --organic-circle-3: #d4f5e9;
}

html {
  min-height: 100%;
  background: var(--bg-gradient-start);
}

body {
  min-height: 100vh;
  margin: 0;
  color: var(--text-primary);
  font-family: 'Kiwi Maru', serif;
  background:
    radial-gradient(circle at top left, rgba(255, 209, 220, 0.6), transparent 28%),
    radial-gradient(circle at top right, rgba(232, 222, 255, 0.55), transparent 24%),
    linear-gradient(135deg, var(--bg-gradient-start), var(--bg-gradient-end));
}

body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: 0.03;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 240 240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
  mix-blend-mode: multiply;
}

#root {
  isolation: isolate;
}

* {
  box-sizing: border-box;
}

*::-webkit-scrollbar {
  width: 16px;
  height: 16px;
}

*::-webkit-scrollbar-track {
  background: repeating-linear-gradient(
    -45deg,
    rgba(255, 209, 220, 0.5),
    rgba(255, 209, 220, 0.5) 10px,
    rgba(232, 222, 255, 0.5) 10px,
    rgba(232, 222, 255, 0.5) 20px
  );
  border-left: 2px solid var(--border);
}

*::-webkit-scrollbar-thumb {
  border: 2px solid var(--border);
  border-radius: 999px;
  background: linear-gradient(180deg, #ff9fbc, #d44470);
  box-shadow: 3px 3px 0 var(--border);
}

.font-heading {
  font-family: 'Shantell Sans', cursive;
}

.brutal-surface {
  border: 3px solid var(--border);
  border-radius: 18px;
  background: var(--card-glass);
  box-shadow: 5px 5px 0 var(--border);
  backdrop-filter: blur(8px);
}

.brutal-button {
  border: 3px solid var(--border);
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 4px 4px 0 var(--border);
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    background-color 160ms ease;
}

.brutal-button:hover {
  transform: translate(-2px, -2px);
  box-shadow: 7px 7px 0 var(--border);
}

.brutal-button:active {
  transform: translate(3px, 3px);
  box-shadow: 1px 1px 0 var(--border);
}

.sticker-label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 3px solid var(--border);
  border-radius: 999px;
  padding: 0.35rem 0.8rem;
  font-family: 'Shantell Sans', cursive;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  box-shadow: 3px 3px 0 var(--border);
  transform: rotate(-2deg);
}

.dashed-panel {
  border: 2px dashed rgba(26, 26, 46, 0.45);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.42);
}

@keyframes float-orb {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }
  50% {
    transform: translate3d(0, -10px, 0);
  }
}
```

- [ ] **Step 2: Build the dashboard package**

Run: `bun run --cwd packages/dashboard build`
Expected: Vite build succeeds and CSS compiles without syntax errors.

- [ ] **Step 3: Commit the global visual system**

```bash
git add packages/dashboard/src/styles/global.css
git commit -m "feat(dashboard): add elegant brutal global design tokens"
```

---

## Task 3: Create reusable presentation primitives

**Files:**

- Create: `packages/dashboard/src/components/ui/ambient-orbs.tsx`
- Create: `packages/dashboard/src/components/ui/brutal-card.tsx`
- Create: `packages/dashboard/src/components/ui/mock-field.tsx`
- Create: `packages/dashboard/src/components/ui/page-shell.tsx`
- Create: `packages/dashboard/src/components/ui/status-pill.tsx`
- Create: `packages/dashboard/src/components/ui/sticker-label.tsx`

- [ ] **Step 1: Create `sticker-label.tsx`**

```tsx
import type { ReactNode } from 'react'

interface StickerLabelProps {
  children: ReactNode
  tone?: 'accent' | 'success' | 'warning' | 'default'
}

const toneClassMap: Record<NonNullable<StickerLabelProps['tone']>, string> = {
  accent: 'bg-[var(--accent)] text-white',
  success: 'bg-[var(--success)] text-[var(--border)]',
  warning: 'bg-[var(--warning)] text-[var(--border)]',
  default: 'bg-white text-[var(--border)]',
}

export function StickerLabel({ children, tone = 'default' }: StickerLabelProps) {
  return <span className={['sticker-label', toneClassMap[tone]].join(' ')}>{children}</span>
}
```

- [ ] **Step 2: Create `status-pill.tsx`**

```tsx
interface StatusPillProps {
  children: string
  tone?: 'neutral' | 'accent' | 'success' | 'warning'
}

const toneClassMap: Record<NonNullable<StatusPillProps['tone']>, string> = {
  neutral: 'bg-white/80 text-[var(--text-primary)]',
  accent: 'bg-[var(--accent)] text-white',
  success: 'bg-[var(--success)] text-[var(--border)]',
  warning: 'bg-[var(--warning)] text-[var(--border)]',
}

export function StatusPill({ children, tone = 'neutral' }: StatusPillProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border-[3px] border-[var(--border)] px-3 py-1 text-xs font-semibold shadow-[3px_3px_0_var(--border)]',
        toneClassMap[tone],
      ].join(' ')}
    >
      {children}
    </span>
  )
}
```

- [ ] **Step 3: Create `brutal-card.tsx`**

```tsx
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface BrutalCardProps {
  children: ReactNode
  className?: string
}

export function BrutalCard({ children, className }: BrutalCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className={['brutal-surface p-5 md:p-6', className ?? ''].join(' ').trim()}
    >
      {children}
    </motion.section>
  )
}
```

- [ ] **Step 4: Create `ambient-orbs.tsx`**

```tsx
const orbClassNames = [
  'absolute left-[-4rem] top-12 h-28 w-28 rounded-full bg-[var(--organic-circle-1)]/70 blur-[2px]',
  'absolute right-16 top-28 h-20 w-20 rounded-full bg-[var(--organic-circle-2)]/70 blur-[1px]',
  'absolute bottom-10 right-[-2rem] h-32 w-32 rounded-full bg-[var(--organic-circle-3)]/65 blur-[2px]',
] as const

export function AmbientOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {orbClassNames.map((className) => (
        <div
          key={className}
          className={className}
          style={{ animation: 'float-orb 6s ease-in-out infinite' }}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Create `page-shell.tsx`**

```tsx
import type { ReactNode } from 'react'
import { StickerLabel } from '~/components/ui/sticker-label'

interface PageShellProps {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
  children: ReactNode
}

export function PageShell({ eyebrow, title, description, actions, children }: PageShellProps) {
  return (
    <div className="relative space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          <StickerLabel tone="warning">{eyebrow}</StickerLabel>
          <div className="space-y-2">
            <h1 className="font-heading text-3xl font-extrabold md:text-5xl">{title}</h1>
            <p className="max-w-2xl text-sm leading-7 text-[var(--text-secondary)] md:text-base">
              {description}
            </p>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
      {children}
    </div>
  )
}
```

- [ ] **Step 6: Create `mock-field.tsx`**

```tsx
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
```

- [ ] **Step 7: Verify the new primitives compile**

Run: `bun run --cwd packages/dashboard typecheck`
Expected: no TS errors from new component props/imports.

- [ ] **Step 8: Commit reusable UI primitives**

```bash
git add packages/dashboard/src/components/ui/
git commit -m "feat(dashboard): add elegant brutal UI primitives"
```

---

## Task 4: Refactor the application layout shell

**Files:**

- Modify: `packages/dashboard/src/layouts/app-layout.tsx`

- [ ] **Step 1: Replace the minimal sidebar layout with a branded shell**

Refactor the layout to:

- use `AmbientOrbs`
- render a branded sidebar card
- give nav items sticker-like active styling
- animate route content with Framer Motion
- keep the same 3 nav links from Phase 1
- preserve V3 glass-card composition, but render all headings/labels with V5 typography

Use this structure:

```tsx
import { motion } from 'framer-motion'
import { NavLink, Outlet, useLocation } from 'react-router'
import { AmbientOrbs } from '~/components/ui/ambient-orbs'
import { BrutalCard } from '~/components/ui/brutal-card'
import { StickerLabel } from '~/components/ui/sticker-label'

const navItems = [
  { to: '/', label: 'Dashboard', blurb: 'overview + empty state' },
  { to: '/rooms/new', label: '+ New Room', blurb: 'future creation flow' },
  { to: '/guide', label: 'Webhook Guide', blurb: 'manual setup steps' },
] as const

export function AppLayout() {
  const location = useLocation()

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-5 md:px-6 lg:px-8">
      <AmbientOrbs />

      <div className="relative mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <BrutalCard className="space-y-4">
            <StickerLabel tone="accent">Elegant Brutal</StickerLabel>
            <div className="space-y-3">
              <h1 className="font-heading text-3xl font-extrabold">Translation Bot</h1>
              <p className="text-sm leading-7 text-[var(--text-secondary)]">
                Multi-room dashboard shell for setup, guidance, and future activation flows.
              </p>
            </div>
          </BrutalCard>

          <nav className="space-y-3">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to}>
                {({ isActive }) => (
                  <motion.div
                    whileHover={{ x: -2, y: -2 }}
                    whileTap={{ x: 2, y: 2 }}
                    className={[
                      'brutal-surface p-4 transition-colors',
                      isActive ? 'bg-white' : 'bg-white/65',
                    ].join(' ')}
                  >
                    <div className="font-heading text-lg font-bold">{item.label}</div>
                    <div className="mt-1 text-sm text-[var(--text-secondary)]">{item.blurb}</div>
                  </motion.div>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>

        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative"
        >
          <div className="brutal-surface relative min-h-full overflow-hidden p-6 md:p-8">
            <Outlet />
          </div>
        </motion.main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run the dashboard in dev mode and visually confirm the shell**

Run: `bun run dev:dashboard`
Expected: sidebar is styled, page chrome is no longer plain white, route switches animate.

- [ ] **Step 3: Stop dev server and commit layout refactor**

```bash
git add packages/dashboard/src/layouts/app-layout.tsx
git commit -m "feat(dashboard): redesign dashboard app shell"
```

---

## Task 5: Redesign the room list page

**Files:**

- Modify: `packages/dashboard/src/pages/room-list.tsx`

- [ ] **Step 1: Replace the plain empty text with a polished empty-state dashboard**

Implement:

- page hero via `PageShell`
- two or three small stat cards
- one large empty-state card
- one CTA link to `/rooms/new`
- one support card linking to `/guide`

Use this structure:

```tsx
import { Link } from 'react-router'
import { BrutalCard } from '~/components/ui/brutal-card'
import { PageShell } from '~/components/ui/page-shell'
import { StatusPill } from '~/components/ui/status-pill'
import { StickerLabel } from '~/components/ui/sticker-label'

const previewStats = [
  { label: 'Rooms Active', value: '0', tone: 'warning' as const },
  { label: 'Webhook Ready', value: 'Manual setup', tone: 'neutral' as const },
  { label: 'AI Providers', value: 'OpenAI + Gemini', tone: 'accent' as const },
]

export function RoomListPage() {
  return (
    <PageShell
      eyebrow="Phase 2 Preview"
      title="Room Dashboard"
      description="This screen stays data-free in Phase 2. The goal here is to land the approved kawaii, glassy, brutal visual language before we wire real CRUD flows in Phase 3 and Phase 5."
      actions={
        <>
          <Link to="/rooms/new" className="brutal-button px-5 py-3 font-heading text-sm font-bold">
            Create Preview
          </Link>
          <Link
            to="/guide"
            className="brutal-button bg-[var(--warning)] px-5 py-3 font-heading text-sm font-bold"
          >
            Open Guide
          </Link>
        </>
      }
    >
      <div className="grid gap-4 xl:grid-cols-3">
        {previewStats.map((item) => (
          <BrutalCard key={item.label} className="space-y-3">
            <StickerLabel tone={item.tone === 'accent' ? 'accent' : 'warning'}>
              {item.label}
            </StickerLabel>
            <div className="font-heading text-4xl font-extrabold">{item.value}</div>
          </BrutalCard>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.8fr)]">
        <BrutalCard className="space-y-5">
          <StatusPill tone="warning">Empty State</StatusPill>
          <div className="space-y-3">
            <h2 className="font-heading text-3xl font-bold">Create your first translation room</h2>
            <p className="max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
              The system will eventually let Tech Leads and BPMs define source room settings,
              destination room naming, and translation preferences here.
            </p>
          </div>
          <div className="dashed-panel grid min-h-56 place-items-center p-6 text-center">
            <div className="space-y-3">
              <div className="text-6xl">+</div>
              <p className="text-sm leading-7 text-[var(--text-secondary)]">
                Decorative empty-state illustration only for Phase 2.
              </p>
            </div>
          </div>
        </BrutalCard>

        <BrutalCard className="space-y-4">
          <StickerLabel tone="success">Operator Note</StickerLabel>
          <p className="text-sm leading-7 text-[var(--text-secondary)]">
            Manual webhook setup remains part of the user journey, so the dashboard must keep a
            strong guidance surface instead of hiding that work.
          </p>
        </BrutalCard>
      </div>
    </PageShell>
  )
}
```

- [ ] **Step 2: Verify the empty-state page visually**

Run: `bun run dev:dashboard`
Expected: `/` looks like a designed dashboard, not a placeholder text page.

- [ ] **Step 3: Commit the room list redesign**

```bash
git add packages/dashboard/src/pages/room-list.tsx
git commit -m "feat(dashboard): style room dashboard empty state"
```

---

## Task 6: Redesign the create room page as a visual shell

**Files:**

- Modify: `packages/dashboard/src/pages/room-create.tsx`

- [ ] **Step 1: Convert the create page into a styled setup preview**

Implement a two-column layout with:

- page hero
- left column with static field shells
- right column with helper cards and setup reminders
- a visible note that the form becomes functional in Phase 3

Use this structure:

```tsx
import { BrutalCard } from '~/components/ui/brutal-card'
import { MockField } from '~/components/ui/mock-field'
import { PageShell } from '~/components/ui/page-shell'
import { StickerLabel } from '~/components/ui/sticker-label'

export function RoomCreatePage() {
  return (
    <PageShell
      eyebrow="Create Flow Preview"
      title="Set up a new translation room"
      description="Phase 2 locks the visual rhythm for cards, fields, labels, spacing, and helper callouts. Functional form controls arrive next phase."
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.8fr)]">
        <BrutalCard className="space-y-5">
          <StickerLabel tone="accent">Phase 3 Enables Real Inputs</StickerLabel>
          <div className="grid gap-4 md:grid-cols-2">
            <MockField
              label="Original Room ID"
              hint="Customer Chatwork room identifier."
              value="123456789"
            />
            <MockField
              label="Destination Room Name"
              hint="Internal translation room title."
              value="Project Sakura JP"
            />
            <MockField label="AI Provider" hint="Provider selector visual shell." value="OpenAI" />
            <MockField label="AI Model" hint="Model selector visual shell." value="gpt-4o" />
            <MockField
              label="Translation Style"
              hint="Profile selection card."
              value="Professional Business"
            />
            <MockField
              label="AI API Token"
              hint="Masked secret input preview."
              value="sk-live-••••••••"
            />
          </div>
        </BrutalCard>

        <div className="space-y-6">
          <BrutalCard className="space-y-3">
            <StickerLabel tone="warning">Manual Work</StickerLabel>
            <p className="text-sm leading-7 text-[var(--text-secondary)]">
              Users still need Chatwork room access and webhook setup outside the dashboard.
            </p>
          </BrutalCard>

          <BrutalCard className="space-y-3">
            <StickerLabel tone="success">Design Goal</StickerLabel>
            <p className="text-sm leading-7 text-[var(--text-secondary)]">
              This page should already feel trustworthy, feminine, and operational even before the
              inputs become live.
            </p>
          </BrutalCard>
        </div>
      </div>
    </PageShell>
  )
}
```

- [ ] **Step 2: Verify `/rooms/new` in the browser**

Run: `bun run dev:dashboard`
Expected: page looks like a polished setup form shell, but without real input behavior yet.

- [ ] **Step 3: Commit the create page shell**

```bash
git add packages/dashboard/src/pages/room-create.tsx
git commit -m "feat(dashboard): add room creation design shell"
```

---

## Task 7: Redesign the room detail page shell

**Files:**

- Modify: `packages/dashboard/src/pages/room-detail.tsx`

- [ ] **Step 1: Turn the room detail route into a polished activation preview**

Implement:

- room ID displayed as a sticker/status pair
- overview card
- webhook activation preview card
- notes about create → activate flow from the spec

Use this structure:

```tsx
import { useParams } from 'react-router'
import { BrutalCard } from '~/components/ui/brutal-card'
import { MockField } from '~/components/ui/mock-field'
import { PageShell } from '~/components/ui/page-shell'
import { StatusPill } from '~/components/ui/status-pill'
import { StickerLabel } from '~/components/ui/sticker-label'

export function RoomDetailPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <PageShell
      eyebrow="Activation Preview"
      title="Room detail"
      description="This page previews how operators will inspect a room config and complete webhook activation after the initial create step."
      actions={<StatusPill tone="warning">Draft Only</StatusPill>}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <BrutalCard className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <StickerLabel tone="accent">Room ID</StickerLabel>
            <code className="rounded-full border-[3px] border-[var(--border)] bg-white px-4 py-2 text-sm shadow-[3px_3px_0_var(--border)]">
              {id}
            </code>
          </div>
          <MockField
            label="Generated Webhook URL"
            hint="Will become copyable in Phase 3/5."
            value="https://example.com/webhook?room_id=123456789"
          />
          <MockField
            label="Destination Room"
            hint="System-created internal room preview."
            value="Project Sakura JP"
          />
        </BrutalCard>

        <BrutalCard className="space-y-4">
          <StickerLabel tone="warning">Create → Activate</StickerLabel>
          <p className="text-sm leading-7 text-[var(--text-secondary)]">
            The room stays disabled until the operator pastes the Chatwork webhook token back into
            the dashboard.
          </p>
          <MockField
            label="Webhook Token"
            hint="Visual-only secret field shell for this phase."
            value="cw-token-••••••"
          />
        </BrutalCard>
      </div>
    </PageShell>
  )
}
```

- [ ] **Step 2: Verify a dynamic detail route**

Run: `bun run dev:dashboard`
Expected: visiting `/rooms/demo-room` renders a fully styled page and still shows the dynamic route ID.

- [ ] **Step 3: Commit the room detail shell**

```bash
git add packages/dashboard/src/pages/room-detail.tsx
git commit -m "feat(dashboard): style room detail activation shell"
```

---

## Task 8: Redesign the webhook guide page

**Files:**

- Modify: `packages/dashboard/src/pages/webhook-guide.tsx`

- [ ] **Step 1: Turn the guide into a 6-step card-based walkthrough**

Implement a visual guide from the spec steps:

1. Access Chatwork Admin
2. Create New Webhook
3. Paste Webhook URL
4. Select Events
5. Save & Copy Token
6. Activate on Dashboard

Use a local array and map over it:

```tsx
import { BrutalCard } from '~/components/ui/brutal-card'
import { PageShell } from '~/components/ui/page-shell'
import { StickerLabel } from '~/components/ui/sticker-label'

const steps = [
  ['01', 'Access Chatwork Admin', 'Open Integrations and move to the webhook screen.'],
  [
    '02',
    'Create New Webhook',
    'Use a clear room-specific name so the operator recognizes it later.',
  ],
  [
    '03',
    'Paste Webhook URL',
    'The dashboard-generated URL will live here once activation becomes functional.',
  ],
  ['04', 'Select Events', 'Enable message created and message updated for the correct room.'],
  ['05', 'Save & Copy Token', 'Copy the Chatwork webhook token immediately after saving.'],
  [
    '06',
    'Activate on Dashboard',
    'Return to the room detail page and paste the token to enable translation.',
  ],
] as const

export function WebhookGuidePage() {
  return (
    <PageShell
      eyebrow="Manual Guide"
      title="Webhook Setup Guide"
      description="This page is intentionally instructional because webhook setup remains a human step in the product flow."
    >
      <div className="grid gap-4 xl:grid-cols-2">
        {steps.map(([index, title, body]) => (
          <BrutalCard key={index} className="space-y-4">
            <StickerLabel tone={index === '06' ? 'accent' : 'warning'}>Step {index}</StickerLabel>
            <div className="space-y-2">
              <h2 className="font-heading text-2xl font-bold">{title}</h2>
              <p className="text-sm leading-7 text-[var(--text-secondary)]">{body}</p>
            </div>
          </BrutalCard>
        ))}
      </div>
    </PageShell>
  )
}
```

- [ ] **Step 2: Verify `/guide` in the browser**

Run: `bun run dev:dashboard`
Expected: page reads like a friendly step-by-step operator guide, not a plain text stub.

- [ ] **Step 3: Commit the webhook guide redesign**

```bash
git add packages/dashboard/src/pages/webhook-guide.tsx
git commit -m "feat(dashboard): style webhook guide walkthrough"
```

---

## Task 9: Final verification and ship for review

- [ ] **Step 1: Run package build**

Run: `bun run --cwd packages/dashboard build`
Expected: production build succeeds.

- [ ] **Step 2: Run package-local quality checks**

Run: `bun run --cwd packages/dashboard typecheck && bun test packages/dashboard`
Expected: dashboard typecheck passes and existing smoke test still passes.

- [ ] **Step 3: Run full repo quality checks**

Run: `bun run typecheck && bun test && bun run lint`
Expected: all workspace checks pass.

- [ ] **Step 4: Start dev server for ship review**

Run: `bun run dev:dashboard`
Expected: app starts on `http://localhost:5173`.

- [ ] **Step 5: Manual verification checklist**

Open `http://localhost:5173` and verify:

1. `Dashboard` route shows an Elegant Brutal empty state instead of plain text.
2. `+ New Room` route looks like a polished form shell with six mock fields.
3. `Webhook Guide` route shows six styled instruction cards.
4. Visiting `/rooms/test-123` shows a styled room detail shell and still renders `test-123`.
5. Background uses the peach → pink gradient and decorative pastel orbs.
6. Typography uses Shantell Sans for headings and Kiwi Maru for body text.
7. Scrollbar is visibly customized.
8. Hovering nav/cards changes motion and shadow depth without breaking layout.
9. No page looks like a Phase 1 placeholder anymore.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(dashboard): complete phase 2 visual design system"
```

---

## Ship & Review

**User action:** Run `bun run dev:dashboard` → open `http://localhost:5173`

**Success criteria:** All 4 routes match the approved hybrid direction closely enough for manual eye review: V3 glass/brutal composition and palette, plus V5 typography. The dashboard should feel intentionally styled, animated, and cohesive, while still remaining presentation-only.

**Await user approval before proceeding to Phase 3.**
