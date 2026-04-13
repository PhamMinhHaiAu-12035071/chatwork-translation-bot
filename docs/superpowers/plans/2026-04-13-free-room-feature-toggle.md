# Free Rooms Feature Toggle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide "Free Rooms" and "New Free Room" from the sidebar by default; expose an "⚗️ FEATURE LAB" panel with a brutal pill toggle that persists the feature flag to localStorage via Zustand.

**Architecture:** Add `freeRoomEnabled` to the existing Zustand `ui-store` (persist already wired). Create two new organism components — `FeatureLabPanel` (the toggle UI) and `FreeRoomGuard` (route guard). Modify `app-layout.tsx` to split `navItems` into static + free-room groups, conditionally render the free-room group with `AnimatePresence`, and render `FeatureLabPanel` below the nav. Wrap all three `/free-rooms*` routes in `FreeRoomGuard`.

**Tech Stack:** Bun v1.1+ · TypeScript 5.4+ strict · React 19 · Zustand 5.0 (persist) · framer-motion 12.6 · react-router v7 · Tailwind CSS 4.0 (brutal-surface, theme-card-\* utility classes)

---

## File Map

| File                                                                     | Action     | Responsibility                                                                               |
| ------------------------------------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------- |
| `packages/dashboard/src/stores/ui-store.ts`                              | Modify     | Add `freeRoomEnabled` state + `toggleFreeRoomEnabled` action + 2 selectors                   |
| `packages/dashboard/src/stores/ui-store.test.ts`                         | Modify     | Add tests for new state                                                                      |
| `packages/dashboard/src/components/organisms/feature-lab-panel.tsx`      | **Create** | "⚗️ FEATURE LAB" section with brutal pill toggle; handles collapsed/expanded sidebar         |
| `packages/dashboard/src/components/organisms/feature-lab-panel.test.tsx` | **Create** | SSR snapshot tests for the panel                                                             |
| `packages/dashboard/src/components/organisms/free-room-guard.tsx`        | **Create** | Route guard — reads `freeRoomEnabled`, redirects to `/` if false                             |
| `packages/dashboard/src/components/organisms/free-room-guard.test.tsx`   | **Create** | Tests for guard render behavior                                                              |
| `packages/dashboard/src/layouts/app-layout.tsx`                          | Modify     | Split navItems → staticNavItems + freeRoomNavItems; add AnimatePresence; add FeatureLabPanel |
| `packages/dashboard/src/router.tsx`                                      | Modify     | Wrap three `/free-rooms*` routes in `<FreeRoomGuard>`                                        |

---

## Task 1: Add `freeRoomEnabled` to ui-store

**Files:**

- Modify: `packages/dashboard/src/stores/ui-store.ts`
- Modify: `packages/dashboard/src/stores/ui-store.test.ts`

- [ ] **Step 1.1: Write the failing tests**

Open `packages/dashboard/src/stores/ui-store.test.ts`. Append the new `describe` block after the existing one:

```ts
describe('ui-store — freeRoomEnabled', () => {
  beforeEach(() => {
    useUiStore.setState({ freeRoomEnabled: false })
  })

  it('freeRoomEnabled defaults to false', () => {
    expect(useUiStore.getState().freeRoomEnabled).toBe(false)
  })

  it('toggleFreeRoomEnabled flips false → true', () => {
    useUiStore.getState().toggleFreeRoomEnabled()
    expect(useUiStore.getState().freeRoomEnabled).toBe(true)
  })

  it('toggleFreeRoomEnabled flips true → false', () => {
    useUiStore.setState({ freeRoomEnabled: true })
    useUiStore.getState().toggleFreeRoomEnabled()
    expect(useUiStore.getState().freeRoomEnabled).toBe(false)
  })

  it('selectFreeRoomEnabled reads the flag', () => {
    useUiStore.setState({ freeRoomEnabled: true })
    expect(selectFreeRoomEnabled(useUiStore.getState())).toBe(true)
  })

  it('selectToggleFreeRoomEnabled returns the action', () => {
    const action = selectToggleFreeRoomEnabled(useUiStore.getState())
    action()
    expect(useUiStore.getState().freeRoomEnabled).toBe(true)
  })
})
```

