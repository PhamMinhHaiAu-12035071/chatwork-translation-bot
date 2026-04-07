# Route-Scoped Tour Guide Design

**Version:** 1.0  
**Date:** 2026-04-07  
**Prepared by:** AI-assisted (brainstorming with user)  
**Status:** Draft - Awaiting user review

---

## Objective

Refactor the Tour Guide feature to run tours **scoped per route**, preventing automatic cross-page navigation. Users can click the `?` (TourFloatButton) to replay tour steps relevant to their current page only.

---

## Scope

**In Scope:**

1. Route `/` (Dashboard) with 2 variants:
   - Empty state: no rooms yet (steps 0-5: overview, sidebar, stats)
   - Has rooms: ≥1 room exists (steps 0-5 + room card interaction steps)
2. Route `/rooms/new` (Create Room): form field tour (13 steps)
3. Route `/rooms/:id` (Edit Room): reuse create room steps (13 steps)
4. Disable `?` button on routes without tour (grey out, no error logging)
5. Keep auto-start tour (first-time onboarding) unchanged - still cross-page
6. Fail-fast if selector missing on intended route

**Out of Scope:**

- Auto-start tour behavior (remains cross-page for first-time user onboarding)
- Free rooms routes (`/free-rooms`, `/free-rooms/new`)
- Webhook guide route (`/guide`)
- Tour for other dashboard pages

---

## Non-Goals

- Refactoring auto-start tour to be per-route (decision: keep 2 separate flows)
- Implementing tours for all routes in one go (focus on 3 main routes first)
- Syncing tour state across browser tabs
- Handling user navigation mid-tour (acceptable breakage)

---

## Definition of Done

### Acceptance Criteria

- [ ] Click `?` at `/` with no rooms → 6-step tour (overview + stats only), no navigation
- [ ] Click `?` at `/` with ≥1 room → 10-step tour (overview + room card), no navigation
- [ ] Click `?` at `/rooms/new` → 13-step tour (create form fields), no navigation
- [ ] Click `?` at `/rooms/:id` → 13-step tour (same as create), no navigation
- [ ] `?` button disabled (grey, 50% opacity) at `/guide` and `/free-rooms`
- [ ] No cross-page navigation triggered by any tour step
- [ ] No console errors on routes without tour
- [ ] Auto-start tour (first-time) still works cross-page
- [ ] All tests pass (unit + integration)
- [ ] TypeScript compiles with no errors
- [ ] ESLint passes with no errors

### Happy Path

1. User navigates to `/` (dashboard, no rooms)
2. Clicks `?` button
3. Tour starts with 6 steps: welcome → sidebar → stats → completion
4. User completes or skips tour
5. Tour closes, user remains on `/`

### Edge Cases Handled

1. **User navigates mid-tour:** Tour becomes "orphaned" (selectors missing). User can restart tour via `?` button.
2. **Room created/deleted mid-tour:** Tour continues with originally selected steps. User can restart after action.
3. **Element hidden mid-tour:** nextstepjs shows card at center (no arrow). Tour continues.
4. **Multiple tabs:** Each tab's tour state is independent. `tourSeenVersion` syncs via localStorage.
5. **Auto-start tour conflict:** Clicking `?` during auto-start tour restarts from step 0 (acceptable).

### Failure Cases

- Selector missing on intended route → Should never happen (design ensures correct steps per route)
- If happens anyway → Tour card displays at center with no arrow (nextstepjs default)

---

## Constraints

- **Library:** nextstepjs (cannot be replaced)
- **Pattern:** Must follow existing codebase patterns (React hooks, Zustand, React Router)
- **TypeScript:** Strict mode, no `any` types
- **No breaking changes:** Auto-start tour must remain functional
- **Performance:** No observable latency when clicking `?` button

---

## Technical Approach

### Architecture: Route-Based Tour Configs (Approach A)

**Rationale:** Clarity over DRY. Duplicate 6 steps (dashboard overview) across empty/with-room variants is acceptable trade-off for maintainability.

