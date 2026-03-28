# Hybrid Icon System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a typed `<Icon>` component library (stroke + clay variants) and upgrade all 14 icon locations in `packages/dashboard` to Neubrutalism 3D Claymorphism style.

**Architecture:** Two co-located renderers (`StrokeIcon`, `ClayIcon`) backed by plain data files (`icon-paths.ts`, `clay-colors.ts`, `clay-symbols.tsx`). A thin unified `<Icon>` component dispatches to the right renderer. CSS keyframes live in `global.css` following the existing pattern. Call sites import only `<Icon>` from the barrel.

**Tech Stack:** Bun · TypeScript 5.4 strict · React 18 (`useId`) · Tailwind v4 (Vite) · `renderToStaticMarkup` for tests

---

## File Map

**Create (new):**

```
packages/dashboard/src/components/atoms/icons/
  icon-paths.ts       ← IconName union types + StrokePathDef data per name
  clay-colors.ts      ← ClayIconName → { from, to } gradient hex strings
  clay-symbols.tsx    ← ClayIconName → JSX render function for symbol layer
  stroke-icon.tsx     ← <StrokeIcon> renders shadow path + main path + wrapper
  clay-icon.tsx       ← <ClayIcon> renders 4-layer clay badge
  icon.tsx            ← <Icon> dispatches to StrokeIcon or ClayIcon
  index.ts            ← barrel: export { Icon } + types
  icon.test.tsx       ← all icon tests
```

**Modify (existing):**

```
packages/dashboard/src/styles/global.css              ← add icon keyframes + wrapper classes
packages/dashboard/src/components/atoms/brutal-select.tsx   ← swap ChevronIcon → <Icon>
packages/dashboard/src/components/molecules/brutal-toast.tsx ← swap dismiss SVG → <Icon>
packages/dashboard/src/components/molecules/webhook-stepper.tsx ← swap 3 SVGs → <Icon>
packages/dashboard/src/pages/room-list.tsx            ← add Icon to 4 buttons
packages/dashboard/src/pages/room-detail.tsx          ← replace 3 SVGs + 1 clay icon
packages/dashboard/src/pages/room-create.tsx          ← replace 1 SVG
```

---

## Task 1: Data layer — icon-paths.ts + clay-colors.ts

**Files:**

- Create: `packages/dashboard/src/components/atoms/icons/icon-paths.ts`
- Create: `packages/dashboard/src/components/atoms/icons/clay-colors.ts`

- [ ] **Step 1: Create icon-paths.ts**

```typescript
// packages/dashboard/src/components/atoms/icons/icon-paths.ts

export type StrokeIconName =
  | 'arrow-left'
  | 'arrow-right'
  | 'chevron-down'
  | 'close'
  | 'external-link'

export type ClayIconName =
  | 'plus'
  | 'pencil'
  | 'trash'
  | 'book'
  | 'link'
  | 'webhook'
  | 'pause'
  | 'play'

export type IconName = StrokeIconName | ClayIconName
export type IconVariant = 'stroke' | 'clay'

export interface StrokePathDef {
  /** One or more SVG `d` strings joined in the same <path> via spaces */
  d: string
  viewBox: string
  strokeWidth: number
  /** CSS animation class appended to .stroke-icon-wrap */
  animClass:
    | 'icon-anim-slide-left'
    | 'icon-anim-slide-right'
    | 'icon-anim-wiggle'
    | 'icon-anim-lift'
}

export const STROKE_PATHS: Record<StrokeIconName, StrokePathDef> = {
  'arrow-left': {
    d: 'M17 10H3 M8 4L2 10L8 16',
    viewBox: '0 0 20 20',
    strokeWidth: 3.5,
    animClass: 'icon-anim-slide-left',
  },
  'arrow-right': {
    d: 'M3 10H17 M12 4L18 10L12 16',
    viewBox: '0 0 20 20',
    strokeWidth: 3.5,
    animClass: 'icon-anim-slide-right',
  },
  'chevron-down': {
    d: 'M2 2L9 10L16 2',
    viewBox: '0 0 18 12',
    strokeWidth: 3.5,
    animClass: 'icon-anim-lift',
  },
  close: {
    d: 'M3 3L15 15 M15 3L3 15',
    viewBox: '0 0 18 18',
    strokeWidth: 3.5,
    animClass: 'icon-anim-wiggle',
  },
  'external-link': {
    d: 'M9 4H4C3.448 4 3 4.448 3 5V16C3 16.552 3.448 17 4 17H15C15.552 17 16 16.552 16 16V11 M12 3H17V8 M17 3L10 10',
    viewBox: '0 0 20 20',
    strokeWidth: 2.8,
    animClass: 'icon-anim-slide-right',
  },
}
```

- [ ] **Step 2: Create clay-colors.ts**