Update the import at the top of the file to include the new selectors:

```ts
import { useUiStore, selectFreeRoomEnabled, selectToggleFreeRoomEnabled } from './ui-store'
```

- [ ] **Step 1.2: Run tests to confirm they fail**

```bash
bun test packages/dashboard/src/stores/ui-store.test.ts
```

Expected: 5 failures — `freeRoomEnabled is not a property`, `toggleFreeRoomEnabled is not a function`, etc.

- [ ] **Step 1.3: Implement in ui-store.ts**

Replace the entire `packages/dashboard/src/stores/ui-store.ts` with:

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UiStoreState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void

  tourSeenVersion: number | null
  setTourSeen: (version: number) => void
  resetTour: () => void

  freeRoomEnabled: boolean
  toggleFreeRoomEnabled: () => void
}

export const useUiStore = create<UiStoreState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,

      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
      },

      setSidebarCollapsed: (collapsed: boolean) => {
        set({ sidebarCollapsed: collapsed })
      },

      tourSeenVersion: null,

      setTourSeen: (version: number) => {
        set({ tourSeenVersion: version })
      },

      resetTour: () => {
        set({ tourSeenVersion: null })
      },

      freeRoomEnabled: false,

      toggleFreeRoomEnabled: () => {
        set((state) => ({ freeRoomEnabled: !state.freeRoomEnabled }))
      },
    }),
    {
      name: 'chatwork-bot-ui-store',
    },
  ),
)

export const selectSidebarCollapsed = (state: UiStoreState) => state.sidebarCollapsed
export const selectToggleSidebar = (state: UiStoreState) => state.toggleSidebar
export const selectTourSeenVersion = (state: UiStoreState) => state.tourSeenVersion
export const selectSetTourSeen = (state: UiStoreState) => state.setTourSeen
export const selectResetTour = (state: UiStoreState) => state.resetTour
export const selectFreeRoomEnabled = (state: UiStoreState) => state.freeRoomEnabled
export const selectToggleFreeRoomEnabled = (state: UiStoreState) => state.toggleFreeRoomEnabled
```

- [ ] **Step 1.4: Run tests to confirm they pass**

```bash
bun test packages/dashboard/src/stores/ui-store.test.ts
```

Expected: all pass. Output includes `9 pass, 0 fail` (4 existing + 5 new).

- [ ] **Step 1.5: Typecheck**

```bash
cd packages/dashboard && bun run typecheck
```

Expected: `Done in ~Xs` with no errors.

- [ ] **Step 1.6: Commit**

```bash
git add packages/dashboard/src/stores/ui-store.ts \
        packages/dashboard/src/stores/ui-store.test.ts
git commit -m "$(cat <<'EOF'
feat(dashboard): add freeRoomEnabled flag to ui-store

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create `FeatureLabPanel` component

**Files:**

- Create: `packages/dashboard/src/components/organisms/feature-lab-panel.tsx`
- Create: `packages/dashboard/src/components/organisms/feature-lab-panel.test.tsx`

- [ ] **Step 2.1: Write the failing tests**

Create `packages/dashboard/src/components/organisms/feature-lab-panel.test.tsx`:

