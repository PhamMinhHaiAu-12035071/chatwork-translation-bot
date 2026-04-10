# Free Rooms Feature Toggle — Design Specification

> **Version:** 1.0
> **Date:** 2026-04-10
> **Prepared by:** AI-assisted (Claude Sonnet 4.6)
> **Status:** Approved for Implementation

---

## Summary

Hide "Free Rooms" and "New Free Room" from the sidebar navigation by default. Users unlock them via a "⚗️ FEATURE LAB" panel at the bottom of the sidebar using a Neubrutalism-styled brutal pill toggle. State persists to localStorage via Zustand. Routes are guarded — direct URL access to `/free-rooms*` redirects to `/` when the feature is disabled.

---

## Objective

- Remove Free Rooms nav items from the default sidebar view to reduce cognitive load for users who don't use this feature.
- Provide a discoverable, delightful UI for enabling the feature — consistent with the Neubrutalism 3D design system.
- Ensure no route is accessible when the feature is disabled.

## Scope

**In scope:**

- `freeRoomEnabled` flag in `ui-store.ts` (Zustand persist)
- `FeatureLabPanel` component (sidebar section with brutal pill toggle)
- `FreeRoomGuard` route guard component
- Dynamic nav filtering in `app-layout.tsx`
- Framer-motion animation for nav items appearing/disappearing
- Collapsed sidebar (80px) handling for Feature Lab panel

**Out of scope:**

- Backend feature flags
- Per-user or per-room feature settings
- Any changes to free-room API, pages, or data model
- Tour/onboarding updates (separate concern)

## Non-Goals

- Multi-user or role-based access control for this feature
- Analytics/telemetry on feature enable/disable events
- Feature flag management UI beyond this single toggle

---

## Architecture

### State — `stores/ui-store.ts`

Add two fields to `UiStoreState`:

```ts
freeRoomEnabled: boolean          // default: false
toggleFreeRoomEnabled: () => void
```

The existing persist key `chatwork-bot-ui-store` absorbs the new field via Zustand's merge strategy — no migration needed, no breaking change to existing localStorage data.

Add two selectors:

```ts
export const selectFreeRoomEnabled = (s: UiStoreState) => s.freeRoomEnabled
export const selectToggleFreeRoomEnabled = (s: UiStoreState) => s.toggleFreeRoomEnabled
```

### Navigation — `layouts/app-layout.tsx`

Split the existing `navItems` readonly array into two:

```ts
const staticNavItems = [
  { to: '/', label: 'Dashboard', surfaceClassName: 'theme-card-matcha', icon: 'dashboard' },
  { to: '/rooms/new', label: 'New Room', surfaceClassName: 'theme-card-blush', icon: 'plus' },
  { to: '/guide', label: 'Webhook Guide', surfaceClassName: 'theme-card-sky', icon: 'book' },
]

const freeRoomNavItems = [
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

In the desktop `<nav>` and mobile `<nav>`, render `staticNavItems` unconditionally. Wrap `freeRoomNavItems` in `<AnimatePresence initial={false}>` — items only mount when `freeRoomEnabled` is true.

Add `<FeatureLabPanel>` below `<nav>` in both desktop and mobile sidebar sections. Mobile always passes `collapsed={false}` since mobile sidebar has no collapsed mode.

### New Component — `components/organisms/feature-lab-panel.tsx`

```ts
interface FeatureLabPanelProps {
  collapsed: boolean // desktop only; mobile always passes false
  enabled: boolean // freeRoomEnabled
  onToggle: () => void
}
```

**Expanded state (sidebar > 80px):**

- Outer: `brutal-surface` base class + inline `borderStyle: 'dashed'` override (signals "lab/experimental"; existing `brutal-surface` uses solid border so this requires an inline style override, not a class variant)
- Header: `StickerLabel` with "⚗️ FEATURE LAB" text (tone `warning`, tilt `flat`)
- Row: label "Free Rooms" + brutal pill toggle
  - Toggle: `width: 52px`, `height: 26px`, `border: 2px solid #111`, `border-radius: 20px`
  - OFF state: `background: #e5e7eb` (grey), knob on left
  - ON state: `background: #22c55e` (green), knob on right
  - Knob: `width: 18px`, `height: 18px`, `border: 2px solid #111`, `box-shadow: 2px 2px 0 #111`
  - Knob position: `motion.div` with `layout` animation (slides smoothly left ↔ right)
  - Pill background: CSS `transition: background-color 200ms ease`

**Collapsed state (sidebar = 80px):**

- Render only a centered `⚗️` icon (`font-size: 18px`)
- `title="Feature Lab"` for browser tooltip
- Same dashed border container, reduced padding

### New Component — `components/organisms/free-room-guard.tsx`

```tsx
export function FreeRoomGuard({ children }: { children: React.ReactNode }) {
  const enabled = useUiStore(selectFreeRoomEnabled)
  const navigate = useNavigate()

  useEffect(() => {
    if (!enabled) void navigate('/', { replace: true })
  }, [enabled, navigate])

  if (!enabled) return null
  return <>{children}</>
}
```

Handles two cases:

1. User navigates directly to `/free-rooms*` while feature is disabled → redirected to `/`
2. User is on `/free-rooms*` and toggles the feature OFF → immediately redirected to `/`

### Route Guard — `router.tsx`

Wrap all three free-room routes:

```tsx
{ path: '/free-rooms', element: <FreeRoomGuard><FreeRoomListPage /></FreeRoomGuard> },
{ path: '/free-rooms/new', element: <FreeRoomGuard><FreeRoomCreatePage /></FreeRoomGuard> },
{ path: '/free-rooms/:id', element: <FreeRoomGuard><FreeRoomDetailPage /></FreeRoomGuard> },
```