```typescript
// packages/dashboard/src/components/atoms/icons/clay-colors.ts
import type { ClayIconName } from './icon-paths'

export interface ClayColorDef {
  from: string
  to: string
}

export const CLAY_COLORS: Record<ClayIconName, ClayColorDef> = {
  plus: { from: '#ede8ff', to: '#bfb3f7' }, // violet/lilac → theme-button-violet
  pencil: { from: '#d5f0ff', to: '#7dc8ec' }, // sky blue    → room-card-action-btn--edit
  trash: { from: '#ffe0f0', to: '#f4a0c8' }, // pink coral  → room-card-action-btn--delete
  book: { from: '#fde7c0', to: '#f4a060' }, // warm amber  → theme-button-warm
  link: { from: '#e9fad8', to: '#7abf64' }, // matcha      → --matcha-accent
  webhook: { from: '#d5e8ff', to: '#6eaaec' }, // sky accent  → --sky-accent
  pause: { from: '#fef9d0', to: '#f9d44a' }, // butter      → --warning
  play: { from: '#c8f5e0', to: '#4dd8a0' }, // mint        → --success
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/dashboard/src/components/atoms/icons/icon-paths.ts \
        packages/dashboard/src/components/atoms/icons/clay-colors.ts
git commit -m "feat(dashboard): add icon type definitions and color data"
```

Expected: clean commit, `bun run typecheck` passes.

---

## Task 2: CSS — keyframes + wrapper classes in global.css

**Files:**

- Modify: `packages/dashboard/src/styles/global.css` (append to end of file)

- [ ] **Step 1: Append icon CSS block to global.css**

Open `packages/dashboard/src/styles/global.css` and append at the very end (after the last `}` of the ribbon `@media` block):

```css
/* ── Icon system — clay + stroke variants ──────────────────── */

/* Clay icon wrapper: positions shine streak pseudo-element */
.clay-icon-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 13px;
  vertical-align: middle;
  flex-shrink: 0;
}

.clay-icon-wrap::after {
  content: '';
  position: absolute;
  top: -30%;
  left: -50%;
  width: 35%;
  height: 150%;
  background: linear-gradient(
    105deg,
    transparent 30%,
    rgba(255, 255, 255, 0.75) 50%,
    transparent 70%
  );
  transform: translateX(-130%) skewX(-15deg);
  pointer-events: none;
}

/* Stroke icon wrapper */
.stroke-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  flex-shrink: 0;
}

/* ── Clay keyframes ──────────────────────────────────────────── */
@keyframes clay-bounce {
  0% {
    transform: scale(1);
  }
  20% {
    transform: scale(1.22) rotate(-5deg);
  }
  45% {
    transform: scale(0.9) rotate(3deg);
  }
  65% {
    transform: scale(1.1) rotate(-2deg);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes shine-sweep {
  0% {
    transform: translateX(-130%) skewX(-15deg);
    opacity: 0;
  }
  15% {
    opacity: 1;
  }
  100% {
    transform: translateX(230%) skewX(-15deg);
    opacity: 0;
  }
}

/* ── Stroke keyframes ────────────────────────────────────────── */
@keyframes icon-slide-right {
  0%,
  100% {
    transform: translateX(0);
    opacity: 1;
  }
  40% {
    transform: translateX(6px);
    opacity: 0.5;
  }
  41% {
    transform: translateX(-8px);
    opacity: 0;
  }
  60% {
    transform: translateX(-2px);
    opacity: 0.7;
  }
}

@keyframes icon-slide-left {
  0%,
  100% {
    transform: translateX(0);
    opacity: 1;
  }
  40% {
    transform: translateX(-6px);
    opacity: 0.5;
  }
  41% {
    transform: translateX(8px);
    opacity: 0;
  }
  60% {
    transform: translateX(2px);
    opacity: 0.7;
  }
}

@keyframes icon-wiggle {
  0%,
  100% {
    transform: rotate(0deg);
  }
  20% {
    transform: rotate(12deg) scale(1.1);
  }
  40% {
    transform: rotate(-10deg);
  }
  60% {
    transform: rotate(7deg);
  }
  80% {
    transform: rotate(-4deg);
  }
}

@keyframes icon-lift {
  0%,
  100% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(-1.5px, -1.5px);
  }
}

/* ── Hover animation dispatch ────────────────────────────────── */
.clay-icon-wrap:hover svg {
  animation: clay-bounce 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) forwards;
}

.clay-icon-wrap:hover::after {
  animation: shine-sweep 0.6s ease forwards;
}

.stroke-icon-wrap.icon-anim-slide-right:hover svg {
  animation: icon-slide-right 0.4s ease forwards;
}

.stroke-icon-wrap.icon-anim-slide-left:hover svg {
  animation: icon-slide-left 0.4s ease forwards;
}

.stroke-icon-wrap.icon-anim-wiggle:hover svg {
  animation: icon-wiggle 0.45s ease forwards;
}

.stroke-icon-wrap.icon-anim-lift:hover svg {
  animation: icon-lift 0.28s ease forwards;
}

/* ── Reduced motion ──────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .clay-icon-wrap:hover svg,
  .clay-icon-wrap:hover::after,
  .stroke-icon-wrap:hover svg {
    animation: none;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/dashboard/src/styles/global.css
git commit -m "feat(dashboard): add icon system CSS keyframes and wrapper classes"
```

Expected: clean commit.

---

## Task 3: clay-symbols.tsx — symbol JSX per clay icon

**Files:**

- Create: `packages/dashboard/src/components/atoms/icons/clay-symbols.tsx`

This file exports one JSX render function per clay icon name. Each function returns only the **symbol layer** paths — the clay background (shadow + body + shine) is rendered by `ClayIcon`. Functions must be arrow functions returning `JSX.Element`.