```tsx
import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FeatureLabPanel } from '~/components/organisms/feature-lab-panel'

const noop = () => undefined

describe('FeatureLabPanel', () => {
  describe('collapsed state', () => {
    it('renders the ⚗️ icon', () => {
      const html = renderToStaticMarkup(
        createElement(FeatureLabPanel, { collapsed: true, enabled: false, onToggle: noop }),
      )
      expect(html).toContain('⚗️')
    })

    it('renders title="Feature Lab" for tooltip', () => {
      const html = renderToStaticMarkup(
        createElement(FeatureLabPanel, { collapsed: true, enabled: false, onToggle: noop }),
      )
      expect(html).toContain('title="Feature Lab"')
    })

    it('does not render the toggle button', () => {
      const html = renderToStaticMarkup(
        createElement(FeatureLabPanel, { collapsed: true, enabled: false, onToggle: noop }),
      )
      expect(html).not.toContain('role="switch"')
    })
  })

  describe('expanded state', () => {
    it('renders "FEATURE LAB" text', () => {
      const html = renderToStaticMarkup(
        createElement(FeatureLabPanel, { collapsed: false, enabled: false, onToggle: noop }),
      )
      expect(html).toContain('FEATURE LAB')
    })

    it('renders "Free Rooms" label', () => {
      const html = renderToStaticMarkup(
        createElement(FeatureLabPanel, { collapsed: false, enabled: false, onToggle: noop }),
      )
      expect(html).toContain('Free Rooms')
    })

    it('renders toggle button with role="switch"', () => {
      const html = renderToStaticMarkup(
        createElement(FeatureLabPanel, { collapsed: false, enabled: false, onToggle: noop }),
      )
      expect(html).toContain('role="switch"')
    })

    it('sets aria-checked="false" when disabled', () => {
      const html = renderToStaticMarkup(
        createElement(FeatureLabPanel, { collapsed: false, enabled: false, onToggle: noop }),
      )
      expect(html).toContain('aria-checked="false"')
    })

    it('sets aria-checked="true" when enabled', () => {
      const html = renderToStaticMarkup(
        createElement(FeatureLabPanel, { collapsed: false, enabled: true, onToggle: noop }),
      )
      expect(html).toContain('aria-checked="true"')
    })

    it('wires onToggle to the toggle button click', async () => {
      const source = await Bun.file(new URL('./feature-lab-panel.tsx', import.meta.url)).text()
      expect(source).toContain('onClick={onToggle}')
    })
  })
})
```

- [ ] **Step 2.2: Run tests to confirm they fail**

```bash
bun test packages/dashboard/src/components/organisms/feature-lab-panel.test.tsx
```

Expected: module not found error or similar — `feature-lab-panel.tsx` does not exist yet.

- [ ] **Step 2.3: Create the component**

Create `packages/dashboard/src/components/organisms/feature-lab-panel.tsx`:

```tsx
import { motion } from 'framer-motion'
import { StickerLabel } from '~/components/atoms/sticker-label'

interface FeatureLabPanelProps {
  collapsed: boolean // desktop only; mobile always passes false
  enabled: boolean // freeRoomEnabled from ui-store
  onToggle: () => void
}

export function FeatureLabPanel({ collapsed, enabled, onToggle }: FeatureLabPanelProps) {
  if (collapsed) {
    return (
      <div
        className="brutal-surface theme-card-butter p-4 flex items-center justify-center"
        style={{ borderStyle: 'dashed' }}
        title="Feature Lab"
      >
        <span aria-hidden="true" style={{ fontSize: '18px' }}>
          ⚗️
        </span>
      </div>
    )
  }

  return (
    <div
      className="brutal-surface theme-card-butter p-4 space-y-3"
      style={{ borderStyle: 'dashed' }}
    >
      <StickerLabel tone="warning" tilt="flat">
        ⚗️ FEATURE LAB
      </StickerLabel>
      <div className="flex items-center justify-between gap-3">
        <span className="font-heading text-sm font-bold">Free Rooms</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle Free Rooms feature"
          onClick={onToggle}
          className="relative flex-shrink-0"
          style={{
            width: '52px',
            height: '26px',
            border: '2px solid #111',
            borderRadius: '20px',
            background: enabled ? '#22c55e' : '#e5e7eb',
            transition: 'background-color 200ms ease',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <motion.div
            animate={{ x: enabled ? 26 : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            style={{
              width: '18px',
              height: '18px',
              border: '2px solid #111',
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '2px 2px 0 #111',
              position: 'absolute',
              top: '2px',
              left: '2px',
            }}
          />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2.4: Run tests to confirm they pass**

```bash
bun test packages/dashboard/src/components/organisms/feature-lab-panel.test.tsx
```

Expected: `9 pass, 0 fail`.

- [ ] **Step 2.5: Typecheck**

```bash
cd packages/dashboard && bun run typecheck
```

Expected: no errors.

- [ ] **Step 2.6: Commit**

```bash
git add packages/dashboard/src/components/organisms/feature-lab-panel.tsx \
        packages/dashboard/src/components/organisms/feature-lab-panel.test.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): add FeatureLabPanel organism with brutal pill toggle

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create `FreeRoomGuard` route guard

