# Webhook Guide — Step 06 "Note Your Room ID" Design

**Version:** 1.0
**Date:** 2026-03-28
**Prepared by:** AI-assisted (Claude Sonnet 4.6)
**Status:** Approved

---

## Objective

Add a sixth step to the `WebhookStepper` that prompts the user to enter and carry their original Chatwork Room ID to the Create Room form, eliminating manual re-typing and reducing the risk of a typo or mismatch.

## Scope

- Add Step 06 to `WebhookStepper` component
- New SVG illustration: `WebhookStep06Svg`
- `RoomCreatePage` reads pre-fill value from React Router location state
- Update related tests

## Non-Goals

- No persistence beyond a single navigation (no localStorage, no backend state)
- No validation of the Room ID format in the guide step (Create Room form already validates)
- No changes to the backend or API contract

## Definition of Done

- Step 06 renders a numeric input and a "Go to Create Room" button (disabled when input is empty)
- Clicking the button navigates to `/rooms/new` with Router state `{ originalRoomId: '<value>' }`
- `RoomCreatePage` pre-fills `originalRoomId` field when arriving with that state
- Arriving at `/rooms/new` without state leaves the field empty (no regression)
- All existing tests pass; new tests added for step 06 behavior and pre-fill

## Constraints

- Follow existing Neubrutalism design system and animation patterns
- Step 06 card UI must match the inline-action pattern established by Step 03 (copy URL row)
- React Router state is the transfer mechanism — consistent with `spotlightRoomId` pattern in `RoomCreatePage`

---

## UX / UI

**Step 06 card:**

- Title: `Note Your Room ID`
- Body: `Copy the Room ID you entered in Chatwork above. You will need it when creating a room in this dashboard.`
- Action: numeric text input with placeholder `e.g. 424846369`, styled like the Step 03 URL row
- `CARD_THEMES[5]`: `'theme-card-lilac'`
- `PILL_COLORS[5]`: `'bg-[#5bb89a]'`
- `TILTS_BY_INDEX[5]`: `'left'`

**Bottom navigation for Step 06:**

- Previous button: same as all other steps
- "Go to Create Room →" replaces the `Completed` div (last step)
  - `theme-button-matcha` (same color as old Completed)
  - Disabled when `roomIdValue.trim() === ''`
  - On click: `navigate('/rooms/new', { state: { originalRoomId: roomIdValue.trim() } })`

**Step 05 ("Save Webhook") is no longer the final step:**

- Pill changes from "Final step" to "5 of 6"
- Bottom nav shows Next (not Completed) — this is automatic from the existing `activeStep < STEPS.length - 1` logic

**SVG concept (Step 06):**

- Shows the Chatwork webhook list page with a saved webhook row
- Room ID value is highlighted with red Neubrutalism annotation bracket
- Label sticker: `Your Room ID ↓`

---

## Technical Approach

### `webhook-stepper.tsx`

```ts
// New action type
action?: 'link' | 'copy' | 'none' | 'roomId'

// STEPS[5]
{
  number: '06',
  title: 'Note Your Room ID',
  body: 'Copy the Room ID you entered in Chatwork above. You will need it when creating a room in this dashboard.',
  action: 'roomId',
  svgFragment: <WebhookStep06Svg />,
}

// Array extensions
CARD_THEMES[5] = 'theme-card-lilac'
PILL_COLORS[5]  = 'bg-[#5bb89a]'
TILTS_BY_INDEX[5] = 'left'

// New state
const [roomIdValue, setRoomIdValue] = useState('')

// Step 06 inline action (inside BrutalCard, after the description/SVG grid)
{activeStep === 5 ? (
  <div className="flex items-center gap-3 rounded-[14px] border-[3px] border-[var(--border)] bg-white/80 px-4 py-2.5 shadow-[3px_3px_0_var(--border)]">
    <Icon name="hash" variant="clay" size={24} aria-hidden />
    <input
      type="text"
      inputMode="numeric"
      value={roomIdValue}
      onChange={(e) => setRoomIdValue(e.target.value)}
      placeholder="e.g. 424846369"
      className="font-ui-body flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none"
    />
  </div>
) : null}

// Bottom nav — final step (index 5) shows "Go to Create Room" instead of "Completed"
// Replace the motion.div key="completed" branch with:
<motion.button
  key="go-create"
  type="button"
  disabled={roomIdValue.trim() === ''}
  onClick={() => {
    void navigate('/rooms/new', { state: { originalRoomId: roomIdValue.trim() } })
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

// Add useNavigate import
import { useNavigate } from 'react-router'
const navigate = useNavigate()
```