- [ ] **Step 1: Create clay-symbols.tsx**

```tsx
// packages/dashboard/src/components/atoms/icons/clay-symbols.tsx
import type { ClayIconName } from './icon-paths'

export const CLAY_SYMBOLS: Record<ClayIconName, () => JSX.Element> = {
  plus: () => (
    <path
      d="M22 12V32 M12 22H32"
      stroke="#1a1a2e"
      strokeWidth="5.5"
      strokeLinecap="round"
      fill="none"
    />
  ),

  pencil: () => (
    <>
      <path
        d="M29.5 10.5L33.5 14.5L17.5 30.5L11 32.5L13 26Z"
        fill="white"
        stroke="#1a1a2e"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <line x1="13" y1="26" x2="17.5" y2="30.5" stroke="#1a1a2e" strokeWidth="1.5" />
    </>
  ),

  trash: () => (
    <>
      <path d="M17 15H27 M13 18H31" stroke="#1a1a2e" strokeWidth="2.8" strokeLinecap="round" />
      <rect
        x="15"
        y="19.5"
        width="14"
        height="12.5"
        rx="3.5"
        fill="white"
        stroke="#1a1a2e"
        strokeWidth="2.2"
      />
      <line
        x1="19"
        y1="22.5"
        x2="19"
        y2="29"
        stroke="#1a1a2e"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <line
        x1="22"
        y1="22.5"
        x2="22"
        y2="29"
        stroke="#1a1a2e"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <line
        x1="25"
        y1="22.5"
        x2="25"
        y2="29"
        stroke="#1a1a2e"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </>
  ),

  book: () => (
    <>
      <path d="M22 13V33" stroke="#1a1a2e" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M22 13C19 11 13 12 11 14V31C13 29.5 19 29 22 31"
        stroke="#1a1a2e"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="white"
        fillOpacity="0.7"
      />
      <path
        d="M22 13C25 11 31 12 33 14V31C31 29.5 25 29 22 31"
        stroke="#1a1a2e"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="white"
        fillOpacity="0.7"
      />
    </>
  ),

  link: () => (
    <>
      <path
        d="M19 26.5C16.515 26.5 14.5 24.485 14.5 22C14.5 19.515 16.515 17.5 19 17.5H20.5"
        stroke="#1a1a2e"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M25 17.5C27.485 17.5 29.5 19.515 29.5 22C29.5 24.485 27.485 26.5 25 26.5H23.5"
        stroke="#1a1a2e"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M18.5 22H25.5" stroke="#1a1a2e" strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),

  webhook: () => (
    <>
      <circle cx="15" cy="22" r="2.5" fill="#1a1a2e" />
      <path
        d="M22 22 C22 17 26 14 30 14"
        stroke="#1a1a2e"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M20 22 C20 15 25 11 32 11"
        stroke="#1a1a2e"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M22 22 C22 27 26 30 30 30"
        stroke="#1a1a2e"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M20 22 C20 29 25 33 32 33"
        stroke="#1a1a2e"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
    </>
  ),

  pause: () => (
    <>
      <rect x="14" y="13" width="5" height="18" rx="2.5" fill="#1a1a2e" />
      <rect x="25" y="13" width="5" height="18" rx="2.5" fill="#1a1a2e" />
    </>
  ),

  play: () => (
    <path
      d="M16 12L32 22L16 32V12Z"
      fill="#1a1a2e"
      stroke="#1a1a2e"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  ),
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/dashboard/src/components/atoms/icons/clay-symbols.tsx
git commit -m "feat(dashboard): add clay icon symbol JSX definitions"
```

---

## Task 4: Write icon.test.tsx — all tests FAIL (TDD)

**Files:**

- Create: `packages/dashboard/src/components/atoms/icons/icon.test.tsx`

- [ ] **Step 1: Create icon.test.tsx**