**Files:**

- Create: `packages/dashboard/src/components/organisms/free-room-guard.tsx`
- Create: `packages/dashboard/src/components/organisms/free-room-guard.test.tsx`

- [ ] **Step 3.1: Write the failing tests**

Create `packages/dashboard/src/components/organisms/free-room-guard.test.tsx`:

```tsx
import { beforeEach, describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { useUiStore } from '~/stores/ui-store'
import { FreeRoomGuard } from '~/components/organisms/free-room-guard'

describe('FreeRoomGuard', () => {
  beforeEach(() => {
    useUiStore.setState({ freeRoomEnabled: false })
  })

  it('renders null (empty string) when freeRoomEnabled is false', () => {
    useUiStore.setState({ freeRoomEnabled: false })
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(FreeRoomGuard, null, createElement('div', null, 'protected content')),
      ),
    )
    expect(html).toBe('')
  })

  it('renders children when freeRoomEnabled is true', () => {
    useUiStore.setState({ freeRoomEnabled: true })
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(FreeRoomGuard, null, createElement('div', null, 'protected content')),
      ),
    )
    expect(html).toContain('protected content')
  })

  it('calls navigate on the client when disabled (source check)', async () => {
    const source = await Bun.file(new URL('./free-room-guard.tsx', import.meta.url)).text()
    expect(source).toContain('navigate')
    expect(source).toContain('replace: true')
  })
})
```

- [ ] **Step 3.2: Run tests to confirm they fail**

```bash
bun test packages/dashboard/src/components/organisms/free-room-guard.test.tsx
```

Expected: module not found error — file does not exist yet.

- [ ] **Step 3.3: Create the component**

Create `packages/dashboard/src/components/organisms/free-room-guard.tsx`:

```tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useUiStore, selectFreeRoomEnabled } from '~/stores/ui-store'

interface FreeRoomGuardProps {
  children: React.ReactNode
}

export function FreeRoomGuard({ children }: FreeRoomGuardProps) {
  const enabled = useUiStore(selectFreeRoomEnabled)
  const navigate = useNavigate()

  useEffect(() => {
    if (!enabled) void navigate('/', { replace: true })
  }, [enabled, navigate])

  if (!enabled) return null
  return <>{children}</>
}
```

- [ ] **Step 3.4: Run tests to confirm they pass**

```bash
bun test packages/dashboard/src/components/organisms/free-room-guard.test.tsx
```

Expected: `3 pass, 0 fail`.

- [ ] **Step 3.5: Typecheck**

```bash
cd packages/dashboard && bun run typecheck
```

Expected: no errors.

- [ ] **Step 3.6: Commit**

