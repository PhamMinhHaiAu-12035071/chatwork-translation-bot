# Webhook Guide Step 06 "Note Your Room ID" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sixth step to the webhook guide stepper where the user enters their Chatwork Room ID and navigates to the Create Room form with it pre-filled.

**Architecture:** A new Step 06 is appended to `WebhookStepper`'s `STEPS` array. The step renders a text input controlled by local `roomIdValue` state. On the final step, the bottom-nav "Completed" div is replaced by a "Go to Create Room" button that calls `navigate('/rooms/new', { state: { originalRoomId } })`. `RoomCreatePage` reads `useLocation().state` to pre-fill `defaultValues.originalRoomId`. No shared store or localStorage is used.

**Tech Stack:** React 19, react-hook-form, react-router v7, Framer Motion, Bun test, renderToStaticMarkup

---

## Task 1: SVG illustration for Step 06

**Files:**

- Create: `packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-06-svg.tsx`
- Create: `packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-06-svg.test.tsx`
- Modify: `packages/dashboard/src/components/atoms/webhook-svgs/index.ts` (line 7 — add export)

- [ ] **Step 1: Write the failing test**

Create `packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-06-svg.test.tsx`:

```tsx
import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { WebhookStep06Svg } from './webhook-step-06-svg'

describe('WebhookStep06Svg', () => {
  it('renders without error and contains an accessible label', () => {
    const html = renderToStaticMarkup(createElement(WebhookStep06Svg))
    expect(html).toContain('aria-label')
    expect(html).toContain('Room ID')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/phamau/Desktop/projects/research/chatwork-translation-bot
bun test packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-06-svg.test.tsx
```

Expected: FAIL — `Cannot find module './webhook-step-06-svg'`

- [ ] **Step 3: Create the SVG component**

Create `packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-06-svg.tsx`:

```tsx
export function WebhookStep06Svg() {
  return (
    <svg
      viewBox="0 0 260 90"
      width="260"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Chatwork webhook edit form — note the Room ID from the room filter field before creating a room"
    >
      {/* Top nav */}
      <rect width="260" height="26" fill="#1a1f36" />
      <circle cx="12" cy="13" r="4" fill="#e84040" />
      <text x="20" y="17" fontFamily="sans-serif" fontSize="8" fill="white" fontWeight="bold">
        Edit Webhook
      </text>

      {/* Form area */}
      <rect y="26" width="260" height="64" fill="white" />

      {/* Dimmed row — Room Event context */}
      <line x1="0" y1="26" x2="260" y2="26" stroke="#eee" strokeWidth="1" />
      <text x="10" y="42" fontFamily="sans-serif" fontSize="7" fill="#bbb">
        Event
      </text>
      <circle cx="90" cy="39" r="4" fill="none" stroke="#4a90d9" strokeWidth="1.5" />
      <circle cx="90" cy="39" r="2.5" fill="#4a90d9" />
      <text x="98" y="43" fontFamily="sans-serif" fontSize="7" fill="#bbb">
        Room Event ✓
      </text>

      {/* Divider */}
      <line x1="0" y1="50" x2="260" y2="50" stroke="#eee" strokeWidth="1" />

      {/* Room ID label */}
      <text x="10" y="66" fontFamily="sans-serif" fontSize="7.5" fill="#444" fontWeight="500">
        Room ID:
      </text>

      {/* Room ID value — highlighted */}
      <rect
        x="50"
        y="56"
        width="82"
        height="16"
        rx="2"
        fill="rgba(232,64,64,0.08)"
        stroke="#e84040"
        strokeWidth="3"
      />
      <text x="56" y="67" fontFamily="sans-serif" fontSize="8" fill="#1a1a2e" fontWeight="bold">
        424846369
      </text>

      {/* Label shadow */}
      <rect x="56" y="45" width="80" height="14" rx="14" fill="#1a1a2e" />
      {/* Label — Shantell Sans, dark outline */}
      <rect
        x="52"
        y="41"
        width="80"
        height="14"
        rx="14"
        fill="#e84040"
        stroke="#1a1a2e"
        strokeWidth="2.5"
      />
      <text
        x="92"
        y="51.5"
        fontFamily="'Shantell Sans', cursive"
        fontSize="7.5"
        fill="white"
        fontWeight="800"
        textAnchor="middle"
      >
        Note this ID ↓
      </text>
    </svg>
  )
}
```

- [ ] **Step 4: Add export to index.ts**