```tsx
// packages/dashboard/src/components/atoms/icons/icon.test.tsx
import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Icon } from '~/components/atoms/icons'

// ── Stroke variant ─────────────────────────────────────────────
describe('Icon stroke — arrow-left', () => {
  it('renders stroke-icon-wrap wrapper with slide-left anim class', () => {
    const html = renderToStaticMarkup(
      createElement(Icon, { name: 'arrow-left', variant: 'stroke' }),
    )
    expect(html).toContain('stroke-icon-wrap')
    expect(html).toContain('icon-anim-slide-left')
  })

  it('renders main path with correct d attribute', () => {
    const html = renderToStaticMarkup(
      createElement(Icon, { name: 'arrow-left', variant: 'stroke' }),
    )
    expect(html).toContain('M17 10H3')
  })

  it('renders a shadow path with opacity 0.22 at offset transform', () => {
    const html = renderToStaticMarkup(
      createElement(Icon, { name: 'arrow-left', variant: 'stroke' }),
    )
    expect(html).toContain('opacity="0.22"')
    expect(html).toContain('translate(1.3,1.3)')
  })
})

describe('Icon stroke — arrow-right', () => {
  it('renders main path and slide-right anim class', () => {
    const html = renderToStaticMarkup(
      createElement(Icon, { name: 'arrow-right', variant: 'stroke' }),
    )
    expect(html).toContain('M3 10H17')
    expect(html).toContain('icon-anim-slide-right')
  })
})

describe('Icon stroke — chevron-down', () => {
  it('renders correct viewBox and path', () => {
    const html = renderToStaticMarkup(
      createElement(Icon, { name: 'chevron-down', variant: 'stroke' }),
    )
    expect(html).toContain('0 0 18 12')
    expect(html).toContain('M2 2L9 10L16 2')
    expect(html).toContain('icon-anim-lift')
  })
})

describe('Icon stroke — close', () => {
  it('renders X paths and wiggle anim class', () => {
    const html = renderToStaticMarkup(createElement(Icon, { name: 'close', variant: 'stroke' }))
    expect(html).toContain('M3 3L15 15')
    expect(html).toContain('icon-anim-wiggle')
  })
})

describe('Icon stroke — external-link', () => {
  it('renders box + diagonal arrow paths', () => {
    const html = renderToStaticMarkup(
      createElement(Icon, { name: 'external-link', variant: 'stroke' }),
    )
    expect(html).toContain('M9 4H4')
    expect(html).toContain('M17 3L10 10')
    expect(html).toContain('icon-anim-slide-right')
  })
})

describe('Icon stroke — aria props', () => {
  it('forwards aria-hidden', () => {
    const html = renderToStaticMarkup(
      createElement(Icon, { name: 'close', variant: 'stroke', 'aria-hidden': true }),
    )
    expect(html).toContain('aria-hidden="true"')
  })

  it('forwards aria-label for interactive usage', () => {
    const html = renderToStaticMarkup(
      createElement(Icon, {
        name: 'close',
        variant: 'stroke',
        'aria-label': 'Dismiss notification',
      }),
    )
    expect(html).toContain('aria-label="Dismiss notification"')
  })
})

// ── Clay variant ───────────────────────────────────────────────
describe('Icon clay — structure', () => {
  it('renders clay-icon-wrap wrapper', () => {
    const html = renderToStaticMarkup(createElement(Icon, { name: 'plus', variant: 'clay' }))
    expect(html).toContain('clay-icon-wrap')
  })

  it('renders shadow rect with opacity 0.2', () => {
    const html = renderToStaticMarkup(createElement(Icon, { name: 'plus', variant: 'clay' }))
    expect(html).toContain('opacity="0.2"')
  })

  it('renders inner shine ellipse with opacity 0.42', () => {
    const html = renderToStaticMarkup(createElement(Icon, { name: 'plus', variant: 'clay' }))
    expect(html).toContain('opacity="0.42"')
  })

  it('references linearGradient with clay-grad- prefix', () => {
    const html = renderToStaticMarkup(createElement(Icon, { name: 'plus', variant: 'clay' }))
    expect(html).toMatch(/id="clay-grad-/)
    expect(html).toMatch(/fill="url\(#clay-grad-/)
  })

  it('respects custom size prop', () => {
    const html = renderToStaticMarkup(
      createElement(Icon, { name: 'plus', variant: 'clay', size: 48 }),
    )
    expect(html).toContain('width="48"')
    expect(html).toContain('height="48"')
  })
})

describe('Icon clay — plus', () => {
  it('renders violet gradient and plus symbol', () => {
    const html = renderToStaticMarkup(createElement(Icon, { name: 'plus', variant: 'clay' }))
    expect(html).toContain('#ede8ff')
    expect(html).toContain('#bfb3f7')
    expect(html).toContain('M22 12V32')
  })
})

describe('Icon clay — pencil', () => {
  it('renders sky blue gradient and pencil body path', () => {
    const html = renderToStaticMarkup(createElement(Icon, { name: 'pencil', variant: 'clay' }))
    expect(html).toContain('#d5f0ff')
    expect(html).toContain('#7dc8ec')
    expect(html).toContain('M29.5 10.5L33.5 14.5')
  })
})

describe('Icon clay — trash', () => {
  it('renders pink gradient, lid path, body rect, and 3 lines', () => {
    const html = renderToStaticMarkup(createElement(Icon, { name: 'trash', variant: 'clay' }))
    expect(html).toContain('#ffe0f0')
    expect(html).toContain('M17 15H27')
    expect(html).toContain('x1="19"')
    expect(html).toContain('x1="22"')
    expect(html).toContain('x1="25"')
  })
})

describe('Icon clay — book', () => {
  it('renders amber gradient and two book-wing paths', () => {
    const html = renderToStaticMarkup(createElement(Icon, { name: 'book', variant: 'clay' }))
    expect(html).toContain('#fde7c0')
    expect(html).toContain('#f4a060')
    expect(html).toContain('M22 13V33')
  })
})

describe('Icon clay — link', () => {
  it('renders matcha gradient and chain paths', () => {
    const html = renderToStaticMarkup(createElement(Icon, { name: 'link', variant: 'clay' }))
    expect(html).toContain('#e9fad8')
    expect(html).toContain('#7abf64')
    expect(html).toContain('14.5 22')
  })
})
```

- [ ] **Step 2: Run tests — confirm ALL FAIL**

```bash
cd packages/dashboard && bun test src/components/atoms/icons/icon.test.tsx
```

