# Route-Scoped Tour Guide Implementation Plan (Simplified)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the existing onboarding tour unchanged, and add route-scoped replay tours so the `?` button only starts steps for the current page.

**Architecture:** Preserve `main-tour` for first-time auto-start onboarding. Add private route-specific replay step arrays and route-specific tour names for `?` replay. `TourFloatButton` resolves the current replay tour from `pathname` and room state, then calls `startNextStep()` with that tour name. No mutation of shared tour definitions.

**Tech Stack:** TypeScript 5.4+, React 18, react-router v7, nextstepjs, Zustand, Bun test runner

---

## Task 1: Add route-scoped replay tour resolver (TDD)

**Files:**

- Modify: `packages/dashboard/src/lib/tour-steps.ts`
- Create: `packages/dashboard/src/lib/tour-steps.test.ts`

- [ ] **Step 1: Write failing tests for the replay tour resolver**

```typescript
import { describe, expect, it } from 'bun:test'
import { getReplayTourForRoute } from './tour-steps'

describe('getReplayTourForRoute', () => {
  it('returns dashboard empty replay tour for / with no rooms', () => {
    const replayTour = getReplayTourForRoute('/', false)

    expect(replayTour?.tour).toBe('dashboard-empty-tour')
    expect(replayTour?.steps.length).toBe(6)
  })

  it('returns dashboard with-room replay tour for / with rooms', () => {
    const replayTour = getReplayTourForRoute('/', true)

    expect(replayTour?.tour).toBe('dashboard-with-room-tour')
    expect(replayTour?.steps.length).toBe(10)
    expect(replayTour?.steps[5].selector).toBe('#tour-room-card-first')
  })

  it('returns create-room replay tour for /rooms/new', () => {
    const replayTour = getReplayTourForRoute('/rooms/new', false)

    expect(replayTour?.tour).toBe('create-room-tour')
    expect(replayTour?.steps.length).toBe(13)
    expect(replayTour?.steps[0].selector).toBe('#tour-field-roomid')
  })

  it('returns edit-room replay tour for /rooms/:id', () => {
    expect(getReplayTourForRoute('/rooms/123', false)?.tour).toBe('edit-room-tour')
    expect(getReplayTourForRoute('/rooms/abc', true)?.tour).toBe('edit-room-tour')
  })

  it('returns null for unsupported routes', () => {
    expect(getReplayTourForRoute('/guide', false)).toBeNull()
    expect(getReplayTourForRoute('/free-rooms', false)).toBeNull()
  })

  it('does not include cross-page navigation in replay steps', () => {
    const replayTour = getReplayTourForRoute('/rooms/new', false)

    expect(replayTour).not.toBeNull()
    expect(replayTour?.steps.some((step) => 'nextRoute' in step || 'prevRoute' in step)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/dashboard/src/lib/tour-steps.test.ts`

Expected: FAIL because `getReplayTourForRoute()` does not exist yet.

- [ ] **Step 3: Add private route-specific replay step arrays**

In `packages/dashboard/src/lib/tour-steps.ts`, keep the existing onboarding `steps` block unchanged. Add new private replay arrays below it by copying the same titles/content/selectors already present in the current step definitions, but removing every `nextRoute` and `prevRoute` field.

```typescript
const dashboardEmptyReplaySteps: NeubStep[] = [
  // Copy the dashboard intro/sidebar/stat steps from the current steps block.
  // Keep the same titles, content, side, showControls, showSkip, and colors.
]

const dashboardWithRoomReplaySteps: NeubStep[] = [
  // Reuse the dashboard intro/sidebar/stat steps.
  // Add room-card, status-toggle, edit, delete, and completion steps.
]

const createRoomReplaySteps: NeubStep[] = [
  // Copy the create-room form steps from the current steps block.
  // Remove nextRoute/prevRoute so replay never navigates away.
]

const editRoomReplaySteps = createRoomReplaySteps
```

- [ ] **Step 4: Add route-specific replay tour names and resolver**

Add below the replay step arrays:

```typescript
export const DASHBOARD_EMPTY_REPLAY_TOUR = 'dashboard-empty-tour' as const
export const DASHBOARD_WITH_ROOM_REPLAY_TOUR = 'dashboard-with-room-tour' as const
export const CREATE_ROOM_REPLAY_TOUR = 'create-room-tour' as const
export const EDIT_ROOM_REPLAY_TOUR = 'edit-room-tour' as const

type ReplayTourName =
  | typeof DASHBOARD_EMPTY_REPLAY_TOUR
  | typeof DASHBOARD_WITH_ROOM_REPLAY_TOUR
  | typeof CREATE_ROOM_REPLAY_TOUR
  | typeof EDIT_ROOM_REPLAY_TOUR

export type ReplayTour = {
  tour: ReplayTourName
  steps: NeubStep[]
}

export function getReplayTourForRoute(pathname: string, hasRooms: boolean): ReplayTour | null {
  if (pathname === '/') {
    return hasRooms
      ? { tour: DASHBOARD_WITH_ROOM_REPLAY_TOUR, steps: dashboardWithRoomReplaySteps }
      : { tour: DASHBOARD_EMPTY_REPLAY_TOUR, steps: dashboardEmptyReplaySteps }
  }

  if (pathname === '/rooms/new') {
    return { tour: CREATE_ROOM_REPLAY_TOUR, steps: createRoomReplaySteps }
  }

  if (pathname.startsWith('/rooms/') && pathname !== '/rooms/new') {
    return { tour: EDIT_ROOM_REPLAY_TOUR, steps: editRoomReplaySteps }
  }

  return null
}
```