```bash
git add packages/dashboard/src/components/organisms/free-room-guard.tsx \
        packages/dashboard/src/components/organisms/free-room-guard.test.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): add FreeRoomGuard route guard component

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Integrate into `app-layout.tsx`

**Files:**

- Modify: `packages/dashboard/src/layouts/app-layout.tsx`

No new test file — `app-layout.tsx` has no existing test and integration testing requires a full browser. Visual verification is the acceptance gate here (see Step 4.5).

- [ ] **Step 4.1: Update imports at top of app-layout.tsx**

In `packages/dashboard/src/layouts/app-layout.tsx`, find the existing import block and add:

```ts
// Replace this line:
import { useUiStore, selectSidebarCollapsed, selectToggleSidebar } from '~/stores/ui-store'

// With:
import {
  useUiStore,
  selectSidebarCollapsed,
  selectToggleSidebar,
  selectFreeRoomEnabled,
  selectToggleFreeRoomEnabled,
} from '~/stores/ui-store'
import { FeatureLabPanel } from '~/components/organisms/feature-lab-panel'
```

- [ ] **Step 4.2: Split navItems into staticNavItems + freeRoomNavItems**

Find and replace the existing `navItems` declaration (lines 17–53 in the current file):

```ts
// Remove:
const navItems: readonly {
  to: string
  label: string
  surfaceClassName: string
  icon: ClayIconName | null
}[] = [
  { to: '/', label: 'Dashboard', surfaceClassName: 'theme-card-matcha', icon: 'dashboard' },
  { to: '/rooms/new', label: 'New Room', surfaceClassName: 'theme-card-blush', icon: 'plus' },
  {
    to: '/free-rooms',
    label: 'Free Rooms',
    surfaceClassName: 'theme-card-cream',
    icon: 'dashboard',
  },
  {
    to: '/free-rooms/new',
    label: 'New Free Room',
    surfaceClassName: 'theme-card-peach',
    icon: 'plus',
  },
  { to: '/guide', label: 'Webhook Guide', surfaceClassName: 'theme-card-sky', icon: 'book' },
]

// Replace with:
type NavItem = {
  to: string
  label: string
  surfaceClassName: string
  icon: ClayIconName | null
}

const staticNavItems: readonly NavItem[] = [
  { to: '/', label: 'Dashboard', surfaceClassName: 'theme-card-matcha', icon: 'dashboard' },
  { to: '/rooms/new', label: 'New Room', surfaceClassName: 'theme-card-blush', icon: 'plus' },
  { to: '/guide', label: 'Webhook Guide', surfaceClassName: 'theme-card-sky', icon: 'book' },
]

const freeRoomNavItems: readonly NavItem[] = [
  {
    to: '/free-rooms',
    label: 'Free Rooms',
    surfaceClassName: 'theme-card-cream',
    icon: 'dashboard',
  },
  {
    to: '/free-rooms/new',
    label: 'New Free Room',
    surfaceClassName: 'theme-card-peach',
    icon: 'plus',
  },
]
```

- [ ] **Step 4.3: Add freeRoomEnabled selectors to the component body**

Inside `export function AppLayout()`, after the existing selector calls, add:

```ts
// After this line:
const rooms = useRoomStore(selectRooms)

// Add:
const freeRoomEnabled = useUiStore(selectFreeRoomEnabled)
const toggleFreeRoomEnabled = useUiStore(selectToggleFreeRoomEnabled)
```

- [ ] **Step 4.4: Update desktop nav to use split arrays + add FeatureLabPanel**

Find the desktop `<nav>` block (starts with `<nav id="tour-sidebar-nav" ...>`). Replace `{navItems.map(...)}` with both groups, then add `<FeatureLabPanel>` after `</nav>`:

```tsx
<nav
  id="tour-sidebar-nav"
  className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:space-y-2 lg:overflow-visible lg:pb-0"