### `webhook-step-06-svg.tsx` (new file)

SVG viewBox `0 0 260 110`. Shows Chatwork webhook list with a row containing Room ID highlighted.

```
Top nav: dark bar "Webhook" title
Table: 1 row — "Translation Bot" | "https://..." | 424846369 (highlighted)
Red bracket annotation around Room ID cell
Label sticker: "Your Room ID ↓"
```

### `webhook-svgs/index.ts`

```ts
export { WebhookStep06Svg } from './webhook-step-06-svg'
```

### `room-create.tsx`

```ts
import { useLocation } from 'react-router'

// Inside RoomCreatePage():
const location = useLocation()
const prefillRoomId = (location.state as { originalRoomId?: string } | null)?.originalRoomId

const { ... } = useForm<RoomCreateInput>({
  resolver: roomCreateResolver,
  defaultValues: {
    originalRoomId: prefillRoomId ? Number(prefillRoomId) : undefined,
    aiProvider: 'openai',
    translationStyle: 'PROFESSIONAL_BUSINESS',
    aiModel: 'gpt-5.4-pro',
    destinationRoomName: '',
    aiApiToken: '',
  },
})
```

---

## Testing

### `webhook-stepper.test.tsx` — update + add

- `'1 of 5'` → `'1 of 6'` (existing test must be updated)
- New: step 06 renders Room ID input placeholder
- New: "Go to Create Room" button exists in step 06 source
- New: button is disabled when input is empty (source-level assertion)

### `room-create.test.tsx` — add

- New: renders with pre-filled `originalRoomId` when Router state contains `originalRoomId`
- New: `originalRoomId` field is empty when Router state is absent (regression guard)

### `webhook-step-06-svg.test.tsx` (new file)

- Renders without error
- Contains aria-label

---

## Data / Business Rules

- Room ID is stored as a plain string inside the stepper; `Number()` conversion happens at form level in `RoomCreatePage` (consistent with existing `setValueAs` logic)
- No sanitisation in the guide step — the Create Room form's Zod schema validates format/range
- If `prefillRoomId` is not a valid number string, `Number(prefillRoomId)` produces `NaN` which Zod will reject with a field error — same as if user typed it wrong

---

## Rollout / Ops

- Pure frontend change, no server impact
- No feature flag needed — additive change (new step appended)
- No migration

---

## Risks / Trade-offs

- **Router state lost on refresh:** If user navigates to `/rooms/new` from the guide, then refreshes the page, the pre-fill is gone. Acceptable — this is a one-shot onboarding flow, not a persistent workflow. The field is clearly labelled and small to re-type.
- **No format validation in guide:** User could type non-numeric text in the guide input and the guide will still navigate. The Create Room form will catch it with a validation error. Acceptable — the guide is advisory.

---

## Acceptance Criteria

**Happy path:**

1. User completes Steps 01–05 of webhook guide
2. Step 06 appears with Room ID input and disabled "Go to Create Room" button
3. User types `424846369` → button becomes enabled
4. User clicks button → navigates to `/rooms/new` with `originalRoomId` pre-filled as `424846369`
5. Create Room form shows `424846369` in the Original Room ID field

**Edge cases:**

- User navigates to `/rooms/new` directly → `originalRoomId` field is empty (no crash)
- User types whitespace only in guide input → button remains disabled (`.trim() === ''`)
- User clears the input after typing → button becomes disabled again

**Failure cases:**

- If `useNavigate` is not available (test env without Router): component should not crash at render time (hook only called on button click)

---

## Explicit Decisions Made

| Decision                                             | Source                                           |
| ---------------------------------------------------- | ------------------------------------------------ |
| Input + navigate (not just reminder)                 | user-stated                                      |
| React Router state (not URL param, not localStorage) | user-confirmed                                   |
| Button disabled when input empty                     | ai-recommended (accepted implicitly via approve) |
| `theme-card-lilac` for step 06                       | ai-recommended                                   |

---

## Out of Scope

- Persistence of Room ID across sessions
- Auto-detect Room ID from Chatwork API
- Validate Room ID against known rooms before navigating