Open `packages/dashboard/src/components/atoms/webhook-svgs/index.ts` and append:

```ts
export { WebhookStep06Svg } from './webhook-step-06-svg'
```

Full file after edit:

```ts
// SVG illustration components for the webhook setup guide.
// Exports added incrementally as each step SVG is implemented.
export { WebhookStep01Svg } from './webhook-step-01-svg'
export { WebhookStep02Svg } from './webhook-step-02-svg'
export { WebhookStep03Svg } from './webhook-step-03-svg'
export { WebhookStep04Svg } from './webhook-step-04-svg'
export { WebhookStep05Svg } from './webhook-step-05-svg'
export { WebhookStep06Svg } from './webhook-step-06-svg'
```

- [ ] **Step 5: Run test to verify it passes**

```bash
bun test packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-06-svg.test.tsx
```

Expected: PASS — 1 test

- [ ] **Step 6: Commit**

```bash
git add packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-06-svg.tsx \
        packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-06-svg.test.tsx \
        packages/dashboard/src/components/atoms/webhook-svgs/index.ts
git commit -m "feat(repo): add WebhookStep06Svg illustration for room ID step"
```

---

## Task 2: Add Step 06 data to WebhookStepper

**Files:**

- Modify: `packages/dashboard/src/components/molecules/webhook-stepper.tsx` (lines 1–86 — imports, Step type, STEPS, CARD_THEMES, PILL_COLORS, TILTS_BY_INDEX)
- Modify: `packages/dashboard/src/components/molecules/webhook-stepper.test.tsx` (line 16 — update '1 of 5' assertion; add step 06 source assertion)

This task only updates the data layer (STEPS array + config arrays + type). No UI behavior changes yet.

- [ ] **Step 1: Update the existing test + add step 06 data assertion**

Open `packages/dashboard/src/components/molecules/webhook-stepper.test.tsx`.

Change line 16 from:

```ts
expect(html).toContain('1 of 5')
```

to:

```ts
expect(html).toContain('1 of 6')
```

Also add a new `it` block at the end of the `describe`:

```ts
it('step 06 is defined with the correct title and action type', async () => {
  const source = await Bun.file(new URL('./webhook-stepper.tsx', import.meta.url)).text()

  expect(source).toContain("title: 'Note Your Room ID'")
  expect(source).toContain("action: 'roomId'")
  expect(source).toContain("'theme-card-lilac'")
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test packages/dashboard/src/components/molecules/webhook-stepper.test.tsx
```

Expected: FAIL — `expected "1 of 5" to be present` and `expected "title: 'Note Your Room ID'" to be present`

- [ ] **Step 3: Update webhook-stepper.tsx — imports, type, STEPS, config arrays**

In `packages/dashboard/src/components/molecules/webhook-stepper.tsx`:

**3a — Add `WebhookStep06Svg` to the SVG import (line 8–14):**

```tsx
import {
  WebhookStep01Svg,
  WebhookStep02Svg,
  WebhookStep03Svg,
  WebhookStep04Svg,
  WebhookStep05Svg,
  WebhookStep06Svg,
} from '~/components/atoms/webhook-svgs'
```

**3b — Add `'roomId'` to `action` type in the `Step` interface (line 24):**

```ts
interface Step {
  number: string
  title: string
  body: string
  action?: 'link' | 'copy' | 'none' | 'roomId'
  actionLabel?: string
  svgFragment: React.ReactNode
}
```

**3c — Append Step 06 to the STEPS array (after the closing `}` of step 05, before the `]`):**

```ts
  {
    number: '06',
    title: 'Note Your Room ID',
    body: 'Enter the Room ID you used in the previous step. You will need it when creating a room in this dashboard.',
    action: 'roomId',
    svgFragment: <WebhookStep06Svg />,
  },
```

**3d — Extend the three `as const` arrays by one element each:**

```ts
const CARD_THEMES = [
  'theme-card-matcha',
  'theme-card-lilac',
  'theme-card-sky',
  'theme-card-matcha',
  'theme-card-peach',
  'theme-card-lilac',
] as const

const PILL_COLORS = [
  'bg-[#6e77e5]',
  'bg-[#e8a065]',
  'bg-[#5bb89a]',
  'bg-[#d44470]',
  'bg-[#6e77e5]',
  'bg-[#5bb89a]',
] as const

const TILTS_BY_INDEX = ['left', 'right', 'flat', 'left', 'right', 'left'] as const
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test packages/dashboard/src/components/molecules/webhook-stepper.test.tsx
```