Expected: All tests fail with `Cannot find module '~/components/atoms/icons'` or similar. If any pass, something is wrong.

---

## Task 5: stroke-icon.tsx — implement, partial tests pass

**Files:**

- Create: `packages/dashboard/src/components/atoms/icons/stroke-icon.tsx`

- [ ] **Step 1: Create stroke-icon.tsx**

```tsx
// packages/dashboard/src/components/atoms/icons/stroke-icon.tsx
import { STROKE_PATHS, type StrokeIconName } from './icon-paths'

interface StrokeIconProps {
  name: StrokeIconName
  size?: number
  className?: string
  'aria-hidden'?: boolean
  'aria-label'?: string
}

export function StrokeIcon({
  name,
  size = 20,
  className,
  'aria-hidden': ariaHidden,
  'aria-label': ariaLabel,
}: StrokeIconProps) {
  const def = STROKE_PATHS[name]

  return (
    <span
      className={['stroke-icon-wrap', def.animClass, className ?? ''].filter(Boolean).join(' ')}
    >
      <svg
        width={size}
        height={size}
        viewBox={def.viewBox}
        fill="none"
        aria-hidden={ariaHidden}
        aria-label={ariaLabel}
      >
        {/* Shadow path — duplicate at offset for 3D depth */}
        <path
          d={def.d}
          stroke="currentColor"
          strokeWidth={def.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.22"
          transform="translate(1.3,1.3)"
        />
        {/* Main icon path */}
        <path
          d={def.d}
          stroke="currentColor"
          strokeWidth={def.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
```

- [ ] **Step 2: Create a temporary re-export so tests can import from the barrel**

Create the barrel file now with only stroke support (clay will error in tests, we add clay next):

```typescript
// packages/dashboard/src/components/atoms/icons/index.ts
export { Icon } from './icon'
export type { IconName, IconVariant, StrokeIconName, ClayIconName } from './icon-paths'
```

Create a minimal icon.tsx that only handles stroke so far:

```tsx
// packages/dashboard/src/components/atoms/icons/icon.tsx
import { StrokeIcon } from './stroke-icon'
import type { IconName, IconVariant } from './icon-paths'

interface IconProps {
  name: IconName
  variant: IconVariant
  size?: number
  className?: string
  'aria-hidden'?: boolean
  'aria-label'?: string
}

export function Icon({ name, variant, ...rest }: IconProps) {
  if (variant === 'stroke') {
    // StrokeIconName is a subset of IconName — cast is safe when variant === 'stroke'
    return <StrokeIcon name={name as Parameters<typeof StrokeIcon>[0]['name']} {...rest} />
  }
  // Clay: placeholder until Task 6
  return null
}
```

- [ ] **Step 3: Run stroke tests — they should PASS, clay tests still FAIL**

```bash
cd packages/dashboard && bun test src/components/atoms/icons/icon.test.tsx
```

Expected: Stroke describe blocks pass (10 tests), clay describe blocks fail (receives `null`).

---

## Task 6: clay-icon.tsx — all tests pass; commit

**Files:**

- Create: `packages/dashboard/src/components/atoms/icons/clay-icon.tsx`
- Modify: `packages/dashboard/src/components/atoms/icons/icon.tsx` (add clay branch)

- [ ] **Step 1: Create clay-icon.tsx**

```tsx
// packages/dashboard/src/components/atoms/icons/clay-icon.tsx
import { useId } from 'react'
import { CLAY_COLORS, type ClayColorDef } from './clay-colors'
import { CLAY_SYMBOLS } from './clay-symbols'
import type { ClayIconName } from './icon-paths'

interface ClayIconProps {
  name: ClayIconName
  size?: number
  className?: string
  'aria-hidden'?: boolean
  'aria-label'?: string
}

export function ClayIcon({
  name,
  size = 20,
  className,
  'aria-hidden': ariaHidden,
  'aria-label': ariaLabel,
}: ClayIconProps) {
  const id = useId()
  const gradId = `clay-grad-${id}`
  const { from, to }: ClayColorDef = CLAY_COLORS[name]
  const Symbol = CLAY_SYMBOLS[name]

  return (
    <span className={['clay-icon-wrap', className ?? ''].filter(Boolean).join(' ')}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden={ariaHidden}
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id={gradId} x1="3" y1="3" x2="41" y2="41" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>

        {/* Layer 1: 3D hard shadow offset */}
        <rect x="5" y="5" width="36" height="36" rx="13" fill="#1a1a2e" opacity="0.2" />

        {/* Layer 2: Main clay body with gradient */}
        <rect
          x="3"
          y="3"
          width="36"
          height="36"
          rx="13"
          fill={`url(#${gradId})`}
          stroke="#1a1a2e"
          strokeWidth="2.5"
        />

        {/* Layer 3: Inner shine (top-left ellipse) */}
        <ellipse
          cx="13"
          cy="11"
          rx="9"
          ry="6"
          fill="white"
          opacity="0.42"
          transform="rotate(-18 13 11)"
        />

        {/* Layer 4: Icon symbol */}
        <Symbol />
      </svg>
    </span>
  )
}
```

- [ ] **Step 2: Update icon.tsx to add clay dispatch**

```tsx
// packages/dashboard/src/components/atoms/icons/icon.tsx
import { ClayIcon } from './clay-icon'
import { StrokeIcon } from './stroke-icon'
import type { ClayIconName, IconName, IconVariant, StrokeIconName } from './icon-paths'