>
  {staticNavItems.map((item) => (
    <NavLink
      key={item.to}
      to={item.to}
      end
      className="block shrink-0 min-w-[8.5rem] lg:min-w-0"
    >
      {({ isActive }) => (
        <div className="relative">
          {isActive && !sidebarCollapsed ? (
            <motion.div
              className="nav-candy-thumb absolute -left-[22px] top-1/2 h-[86%] hidden lg:block"
              layoutId="nav-indicator"
              style={{ y: '-50%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            />
          ) : null}
          <motion.div
            animate={{
              x: isActive && !sidebarCollapsed ? 4 : 0,
              y: isActive ? -3 : 0,
              scale: isActive ? 1.02 : 1,
            }}
            whileHover={{ x: -2, y: -2 }}
            whileTap={{ x: 2, y: 2 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className={[
              'brutal-surface p-4 transition-[opacity,box-shadow]',
              item.surfaceClassName,
              isActive
                ? 'shadow-[5px_5px_0_var(--accent)] border-[var(--accent)]'
                : 'opacity-65 hover:opacity-90',
            ].join(' ')}
          >
            {sidebarCollapsed ? (
              <div className="flex items-center justify-center">
                <span className="flex size-6 items-center justify-center" aria-hidden>
                  {item.icon ? (
                    <Icon name={item.icon} variant="clay" size={24} aria-hidden />
                  ) : null}
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-[2.5rem_1fr] items-center gap-x-2 text-left font-heading text-lg font-bold">
                <span
                  className="flex size-6 items-center justify-center justify-self-center"
                  aria-hidden
                >
                  {item.icon ? (
                    <Icon name={item.icon} variant="clay" size={24} aria-hidden />
                  ) : null}
                </span>
                <AnimatePresence>
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, delay: 0.1 }}
                  >
                    {item.label}
                  </motion.span>
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </NavLink>
  ))}
  <AnimatePresence initial={false}>
    {freeRoomEnabled &&
      freeRoomNavItems.map((item, i) => (
        <motion.div
          key={item.to}
          initial={{ opacity: 0, y: -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{
            duration: 0.22,
            delay: i * 0.05,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="block shrink-0 min-w-[8.5rem] lg:min-w-0"
        >
          <NavLink to={item.to} end className="block">
            {({ isActive }) => (
              <div className="relative">
                {isActive && !sidebarCollapsed ? (
                  <motion.div
                    className="nav-candy-thumb absolute -left-[22px] top-1/2 h-[86%] hidden lg:block"
                    layoutId="nav-indicator"
                    style={{ y: '-50%' }}
                    transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                  />
                ) : null}
                <motion.div
                  animate={{
                    x: isActive && !sidebarCollapsed ? 4 : 0,
                    y: isActive ? -3 : 0,
                    scale: isActive ? 1.02 : 1,
                  }}
                  whileHover={{ x: -2, y: -2 }}
                  whileTap={{ x: 2, y: 2 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  className={[
                    'brutal-surface p-4 transition-[opacity,box-shadow]',
                    item.surfaceClassName,
                    isActive
                      ? 'shadow-[5px_5px_0_var(--accent)] border-[var(--accent)]'
                      : 'opacity-65 hover:opacity-90',
                  ].join(' ')}
                >
                  {sidebarCollapsed ? (
                    <div className="flex items-center justify-center">
                      <span className="flex size-6 items-center justify-center" aria-hidden>
                        {item.icon ? (
                          <Icon name={item.icon} variant="clay" size={24} aria-hidden />
                        ) : null}
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-[2.5rem_1fr] items-center gap-x-2 text-left font-heading text-lg font-bold">
                      <span
                        className="flex size-6 items-center justify-center justify-self-center"
                        aria-hidden
                      >
                        {item.icon ? (
                          <Icon name={item.icon} variant="clay" size={24} aria-hidden />
                        ) : null}
                      </span>
                      <AnimatePresence>
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2, delay: 0.1 }}
                        >
                          {item.label}
                        </motion.span>
                      </AnimatePresence>
                    </div>
                  )}
                </motion.div>
              </div>
            )}
          </NavLink>
        </motion.div>
      ))}
  </AnimatePresence>
</nav>
<FeatureLabPanel
  collapsed={sidebarCollapsed}
  enabled={freeRoomEnabled}
  onToggle={toggleFreeRoomEnabled}
/>
```

- [ ] **Step 4.5: Update mobile nav to use split arrays + add FeatureLabPanel**

Find the mobile `<nav>` block (inside `<aside className="space-y-5 lg:hidden">`). Replace `{navItems.map(...)}` with both groups, then add `<FeatureLabPanel>` after `</nav>`:

```tsx
<nav className="flex gap-2 overflow-x-auto pb-1">
  {staticNavItems.map((item) => (
    <NavLink key={item.to} to={item.to} end className="block shrink-0 min-w-[8.5rem]">
      {({ isActive }) => (
        <motion.div
          animate={{
            x: isActive ? 4 : 0,
            y: isActive ? -3 : 0,
            scale: isActive ? 1.02 : 1,
          }}
          whileHover={{ x: -2, y: -2 }}
          whileTap={{ x: 2, y: 2 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className={[
            'brutal-surface p-4 transition-[opacity,box-shadow]',
            item.surfaceClassName,
            isActive
              ? 'shadow-[5px_5px_0_var(--accent)] border-[var(--accent)]'
              : 'opacity-65 hover:opacity-90',
          ].join(' ')}
        >
          <div className="grid grid-cols-[2.5rem_1fr] items-center gap-x-2 text-left font-heading text-lg font-bold">
            <span
              className="flex size-6 items-center justify-center justify-self-center"
              aria-hidden
            >
              {item.icon ? (
                <Icon name={item.icon} variant="clay" size={24} aria-hidden />
              ) : null}
            </span>
            <span>{item.label}</span>
          </div>
        </motion.div>
      )}
    </NavLink>
  ))}
  <AnimatePresence initial={false}>
    {freeRoomEnabled &&
      freeRoomNavItems.map((item, i) => (
        <motion.div
          key={item.to}
          initial={{ opacity: 0, y: -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{
            duration: 0.22,
            delay: i * 0.05,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="block shrink-0 min-w-[8.5rem]"
        >
          <NavLink to={item.to} end className="block">
            {({ isActive }) => (
              <motion.div
                animate={{
                  x: isActive ? 4 : 0,
                  y: isActive ? -3 : 0,
                  scale: isActive ? 1.02 : 1,
                }}
                whileHover={{ x: -2, y: -2 }}
                whileTap={{ x: 2, y: 2 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                className={[
                  'brutal-surface p-4 transition-[opacity,box-shadow]',
                  item.surfaceClassName,
                  isActive
                    ? 'shadow-[5px_5px_0_var(--accent)] border-[var(--accent)]'
                    : 'opacity-65 hover:opacity-90',
                ].join(' ')}
              >
                <div className="grid grid-cols-[2.5rem_1fr] items-center gap-x-2 text-left font-heading text-lg font-bold">
                  <span
                    className="flex size-6 items-center justify-center justify-self-center"
                    aria-hidden
                  >
                    {item.icon ? (
                      <Icon name={item.icon} variant="clay" size={24} aria-hidden />
                    ) : null}
                  </span>
                  <span>{item.label}</span>
                </div>
              </motion.div>
            )}
          </NavLink>
        </motion.div>
      ))}
  </AnimatePresence>
</nav>
<FeatureLabPanel
  collapsed={false}
  enabled={freeRoomEnabled}
  onToggle={toggleFreeRoomEnabled}
/>
```

- [ ] **Step 4.6: Typecheck**

```bash
cd packages/dashboard && bun run typecheck
```

Expected: no errors. If there are unused import errors for the old `navItems` type, remove that variable.

- [ ] **Step 4.7: Run all dashboard tests**

```bash
bun test packages/dashboard
```

Expected: all existing tests pass, plus the new ones from Tasks 1–3.

- [ ] **Step 4.8: Visual verification**

Start the dashboard dev server:

```bash
cd packages/dashboard && bun run dev
```

Open `http://localhost:5173` (or whatever port Vite uses). Verify:

1. Sidebar shows Dashboard, New Room, Webhook Guide — **no** Free Rooms or New Free Room
2. "⚗️ FEATURE LAB" panel visible at the bottom of sidebar
3. Clicking the pill toggle → Free Rooms + New Free Room **slide in** below Webhook Guide
4. Clicking toggle again → items **slide out**
5. Collapse sidebar → ⚗️ icon only shows for Feature Lab panel

- [ ] **Step 4.9: Commit**

```bash
git add packages/dashboard/src/layouts/app-layout.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): integrate FeatureLabPanel into sidebar with dynamic free-room nav items

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wrap free-room routes in `FreeRoomGuard`

**Files:**

- Modify: `packages/dashboard/src/router.tsx`

- [ ] **Step 5.1: Update router.tsx**

Open `packages/dashboard/src/router.tsx`. Add the `FreeRoomGuard` import and wrap the three free-room routes:

```tsx
import { createBrowserRouter } from 'react-router'
import { AppLayout } from '~/layouts/app-layout'
import { FreeRoomGuard } from '~/components/organisms/free-room-guard'
import { FreeRoomCreatePage } from '~/pages/free-room-create'
import { FreeRoomDetailPage } from '~/pages/free-room-detail'
import { FreeRoomListPage } from '~/pages/free-rooms'
import { RoomListPage } from '~/pages/room-list'
import { RoomCreatePage } from '~/pages/room-create'
import { RoomDetailPage } from '~/pages/room-detail'
import { WebhookGuidePage } from '~/pages/webhook-guide'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <RoomListPage /> },
      { path: '/rooms/new', element: <RoomCreatePage /> },
      { path: '/rooms/:id', element: <RoomDetailPage /> },
      {
        path: '/free-rooms',
        element: (
          <FreeRoomGuard>
            <FreeRoomListPage />
          </FreeRoomGuard>
        ),
      },
      {
        path: '/free-rooms/new',
        element: (
          <FreeRoomGuard>
            <FreeRoomCreatePage />
          </FreeRoomGuard>
        ),
      },
      {
        path: '/free-rooms/:id',
        element: (
          <FreeRoomGuard>
            <FreeRoomDetailPage />
          </FreeRoomGuard>
        ),
      },
      { path: '/guide', element: <WebhookGuidePage /> },
    ],
  },
])
```

- [ ] **Step 5.2: Typecheck**

```bash
cd packages/dashboard && bun run typecheck
```

Expected: no errors.

- [ ] **Step 5.3: Run full test suite**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: all tests pass, no type errors, no lint errors.

- [ ] **Step 5.4: Verify route guard in browser**

With `bun run dev` running, while **Feature Lab is OFF**:

1. Manually navigate to `http://localhost:5173/free-rooms` → should redirect to `http://localhost:5173/`
2. Manually navigate to `http://localhost:5173/free-rooms/new` → should redirect to `/`

Then enable Feature Lab: 3. Navigate to `http://localhost:5173/free-rooms` → should load Free Rooms page normally

Then toggle OFF while on `/free-rooms`: 4. Click toggle → should immediately redirect to `/`

- [ ] **Step 5.5: Commit**

```bash
git add packages/dashboard/src/router.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): wrap free-room routes with FreeRoomGuard

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Done

All 5 tasks complete. The feature is fully implemented when:

- [ ] `bun test && bun run typecheck && bun run lint` passes
- [ ] Free Rooms absent from sidebar on fresh load
- [ ] Feature Lab panel visible and functional (expanded + collapsed)
- [ ] Toggle ON → nav items animate in; toggle OFF → animate out + redirect if on `/free-rooms*`
- [ ] Direct URL access to `/free-rooms*` while disabled redirects to `/`
- [ ] State persists across page refresh

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-13-free-room-feature-toggle.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach would you like?**