---

## Animation

### Free Room nav items (slide in/out)

```tsx
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
          delay: i * 0.05, // 50ms stagger between the two items
          ease: [0.22, 1, 0.36, 1], // consistent with rest of codebase
        }}
      >
        {/* NavLink — same render as staticNavItems */}
      </motion.div>
    ))}
</AnimatePresence>
```

`initial={false}` prevents the animation from firing on first page load.

### Pill toggle knob

```tsx
<motion.div layout transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
```

The `layout` prop handles the knob slide automatically when the container's `justify-content` switches between `flex-start` (OFF) and `flex-end` (ON).

---

## Data Flow

```
User clicks pill toggle
  → onToggle() called
  → toggleFreeRoomEnabled() in ui-store
  → freeRoomEnabled flips
  → Zustand persist writes to localStorage
  → selectFreeRoomEnabled re-renders:
      · app-layout.tsx (nav items appear/disappear via AnimatePresence)
      · FreeRoomGuard (redirects if now disabled and on /free-rooms*)
      · FeatureLabPanel (pill visual updates)
```

---

## Files Changed

| File                                             | Type     | Change                                                      |
| ------------------------------------------------ | -------- | ----------------------------------------------------------- |
| `src/stores/ui-store.ts`                         | Modified | Add `freeRoomEnabled`, `toggleFreeRoomEnabled`, 2 selectors |
| `src/layouts/app-layout.tsx`                     | Modified | Split navItems, add AnimatePresence, add FeatureLabPanel    |
| `src/router.tsx`                                 | Modified | Wrap free-room routes with FreeRoomGuard                    |
| `src/components/organisms/feature-lab-panel.tsx` | **New**  | Feature Lab panel with brutal pill toggle                   |
| `src/components/organisms/free-room-guard.tsx`   | **New**  | Route guard — redirects to `/` when disabled                |

**No new dependencies.** Uses: `framer-motion`, `zustand`, `StickerLabel`, `BrutalCard`, `react-router` — all already in the project.

---

## Acceptance Criteria

1. On fresh load, "Free Rooms" and "New Free Room" are **not visible** in the sidebar.
2. "⚗️ FEATURE LAB" panel is visible at the bottom of the sidebar (expanded and collapsed states).
3. Clicking the pill toggle → Free Rooms + New Free Room **animate in** with stagger slide.
4. Clicking the pill toggle again → items **animate out**, pill returns to grey/OFF.
5. Navigating to `/free-rooms`, `/free-rooms/new`, or `/free-rooms/:id` while disabled → **redirect to `/`**.
6. If user is on `/free-rooms` and toggles OFF → **immediately redirected to `/`**.
7. State **persists** across page refresh (localStorage).
8. Collapsed sidebar (80px) → Feature Lab shows only **⚗️ icon** centered.
9. Collapsed sidebar with Free Rooms enabled → Free Room nav items show as **icons only** (same as existing items).
10. No animation on first page load (`initial={false}` on AnimatePresence).

## Happy Path

1. User opens app → sidebar shows Dashboard, New Room, Webhook Guide, and ⚗️ FEATURE LAB panel at bottom.
2. User clicks pill toggle in Feature Lab panel (OFF → ON, grey → green).
3. "Free Rooms" and "New Free Room" slide in below "Webhook Guide" with stagger.
4. User navigates to Free Rooms, uses the feature normally.
5. User toggles OFF → items slide out, user is on `/` dashboard.

## Edge Cases

- **First install (no localStorage):** `freeRoomEnabled` defaults to `false` — Free Rooms hidden.
- **Existing localStorage without `freeRoomEnabled`:** Zustand merges with default `false` — no error.
- **Toggle OFF while on `/free-rooms/:id`:** Guard redirects to `/` immediately.
- **Collapsed sidebar + toggle:** ⚗️ icon still clickable? — No, collapsed mode is display-only. User must expand sidebar to toggle. (Clicking ⚗️ does not expand sidebar automatically — out of scope.)
- **Mobile nav:** Same `freeRoomNavItems` filter applies. FeatureLabPanel renders below mobile nav.

## Failure Cases

- **Toggle fires but Zustand update fails:** Not possible — Zustand is synchronous in-memory state. localStorage write failure (quota exceeded) is silently ignored by Zustand persist — state still works in-session.
- **User bookmarks `/free-rooms` then disables feature:** Route guard redirects on next visit. No error.

---

## Explicit Decisions

| Decision                                                   | Source                  |
| ---------------------------------------------------------- | ----------------------- |
| Feature Lab Panel at bottom of sidebar                     | User choice (Option A)  |
| Brutal pill toggle (OFF=grey, ON=green)                    | User choice (Option A)  |
| Route guard redirects to `/` when disabled                 | User choice (Option A)  |
| Show ⚗️ icon when sidebar collapsed                        | User choice (Option A)  |
| Disabled by default (`freeRoomEnabled: false`)             | User-stated requirement |
| Approach: Zustand flag + dynamic navItems + new components | User-approved           |

---

## Out of Scope

- Backend feature flags or API-driven feature gating
- Per-user feature settings (this is client-side only)
- Tour/onboarding integration for the Feature Lab
- Analytics on toggle events
- Clicking ⚗️ icon in collapsed mode expands the sidebar

## Open Risks

None — all decisions locked. Implementation is additive (new state + new components + route wrapping), no existing behavior is removed or changed.