### Data Structure

**File:** `packages/dashboard/src/lib/tour-steps.ts`

```typescript
// Existing exports (unchanged)
export const TOUR_VERSION = 1
export const TOUR_NAME = 'main-tour' as const
export type NeubStep = Step & { color: string }

// New: Step configs per route
const dashboardEmptySteps: NeubStep[] = [
  // Steps 0-5: welcome, sidebar, stats (total, active, inactive), completion
]

const dashboardWithRoomSteps: NeubStep[] = [
  // Steps 0-5: welcome, sidebar, stats
  // Steps 6-9: room card, toggle, edit, delete, completion
]

const createRoomSteps: NeubStep[] = [
  // Steps 0-11: form fields (roomid → token → context → keywords → save)
  // Step 12: completion
]

const editRoomSteps = createRoomSteps // Alias (user-confirmed decision)

// New: Resolver function
export function getTourStepsForRoute(pathname: string, hasRooms: boolean): NeubStep[] {
  if (pathname === '/') {
    return hasRooms ? dashboardWithRoomSteps : dashboardEmptySteps
  }
  if (pathname === '/rooms/new') {
    return createRoomSteps
  }
  if (pathname.startsWith('/rooms/') && pathname !== '/rooms/new') {
    return editRoomSteps
  }
  return [] // No tour for this route
}

// New: Update global tours array (nextstepjs requirement)
export const tours: { tour: string; steps: NeubStep[] }[] = [
  { tour: TOUR_NAME, steps: [] }, // Populated dynamically
]

export function updateToursForRoute(pathname: string, hasRooms: boolean): void {
  const steps = getTourStepsForRoute(pathname, hasRooms)
  tours[0].steps = steps
}
```

**Key decisions:**

- Remove all `nextRoute`/`prevRoute` from steps (prevent navigation)
- Duplicate steps 0-5 in dashboard variants (user-confirmed trade-off)
- Edit room reuses create room steps (user-confirmed decision)
- Mutable `tours` array updated before `startNextStep()` (nextstepjs reads once at mount)

---

### Component Changes

**File:** `packages/dashboard/src/components/organisms/tour-float-button.tsx`

**Before:**

```tsx
onClick={() => startNextStep(TOUR_NAME)}
```

**After:**

```tsx
const pathname = location.pathname
const hasRooms = rooms.length > 0
const hasTourForCurrentRoute = getTourStepsForRoute(pathname, hasRooms).length > 0

const handleClick = () => {
  if (!hasTourForCurrentRoute) return // Early return (button disabled)
  updateToursForRoute(pathname, hasRooms)
  startNextStep(TOUR_NAME)
}

return (
  <button
    onClick={handleClick}
    disabled={!hasTourForCurrentRoute}
    style={{
      opacity: hasTourForCurrentRoute ? 1 : 0.5,
      cursor: hasTourForCurrentRoute ? 'pointer' : 'not-allowed',
    }}
  >
    ?
  </button>
)
```

**Changes:**

- Import `useLocation`, `useRoomStore`
- Check route before starting tour
- Disable button for routes without tour (user-confirmed: grey out, not hide)
- Update `tours` array before calling `startNextStep()`

---

**File:** `packages/dashboard/src/layouts/app-layout.tsx`

**Changes:** None. Auto-start tour logic unchanged (user-confirmed decision to keep both flows).

---

## Testing Strategy

### Unit Tests

**File:** `tour-steps.test.ts`

- `getTourStepsForRoute()` returns correct steps for each route + state combination
- `getTourStepsForRoute()` returns empty array for unknown routes
- `updateToursForRoute()` mutates global `tours` array correctly

**File:** `tour-float-button.test.tsx`

- Button calls `startNextStep()` with correct steps for dashboard empty/with-room
- Button calls `startNextStep()` with correct steps for create/edit room
- Button is disabled for routes without tour (`/guide`, `/free-rooms`)
- Disabled button does not call `startNextStep()` when clicked