Expected: PASS — all tests green

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/src/components/molecules/webhook-stepper.tsx \
        packages/dashboard/src/components/molecules/webhook-stepper.test.tsx
git commit -m "feat(repo): add step 06 data to WebhookStepper STEPS array and config"
```

---

## Task 3: WebhookStepper — Room ID input and navigate button

**Files:**

- Modify: `packages/dashboard/src/components/molecules/webhook-stepper.tsx` (component body — state, inline action, bottom nav)
- Modify: `packages/dashboard/src/components/molecules/webhook-stepper.test.tsx` (add source assertions for state, disabled logic, navigate call)

- [ ] **Step 1: Add source assertions to the test**

Append these two `it` blocks inside the `describe` in `packages/dashboard/src/components/molecules/webhook-stepper.test.tsx`:

```ts
it('step 6 renders a room ID input and a navigate button with disabled-when-empty logic', async () => {
  const source = await Bun.file(new URL('./webhook-stepper.tsx', import.meta.url)).text()

  expect(source).toContain('roomIdValue')
  expect(source).toContain('activeStep === 5')
  expect(source).toContain('inputMode="numeric"')
  expect(source).toContain('roomIdValue.trim() === ')
  expect(source).toContain('Go to Create Room')
})

it('navigates to /rooms/new with originalRoomId in Router state on step 6 button click', async () => {
  const source = await Bun.file(new URL('./webhook-stepper.tsx', import.meta.url)).text()

  expect(source).toContain("'/rooms/new'")
  expect(source).toContain('originalRoomId')
  expect(source).toContain('useNavigate')
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test packages/dashboard/src/components/molecules/webhook-stepper.test.tsx
```

Expected: FAIL — the two new assertions fail (source does not yet contain `roomIdValue`, etc.)

- [ ] **Step 3: Update webhook-stepper.tsx — add useNavigate, state, inline action, bottom nav**

**3a — Add `useNavigate` import at the top of the file (after the `useState` import line):**

```tsx
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Icon } from '~/components/atoms/icons'
// ... rest of imports unchanged
```

**3b — Add `roomIdValue` state and `navigate` inside `WebhookStepper` function body, right after the existing `const { copied, copy } = useCopyClipboard()` line:**

```tsx
export function WebhookStepper({ webhookUrl }: WebhookStepperProps) {
  const [activeStep, setActiveStep] = useState(0)
  const { copied, copy } = useCopyClipboard()
  const [roomIdValue, setRoomIdValue] = useState('')
  const navigate = useNavigate()

  // ... rest of the function unchanged until activeConfig/activeTheme/activeTilt
```

**3c — Add the Step 06 inline action block inside `BrutalCard`, after the existing `{activeStep === 2 ? ... : null}` block (around line 212):**

```tsx
{
  activeStep === 5 ? (
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-[14px] border-[3px] border-[var(--border)] bg-white/80 px-4 py-2.5 shadow-[3px_3px_0_var(--border)]">
        <span className="flex size-6 shrink-0 items-center justify-center" aria-hidden>
          <Icon name="link" variant="clay" size={24} aria-hidden />
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={roomIdValue}
          onChange={(e) => {
            setRoomIdValue(e.target.value)
          }}
          placeholder="e.g. 424846369"
          aria-label="Your Chatwork Room ID"
          className="font-ui-body flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none"
        />
      </div>
    </div>
  ) : null
}
```

**3d — Replace the `motion.div key="completed"` branch in the bottom nav with a `motion.button key="go-create"`. The current block to replace is:**

```tsx
          ) : (
            <motion.div
              key="completed"
              className="brutal-button theme-button-matcha flex items-center justify-center px-5 py-2.5 font-heading text-sm font-bold text-white"
              initial={{ opacity: 0, scale: 0.85, rotate: -8 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.85, rotate: 8 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              Completed
            </motion.div>
```

Replace with:

```tsx
          ) : (
            <motion.button
              key="go-create"
              type="button"
              disabled={roomIdValue.trim() === ''}
              onClick={() => {
                void navigate('/rooms/new', {
                  state: { originalRoomId: roomIdValue.trim() },
                })
              }}
              className="brutal-button theme-button-matcha inline-flex items-center gap-2 px-5 py-2.5 font-heading text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              initial={{ opacity: 0, scale: 0.85, rotate: -8 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.85, rotate: 8 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              Go to Create Room
              <Icon name="arrow-right" variant="stroke" size={15} aria-hidden />
            </motion.button>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test packages/dashboard/src/components/molecules/webhook-stepper.test.tsx
```

Expected: PASS — all tests green

- [ ] **Step 5: Run full dashboard tests to check for regressions**

```bash
bun test --filter packages/dashboard
```

Expected: all 130+ tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/dashboard/src/components/molecules/webhook-stepper.tsx \
        packages/dashboard/src/components/molecules/webhook-stepper.test.tsx
git commit -m "feat(repo): add Room ID input and navigate button to WebhookStepper step 06"
```

---

## Task 4: RoomCreatePage — pre-fill originalRoomId from Router state

**Files:**

- Modify: `packages/dashboard/src/pages/room-create.tsx` (imports + defaultValues)
- Modify: `packages/dashboard/src/pages/room-create.test.tsx` (add pre-fill test helper + two new it blocks)

- [ ] **Step 1: Write the failing tests**

Open `packages/dashboard/src/pages/room-create.test.tsx`.

After the existing `renderRoomCreatePage` function, add a second helper:

```ts
function renderRoomCreatePageWithState(state: Record<string, unknown>) {
  const router = createMemoryRouter(
    [
      {
        path: '/rooms/new',
        element: createElement(ToastProvider, null, createElement(RoomCreatePage)),
      },
    ],
    { initialEntries: [{ pathname: '/rooms/new', state }] },
  )

  return renderToStaticMarkup(createElement(RouterProvider, { router }))
}
```

Add two new `it` blocks inside the `describe('RoomCreatePage', ...)`:

```ts
it('pre-fills originalRoomId when Router location state contains originalRoomId', () => {
  const html = renderRoomCreatePageWithState({ originalRoomId: '424846369' })
  expect(html).toContain('424846369')
})

it('leaves originalRoomId empty when Router location state is absent', () => {
  const html = renderRoomCreatePage()
  // the field must not contain a pre-filled number when arriving without state
  expect(html).not.toContain('424846369')
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test packages/dashboard/src/pages/room-create.test.tsx
```

Expected: FAIL — `expected "424846369" to be present` (pre-fill test fails because `originalRoomId` is not yet read from state)

- [ ] **Step 3: Update room-create.tsx — add useLocation and pre-fill defaultValues**

**3a — Add `useLocation` to the react-router import (line 6 of `room-create.tsx`):**

```tsx
import { useNavigate, useLocation } from 'react-router'
```

**3b — Inside `RoomCreatePage()`, add these two lines immediately before the `useForm` call:**

```tsx
const location = useLocation()
const prefillRoomId = (location.state as { originalRoomId?: string } | null)?.originalRoomId
```

**3c — Update `defaultValues` in `useForm` to include `originalRoomId`:**

```tsx
const {
  register,
  handleSubmit,
  watch,
  setValue,
  getValues,
  setError,
  formState: { errors, isSubmitting },
} = useForm<RoomCreateInput>({
  resolver: roomCreateResolver,
  defaultValues: {
    originalRoomId: prefillRoomId !== undefined ? Number(prefillRoomId) : undefined,
    aiProvider: 'openai',
    translationStyle: 'PROFESSIONAL_BUSINESS',
    aiModel: 'gpt-5.4-pro',
    destinationRoomName: '',
    aiApiToken: '',
  },
})
```

Note: `Number(prefillRoomId)` converts the string to a number. react-hook-form renders the number as a string in the `<input value>` attribute. If `prefillRoomId` is undefined (no state), `originalRoomId` remains undefined — same as before (field starts empty).

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test packages/dashboard/src/pages/room-create.test.tsx
```

Expected: PASS — all tests green

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: 596+ tests pass, 0 typecheck errors, 0 lint errors

- [ ] **Step 6: Commit**

```bash
git add packages/dashboard/src/pages/room-create.tsx \
        packages/dashboard/src/pages/room-create.test.tsx
git commit -m "feat(repo): pre-fill originalRoomId in Create Room from webhook guide Router state"
```

---

## Done

All four tasks complete. The webhook guide now has 6 steps. Step 06 lets the user enter their Room ID and navigate directly to the Create Room form with it pre-filled.

Verify the full feature end-to-end:

1. `bun test && bun run typecheck && bun run lint` — should be green
2. Open `/guide` in the browser, step through to Step 06, type a Room ID, click "Go to Create Room" — the Create Room form should have the ID pre-filled in the "Original Room ID" field