- [ ] **Step 5: Keep onboarding source unchanged and append replay tours to `tours`**

Do not modify the existing onboarding `steps` definition or the auto-start logic in `packages/dashboard/src/layouts/app-layout.tsx`.

Replace the `tours` export with a combined static list:

```typescript
const replayTours: ReplayTour[] = [
  { tour: DASHBOARD_EMPTY_REPLAY_TOUR, steps: dashboardEmptyReplaySteps },
  { tour: DASHBOARD_WITH_ROOM_REPLAY_TOUR, steps: dashboardWithRoomReplaySteps },
  { tour: CREATE_ROOM_REPLAY_TOUR, steps: createRoomReplaySteps },
  { tour: EDIT_ROOM_REPLAY_TOUR, steps: editRoomReplaySteps },
]

export const tours: { tour: string; steps: NeubStep[] }[] = [
  { tour: TOUR_NAME, steps },
  ...replayTours,
]
```

- [ ] **Step 6: Run tests to verify GREEN**

Run: `bun test packages/dashboard/src/lib/tour-steps.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/dashboard/src/lib/tour-steps.ts packages/dashboard/src/lib/tour-steps.test.ts
git commit -m "feat: add route-scoped replay tour resolver"
```

---

## Task 2: Update TourFloatButton to start replay tour by route (TDD)

**Files:**

- Modify: `packages/dashboard/src/components/organisms/tour-float-button.tsx`
- Create: `packages/dashboard/src/components/organisms/tour-float-button.test.tsx`

- [ ] **Step 1: Write failing tests for route selection and disabled state**

```typescript
import { beforeEach, describe, expect, it, vi } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { TourFloatButton } from './tour-float-button'

const mockStartNextStep = vi.fn()
const mockLocation = { pathname: '/' }
const mockRooms: { id: string }[] = []

vi.mock('nextstepjs', () => ({
  useNextStep: () => ({ startNextStep: mockStartNextStep }),
}))

vi.mock('react-router', () => ({
  useLocation: () => mockLocation,
}))

vi.mock('~/stores/room-store', () => ({
  useRoomStore: (selector: (state: { rooms: { id: string }[] }) => unknown) =>
    selector({ rooms: mockRooms }),
}))

vi.mock('~/stores/ui-store', () => ({
  useUiStore: () => null,
  selectTourSeenVersion: (state: any) => state,
}))

describe('TourFloatButton', () => {
  beforeEach(() => {
    mockStartNextStep.mockClear()
    mockLocation.pathname = '/'
    mockRooms.length = 0
  })

  it.each([
    ['/', [], 'dashboard-empty-tour'],
    ['/', [{ id: 'room-1' }], 'dashboard-with-room-tour'],
    ['/rooms/new', [], 'create-room-tour'],
    ['/rooms/123', [], 'edit-room-tour'],
  ])('starts %s replay tour', (pathname, rooms, expectedTour) => {
    mockLocation.pathname = pathname
    mockRooms.splice(0, mockRooms.length, ...rooms)

    render(<TourFloatButton />)

    fireEvent.click(screen.getByRole('button', { name: /xem lại tour/i }))

    expect(mockStartNextStep).toHaveBeenCalledWith(expectedTour)
  })

  it('disables the button for unsupported routes', () => {
    mockLocation.pathname = '/guide'

    render(<TourFloatButton />)

    const button = screen.getByRole('button', { name: /xem lại tour/i })
    expect(button).toBeDisabled()
    expect(button).toHaveStyle({ opacity: '0.5' })

    fireEvent.click(button)
    expect(mockStartNextStep).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/dashboard/src/components/organisms/tour-float-button.test.tsx`

Expected: FAIL because the button still starts `TOUR_NAME` directly and does not resolve route-specific replay tours.

- [ ] **Step 3: Update TourFloatButton imports and click flow**

Replace the current imports with:

```typescript
import { useNextStep } from 'nextstepjs'
import { useLocation } from 'react-router'

import { getReplayTourForRoute } from '~/lib/tour-steps'
import { selectTourSeenVersion, useUiStore } from '~/stores/ui-store'
import { useRoomStore } from '~/stores/room-store'
```

Then replace the component logic with:

```typescript
export function TourFloatButton() {
  const { startNextStep } = useNextStep()
  const location = useLocation()
  const rooms = useRoomStore((state) => state.rooms)
  const tourSeenVersion = useUiStore(selectTourSeenVersion)
  const showBadge = tourSeenVersion === null

  const pathname = location.pathname
  const hasRooms = rooms.length > 0
  const replayTour = getReplayTourForRoute(pathname, hasRooms)
  const hasReplayTour = replayTour !== null

  const handleClick = () => {
    if (!hasReplayTour || replayTour === null) {
      return
    }

    startNextStep(replayTour.tour)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!hasReplayTour}
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 50,
        width: 52,
        height: 52,
        borderRadius: '50%',
        background: '#6e77e5',
        border: '3px solid #1a1a2e',
        boxShadow: '4px 4px 0 #1a1a2e',
        cursor: hasReplayTour ? 'pointer' : 'not-allowed',
        opacity: hasReplayTour ? 1 : 0.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Shantell Sans', cursive",
        fontSize: '1.3rem',
        fontWeight: 800,
        color: '#fff',
        transition: 'transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease',
      }}
      onMouseEnter={(e) => {
        if (hasReplayTour) {
          e.currentTarget.style.transform = 'rotate(-5deg) translate(-2px, -2px)'
          e.currentTarget.style.boxShadow = '6px 6px 0 #1a1a2e'
        }
      }}
      onMouseLeave={(e) => {
        if (hasReplayTour) {
          e.currentTarget.style.transform = ''
          e.currentTarget.style.boxShadow = '4px 4px 0 #1a1a2e'
        }
      }}
      aria-label="Xem lại tour hướng dẫn"
    >
      ?
      {showBadge && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#ff6b6b',
            border: '2px solid #1a1a2e',
            boxShadow: '1px 1px 0 #1a1a2e',
          }}
        />
      )}
    </button>
  )
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `bun test packages/dashboard/src/components/organisms/tour-float-button.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/src/components/organisms/tour-float-button.tsx packages/dashboard/src/components/organisms/tour-float-button.test.tsx
git commit -m "feat: route replay tour selection in TourFloatButton"
```

---

## Task 3: Verify behavior and keep auto-start unchanged

**Files:**

- No code changes expected unless a test exposes a bug.

- [ ] **Step 1: Run dashboard tests**

Run: `bun test packages/dashboard/`

Expected: All tests PASS.

- [ ] **Step 2: Run typecheck**

Run: `bun run typecheck`

Expected: No TypeScript errors.

- [ ] **Step 3: Run lint**

Run: `bun run lint`

Expected: No ESLint errors.

- [ ] **Step 4: Manual smoke test - dashboard empty**

1. Start dev server: `bun run dev`
2. Navigate to `/`
3. Ensure no rooms exist
4. Click `?`
5. Verify 6-step replay tour stays on dashboard

- [ ] **Step 5: Manual smoke test - dashboard with room**

1. Create a room
2. Return to `/`
3. Click `?`
4. Verify 10-step replay tour includes room card steps

- [ ] **Step 6: Manual smoke test - create room**

1. Navigate to `/rooms/new`
2. Click `?`
3. Verify 13-step replay tour covers form fields only

- [ ] **Step 7: Manual smoke test - edit room**

1. Navigate to `/rooms/:id`
2. Click `?`
3. Verify 13-step replay tour works like create room

- [ ] **Step 8: Manual smoke test - unsupported routes**

1. Navigate to `/guide`
2. Verify the `?` button is disabled and greyed out
3. Repeat for `/free-rooms` and `/free-rooms/new`

- [ ] **Step 9: Confirm auto-start is untouched**

1. Clear localStorage for tour state
2. Reload `/`
3. Verify the existing first-time onboarding auto-start tour still runs with the original cross-page flow

- [ ] **Step 10: Final verification commit**

If all checks pass, commit the final verification state.

```bash
git add -A
git commit -m "chore: verify route-scoped replay tours"
```

---

## Implementation Complete

**Total commits expected:** 3

**Files modified:**

- `packages/dashboard/src/lib/tour-steps.ts`
- `packages/dashboard/src/components/organisms/tour-float-button.tsx`

**Files created:**

- `packages/dashboard/src/lib/tour-steps.test.ts`
- `packages/dashboard/src/components/organisms/tour-float-button.test.tsx`

**What stays unchanged:**

- `packages/dashboard/src/layouts/app-layout.tsx`
- Auto-start onboarding flow

**Test coverage:**

- 6 resolver tests
- 1 table-driven route matrix for `TourFloatButton`
- 1 unsupported-route disabled-state test

**Key simplifications from the previous plan:**

- No mutable `tours[0].steps` handoff
- No exported private step arrays
- No redundant `app-layout` source-text test
- No optional docs task
- Auto-start onboarding stays stable because `main-tour` remains untouched

**Verification commands:**

```bash
bun test packages/dashboard/
bun run typecheck
bun run lint
```

All acceptance criteria from the approved spec remain intact.