### Integration Tests

**File:** `app-layout.test.tsx`

- TourFloatButton is rendered and accessible
- Existing auto-start tour tests still pass

### Manual Testing Checklist

- [ ] Dashboard empty: 6 steps, no navigation
- [ ] Dashboard with room: 10 steps, no navigation
- [ ] Create room: 13 steps, no navigation
- [ ] Edit room: 13 steps, no navigation
- [ ] Button disabled at `/guide`, `/free-rooms`
- [ ] Auto-start tour still works
- [ ] No console errors

---

## Rollout & Operations

### Deployment Strategy

- Standard deployment (no feature flag needed)
- Zero downtime (pure frontend change)
- No database migration required
- No backend changes required

### Rollback Plan

If critical bug discovered:

1. Revert commit (restore original `TourFloatButton` onClick)
2. Redeploy frontend
3. Tour reverts to global behavior

### Monitoring

- No special monitoring needed
- Check Sentry for tour-related errors (selector missing)
- User feedback via support channels

---

## Risks & Trade-offs

### Accepted Trade-offs

1. **Duplicate steps 0-5** across dashboard variants
   - **Why:** Clarity over DRY (user-confirmed, codebase philosophy)
   - **Mitigation:** If duplication becomes problematic, refactor to Approach C (shared fragments)

2. **Tour breaks if user navigates mid-tour**
   - **Why:** Simpler than tracking navigation
   - **Mitigation:** User can restart tour via `?` button

3. **Auto-start vs replay tours use different step sets**
   - **Why:** Different use cases (onboarding vs reference)
   - **Mitigation:** Document this behavior clearly

### Open Risks

1. **nextstepjs library limitations**
   - Risk: Library may have bugs with dynamic tours array
   - Mitigation: Test thoroughly in staging

2. **Future scope expansion**
   - Risk: Adding free rooms tours may require refactoring if duplication grows
   - Mitigation: Architecture designed for easy extension (add new config + route check)

---

## Explicit Decisions Made

| Decision                                                     | Provenance                        | Rationale                                    |
| ------------------------------------------------------------ | --------------------------------- | -------------------------------------------- |
| Edit room reuses create room steps                           | user-confirmed                    | Forms are nearly identical, saves effort     |
| Dashboard: 2 step variants (empty/has-room)                  | user-confirmed                    | Different contexts need different tours      |
| Missing selector = fail-fast (no error log for out-of-scope) | user-confirmed                    | Out-of-scope routes are expected, not errors |
| Keep auto-start + add replay per-route                       | user-confirmed                    | Two separate use cases                       |
| Free rooms routes out of scope                               | user-confirmed                    | Focus on 3 main routes first                 |
| Webhook guide out of scope                                   | user-confirmed                    | Static doc page, no tour value               |
| Approach A: Route-based configs                              | user-confirmed (chose A over B/C) | Clarity over DRY, easier to maintain         |
| Disable button for out-of-scope routes                       | user-confirmed (grey out)         | Better UX than hide or error                 |

---

## Future Scope / Deferred Features

**Not in current scope, user-confirmed as future work:**

1. Free rooms tours:
   - `/free-rooms` (dashboard)
   - `/free-rooms/new` (create)

2. Webhook guide tour:
   - `/guide` (static doc page)

3. Dynamic tour step filtering (Approach B)
   - May revisit if duplication becomes problematic

4. Tour state sync across tabs
   - Complex, low priority

5. Navigation tracking during tour
   - Complex, current behavior acceptable

---

## Technical Dependencies

- `nextstepjs` library (existing)
- `react-router` (existing, for `useLocation`)
- `zustand` (existing, for room store)
- No new dependencies required

---

## Migration Notes

**Breaking changes:** None

**Compatibility:**

- All existing auto-start tour logic unchanged
- `tourSeenVersion` localStorage key unchanged
- Tour completion behavior unchanged

---

**End of Design Document**