interface IconProps {
  name: IconName
  variant: IconVariant
  size?: number
  className?: string
  'aria-hidden'?: boolean
  'aria-label'?: string
}

export function Icon({ name, variant, ...rest }: IconProps) {
  if (variant === 'clay') {
    return <ClayIcon name={name as ClayIconName} {...rest} />
  }
  return <StrokeIcon name={name as StrokeIconName} {...rest} />
}
```

- [ ] **Step 3: Run ALL icon tests — all must pass**

```bash
cd packages/dashboard && bun test src/components/atoms/icons/icon.test.tsx
```

Expected: All tests pass. Zero failures.

- [ ] **Step 4: Run full test suite**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: 562+ tests pass, no typecheck errors, no lint errors.

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/src/components/atoms/icons/
git commit -m "feat(dashboard): add Icon component — stroke and clay variants with tests"
```

---

## Task 7: Update brutal-select.tsx + brutal-toast.tsx

**Files:**

- Modify: `packages/dashboard/src/components/atoms/brutal-select.tsx`
- Modify: `packages/dashboard/src/components/molecules/brutal-toast.tsx`

### brutal-select.tsx

The file currently has a local `ChevronIcon` function component (lines 21–31) that renders a thin stroke SVG. Replace it with `<Icon>`.

- [ ] **Step 1: Replace ChevronIcon in brutal-select.tsx**

Remove the entire `const ChevronIcon = () => (...)` block (lines 21–31). Then find every usage of `<ChevronIcon />` (there is one in the dropdown trigger, inside `brutal-dropdown-chevron` span) and replace with `<Icon>`.

The change is:

**Remove** (lines 21–31):

```tsx
const ChevronIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path
      d="M2.5 4.5L6 8L9.5 4.5"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)
```

**Add at top of file** (after existing imports):

```tsx
import { Icon } from '~/components/atoms/icons'
```

**Replace** `<ChevronIcon />` usage inside the `brutal-dropdown-chevron` span with:

```tsx
<Icon name="chevron-down" variant="stroke" size={14} aria-hidden />
```

- [ ] **Step 2: Verify brutal-select.test.tsx still passes**

```bash
cd packages/dashboard && bun test src/components/atoms/brutal-select.test.tsx
```

Expected: All pass. The test checks for `brutal-dropdown-chevron` class and the select structure — those are unaffected.

### brutal-toast.tsx

The file currently has an inline SVG for the dismiss `×` button (lines 54–61). Replace it.

- [ ] **Step 3: Update brutal-toast.tsx**

**Add import** after existing imports:

```tsx
import { Icon } from '~/components/atoms/icons'
```

**Replace** the inline SVG (the `<svg ... M4 4L12 12M12 4L4 12 ...>` block) with:

```tsx
<Icon name="close" variant="stroke" size={14} aria-hidden />
```

The dismiss button already has `aria-label="Dismiss"` on the outer `<button>`, so `aria-hidden` on the icon is correct.

- [ ] **Step 4: Verify brutal-toast tests still pass**

```bash
cd packages/dashboard && bun test src/components/molecules/brutal-toast.test.tsx
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/src/components/atoms/brutal-select.tsx \
        packages/dashboard/src/components/molecules/brutal-toast.tsx
git commit -m "feat(dashboard): replace inline SVGs in brutal-select and brutal-toast with Icon component"
```

---

## Task 8: Update webhook-stepper.tsx — 3 icon replacements

**Files:**

- Modify: `packages/dashboard/src/components/molecules/webhook-stepper.tsx`

The stepper has 3 inline SVGs. All use the same thin `M3 8H13...` / `M13 8H3...` arrow paths.

- [ ] **Step 1: Add Icon import**

Add after the existing imports in `webhook-stepper.tsx`:

```tsx
import { Icon } from '~/components/atoms/icons'
```

- [ ] **Step 2: Replace action link arrow (line ~168)**

Find the `<svg aria-hidden="true" width="15" height="15" ...>` inside the anchor `<a>` tag that renders `{activeConfig.actionLabel}`. It uses path `M3 8H13M13 8L9 4M13 8L9 12`.

Replace the entire `<svg>` block with:

```tsx
<Icon name="arrow-right" variant="stroke" size={15} aria-hidden />
```

- [ ] **Step 3: Replace Previous button arrow (line ~216)**

Find the `<svg ... M13 8H3M3 8L7 4M3 8L7 12 ...>` inside the Previous button.

Replace the entire `<svg>` block with:

```tsx
<Icon name="arrow-left" variant="stroke" size={15} aria-hidden />
```

- [ ] **Step 4: Replace Next button arrow (line ~256)**

Find the `<svg ... M3 8H13M13 8L9 4M13 8L9 12 ...>` inside the Next button.

Replace the entire `<svg>` block with:

```tsx
<Icon name="arrow-right" variant="stroke" size={15} aria-hidden />
```

- [ ] **Step 5: Run typecheck to verify no errors**

```bash
cd packages/dashboard && bun run typecheck
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add packages/dashboard/src/components/molecules/webhook-stepper.tsx
git commit -m "feat(dashboard): replace inline arrow SVGs in webhook-stepper with Icon component"
```

---

## Task 9: Update room-list.tsx — 4 icon additions

**Files:**

- Modify: `packages/dashboard/src/pages/room-list.tsx`

Currently all 4 buttons are text-only. Add clay icons.

- [ ] **Step 1: Add Icon import**

Add after existing imports:

```tsx
import { Icon } from '~/components/atoms/icons'
```

- [ ] **Step 2: Update "+ New Room" button (line ~162–169)**

Find:

```tsx
<button
  type="button"
  onClick={() => {
    void navigate('/rooms/new')
  }}
  className="brutal-button theme-button-violet w-[10.5rem] py-3 font-heading text-sm font-bold text-white"
>
  + New Room
</button>
```

Replace with:

```tsx
<button
  type="button"
  onClick={() => {
    void navigate('/rooms/new')
  }}
  className="brutal-button theme-button-violet inline-flex items-center gap-2 w-[10.5rem] py-3 font-heading text-sm font-bold text-white"
>
  <Icon name="plus" variant="clay" size={20} aria-hidden />
  New Room
</button>
```

- [ ] **Step 3: Update "Webhook Guide" button (line ~172–179)**

Find:

```tsx
<button
  type="button"
  onClick={() => {
    void navigate('/guide')
  }}
  className="brutal-button theme-button-warm w-[10.5rem] py-3 font-heading text-sm font-bold text-white"
>
  Webhook Guide
</button>
```

Replace with:

```tsx
<button
  type="button"
  onClick={() => {
    void navigate('/guide')
  }}
  className="brutal-button theme-button-warm inline-flex items-center gap-2 w-[10.5rem] py-3 font-heading text-sm font-bold text-white"
>
  <Icon name="book" variant="clay" size={20} aria-hidden />
  Webhook Guide
</button>
```

- [ ] **Step 4: Update "Edit" room card button (line ~354–361)**

Find:

```tsx
<button
  type="button"
  onClick={() => {
    void navigate(`/rooms/${room.id}`)
  }}
  className="room-card-action-btn room-card-action-btn--edit"
>
  Edit
</button>
```

Replace with:

```tsx
<button
  type="button"
  onClick={() => {
    void navigate(`/rooms/${room.id}`)
  }}
  className="room-card-action-btn room-card-action-btn--edit inline-flex items-center gap-2"
>
  <Icon name="pencil" variant="clay" size={16} aria-hidden />
  Edit
</button>
```

- [ ] **Step 5: Update "Delete" room card button (line ~362–369)**

Find:

```tsx
<button
  type="button"
  onClick={() => {
    setSelectedRoom(room)
  }}
  className="room-card-action-btn room-card-action-btn--delete"
>
  Delete
</button>
```

Replace with:

```tsx
<button
  type="button"
  onClick={() => {
    setSelectedRoom(room)
  }}
  className="room-card-action-btn room-card-action-btn--delete inline-flex items-center gap-2"
>
  <Icon name="trash" variant="clay" size={16} aria-hidden />
  Delete
</button>
```

> Also update the "Create First Room" empty state button (line ~248) the same way as the "New Room" button:
> `className="... inline-flex items-center gap-2"` + `<Icon name="plus" variant="clay" size={20} aria-hidden />` before `Create First Room`.

- [ ] **Step 6: Run typecheck**

```bash
cd packages/dashboard && bun run typecheck
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add packages/dashboard/src/pages/room-list.tsx
git commit -m "feat(dashboard): add clay icons to room-list page buttons"
```

---

## Task 10: Update room-detail.tsx + room-create.tsx — navigation icons

**Files:**

- Modify: `packages/dashboard/src/pages/room-detail.tsx`
- Modify: `packages/dashboard/src/pages/room-create.tsx`

### room-detail.tsx — 4 icon locations

- [ ] **Step 1: Add Icon import to room-detail.tsx**

Add after existing imports:

```tsx
import { Icon } from '~/components/atoms/icons'
```

- [ ] **Step 2: Replace Back arrow (line ~142–158)**

Find the first `<svg aria-hidden="true" width="16" height="16" ...>` block (inside the "Back to Dashboard" button) that contains `M13 8H3M3 8L7 4M3 8L7 12`.

Replace the entire `<svg>` block with:

```tsx
<Icon name="arrow-left" variant="stroke" size={16} aria-hidden />
```

- [ ] **Step 3: Replace Back arrow in edit form (line ~310–326)**

Same thin arrow SVG, second occurrence (inside the "Back" button in the save/cancel actions row). Replace with:

```tsx
<Icon name="arrow-left" variant="stroke" size={16} aria-hidden />
```

- [ ] **Step 4: Replace webhook URL field link icon (line ~354–367)**

Find the `<svg ... M6.5 9.5a3.5 3.5 ...>` inside the `flex h-6 w-6` circle span.

The outer `<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white">` contains the SVG. Replace only the `<svg>` inside it with:

```tsx
<Icon name="link" variant="clay" size={18} aria-hidden />
```

> The surrounding `<span>` with `rounded-full bg-[var(--accent)]` styling should be **removed** — the clay icon provides its own background. Keep only `<Icon name="link" variant="clay" size={18} aria-hidden />` in place of the whole span.

- [ ] **Step 5: Replace "View Webhook Guide" external link arrow (line ~400–420)**

Find the `<svg ... M3 8H13M13 8L9 4M13 8L9 12 ...>` inside the "View Webhook Guide" button.

Replace with:

```tsx
<Icon name="external-link" variant="stroke" size={14} aria-hidden />
```

Also add `inline-flex items-center gap-2` to the button className.

### room-create.tsx

- [ ] **Step 6: Add Icon import to room-create.tsx**

Add after existing imports:

```tsx
import { Icon } from '~/components/atoms/icons'
```

- [ ] **Step 7: Replace "Open Webhook Guide" arrow (line ~208–224)**

Find the `<svg ... M3 8H13M13 8L9 4M13 8L9 12 ...>` inside the "Open Webhook Guide" anchor/button.

Replace with:

```tsx
<Icon name="external-link" variant="stroke" size={14} aria-hidden />
```

Also add `inline-flex items-center gap-2` to the element className.

- [ ] **Step 8: Run full test suite**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: All tests pass (562+), zero typecheck errors, zero lint errors.

- [ ] **Step 9: Commit**

```bash
git add packages/dashboard/src/pages/room-detail.tsx \
        packages/dashboard/src/pages/room-create.tsx
git commit -m "feat(dashboard): replace inline arrow/link SVGs in room-detail and room-create with Icon component"
```

---

## Task 11: Final verification

- [ ] **Step 1: Run the definition of done**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: All tests pass, zero errors.

- [ ] **Step 2: Verify 14 icon locations are covered**

Cross-check against the inventory from the spec:

| #   | Location                          | Icon                   | Done? |
| --- | --------------------------------- | ---------------------- | ----- |
| 1   | room-list — New Room button       | `plus` clay            | ☐     |
| 2   | room-list — Webhook Guide button  | `book` clay            | ☐     |
| 3   | room-list — Edit room card btn    | `pencil` clay          | ☐     |
| 4   | room-list — Delete room card btn  | `trash` clay           | ☐     |
| 5   | room-detail — Back to Dashboard   | `arrow-left` stroke    | ☐     |
| 6   | room-detail — Back (edit form)    | `arrow-left` stroke    | ☐     |
| 7   | room-detail — View Webhook Guide  | `external-link` stroke | ☐     |
| 8   | room-detail — Webhook URL field   | `link` clay            | ☐     |
| 9   | room-create — Open Webhook Guide  | `external-link` stroke | ☐     |
| 10  | webhook-stepper — Previous button | `arrow-left` stroke    | ☐     |
| 11  | webhook-stepper — Next button     | `arrow-right` stroke   | ☐     |
| 12  | webhook-stepper — action link     | `arrow-right` stroke   | ☐     |
| 13  | brutal-toast — dismiss button     | `close` stroke         | ☐     |
| 14  | brutal-select — chevron           | `chevron-down` stroke  | ☐     |

Tick off each one by grepping the file. Example:

```bash
grep -n "Icon.*plus\|Icon.*book\|Icon.*pencil\|Icon.*trash" packages/dashboard/src/pages/room-list.tsx
grep -n "Icon.*arrow-left\|Icon.*external-link\|Icon.*link" packages/dashboard/src/pages/room-detail.tsx
grep -n "Icon.*external-link" packages/dashboard/src/pages/room-create.tsx
grep -n "Icon.*arrow" packages/dashboard/src/components/molecules/webhook-stepper.tsx
grep -n "Icon.*close" packages/dashboard/src/components/molecules/brutal-toast.tsx
grep -n "Icon.*chevron" packages/dashboard/src/components/atoms/brutal-select.tsx
```

- [ ] **Step 3: Commit final verification note (if no code changes needed)**

If all 14 locations check out and tests pass:

```bash
git tag icon-system-v1.0
```

---

## Summary

| Task | Deliverable                           | Commit                                                                                               |
| ---- | ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1    | Type definitions + color data         | `feat(dashboard): add icon type definitions and color data`                                          |
| 2    | CSS keyframes + wrapper classes       | `feat(dashboard): add icon system CSS keyframes and wrapper classes`                                 |
| 3    | Clay symbol JSX                       | `feat(dashboard): add clay icon symbol JSX definitions`                                              |
| 4    | Failing tests                         | (no commit — red state)                                                                              |
| 5    | StrokeIcon + skeleton Icon            | (partial — tests partially green)                                                                    |
| 6    | ClayIcon + full Icon + all tests pass | `feat(dashboard): add Icon component — stroke and clay variants with tests`                          |
| 7    | brutal-select + brutal-toast          | `feat(dashboard): replace inline SVGs in brutal-select and brutal-toast with Icon component`         |
| 8    | webhook-stepper                       | `feat(dashboard): replace inline arrow SVGs in webhook-stepper with Icon component`                  |
| 9    | room-list                             | `feat(dashboard): add clay icons to room-list page buttons`                                          |
| 10   | room-detail + room-create             | `feat(dashboard): replace inline arrow/link SVGs in room-detail and room-create with Icon component` |
| 11   | Final verification                    | tag `icon-system-v1.0`                                                                               |
