# Webhook Guide SVG Illustrations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 per-step SVG illustration components to the `/guide` webhook stepper, showing faithful Chatwork Admin UI fragments with red highlight overlays so users see exactly where to click/type.

**Architecture:** 5 static SVG React components in `components/atoms/webhook-svgs/`, exported via a barrel and imported into `webhook-stepper.tsx`. The stepper's title/body block is wrapped in a 2-column grid (instruction left, SVG right on sm+ screens).

**Tech Stack:** React 19, TypeScript 5.4+ strict, Tailwind CSS v4, `react-dom/server` renderToStaticMarkup for tests, Bun test runner.

---

## File Map

### Create

| File                                                                                | Purpose                                                         |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `packages/dashboard/src/components/atoms/webhook-svgs/index.ts`                     | Barrel export — grows per task                                  |
| `packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-01-svg.tsx`      | SVG: Chatwork Admin left sidebar, Webhook menu item highlighted |
| `packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-01-svg.test.tsx` | Smoke test                                                      |
| `packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-02-svg.tsx`      | SVG: Webhook list page, Add webhook button highlighted          |
| `packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-02-svg.test.tsx` | Smoke test                                                      |
| `packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-03-svg.tsx`      | SVG: Edit Webhook form, Webhook URL input highlighted           |
| `packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-03-svg.test.tsx` | Smoke test                                                      |
| `packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-04-svg.tsx`      | SVG: Edit Webhook form, Event section highlighted               |
| `packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-04-svg.test.tsx` | Smoke test                                                      |
| `packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-05-svg.tsx`      | SVG: Edit Webhook form, Save button highlighted                 |
| `packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-05-svg.test.tsx` | Smoke test                                                      |

### Modify

| File                                                              | What changes                                                                                                                                    |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/dashboard/src/components/molecules/webhook-stepper.tsx` | `Step` interface + `svgFragment` field, `STEPS` array entries, grid wrapper around title/body, `min-h-[280px]` → `min-h-[360px]`, barrel import |

---

## Task 1: Scaffold — Step interface + grid wrapper + empty barrel

**Files:**

- Create: `packages/dashboard/src/components/atoms/webhook-svgs/index.ts`
- Modify: `packages/dashboard/src/components/molecules/webhook-stepper.tsx`

- [ ] **Step 1: Create empty barrel**

```typescript
// packages/dashboard/src/components/atoms/webhook-svgs/index.ts
// SVG illustration components for the webhook setup guide.
// Exports added incrementally as each step SVG is implemented.
export {}
```

- [ ] **Step 2: Update `Step` interface in `webhook-stepper.tsx`**

Find the existing interface:

```typescript
interface Step {
  number: string
  title: string
  body: string
  action?: 'link' | 'copy' | 'none'
  actionLabel?: string
}
```

Replace with:

```typescript
interface Step {
  number: string
  title: string
  body: string
  action?: 'link' | 'copy' | 'none'
  actionLabel?: string
  svgFragment: React.ReactNode
}
```

- [ ] **Step 3: Add `svgFragment: null` to all STEPS entries**

Replace the entire `STEPS` array:

```typescript
const STEPS: Step[] = [
  {
    number: '01',
    title: 'Access Chatwork Admin',
    body: 'Log in to your Chatwork account. Open the Admin panel and navigate to Integrations → Webhooks.',
    action: 'link',
    actionLabel: 'Open Chatwork Admin',
    svgFragment: null,
  },
  {
    number: '02',
    title: 'Create New Webhook',
    body: 'Click "Add webhook". Give it a descriptive name — for example, the room name you are setting up — so you can recognise it later.',
    action: 'none',
    svgFragment: null,
  },
  {
    number: '03',
    title: 'Paste Webhook URL',
    body: 'Copy the URL below and paste it into the "Webhook URL" field in the Chatwork form.',
    action: 'copy',
    actionLabel: 'Copy URL',
    svgFragment: null,
  },
  {
    number: '04',
    title: 'Select Events',
    body: 'Tick "Message created" and "Message updated". Enter the original Room ID in the room filter so Chatwork only fires events for that room.',
    action: 'none',
    svgFragment: null,
  },
  {
    number: '05',
    title: 'Save Webhook',
    body: 'Click Save. Chatwork will activate the webhook. No secret needed.',
    action: 'none',
    svgFragment: null,
  },
]
```

- [ ] **Step 4: Wrap title/body block in 2-column grid + add SVG slot**

Find this exact block in the `BrutalCard` JSX:

```tsx
<div className="space-y-2">
  <h2 className="font-heading text-2xl font-bold">{activeConfig.title}</h2>
  <p className="font-ui-body text-sm leading-7 text-[var(--text-secondary)]">{activeConfig.body}</p>
</div>
```

Replace with:

```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start">
  <div className="space-y-2">
    <h2 className="font-heading text-2xl font-bold">{activeConfig.title}</h2>
    <p className="font-ui-body text-sm leading-7 text-[var(--text-secondary)]">
      {activeConfig.body}
    </p>
  </div>
  <div className="flex items-start justify-center">{activeConfig.svgFragment}</div>
</div>
```

- [ ] **Step 5: Bump `min-h` on the AnimatePresence wrapper div**

Find: `<div className="min-h-[280px]">`

Replace: `<div className="min-h-[360px]">`

- [ ] **Step 6: Run existing stepper tests — must still pass**

```bash
bun test packages/dashboard/src/components/molecules/webhook-stepper.test.tsx
```

Expected output: all pass (the grid wrapper doesn't change text content).

- [ ] **Step 7: Run typecheck**

```bash
cd packages/dashboard && bun run typecheck
```

Expected: no errors. (`null` is a valid `React.ReactNode`.)

- [ ] **Step 8: Commit**

```bash
git add \
  packages/dashboard/src/components/atoms/webhook-svgs/index.ts \
  packages/dashboard/src/components/molecules/webhook-stepper.tsx
git commit -m "feat(dashboard): scaffold svgFragment slot in WebhookStepper"
```

---

## Task 2: WebhookStep01Svg — Admin navigation

**Files:**

- Create: `packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-01-svg.tsx`
- Create: `packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-01-svg.test.tsx`
- Modify: `packages/dashboard/src/components/atoms/webhook-svgs/index.ts`
- Modify: `packages/dashboard/src/components/molecules/webhook-stepper.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-01-svg.test.tsx
import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { WebhookStep01Svg } from './webhook-step-01-svg'

describe('WebhookStep01Svg', () => {
  it('renders an svg element', () => {
    const html = renderToStaticMarkup(createElement(WebhookStep01Svg, null))
    expect(html).toContain('<svg')
  })

  it('has role img and a non-empty aria-label', () => {
    const html = renderToStaticMarkup(createElement(WebhookStep01Svg, null))
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
bun test packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-01-svg.test.tsx
```

Expected: FAIL — `Cannot find module './webhook-step-01-svg'`

- [ ] **Step 3: Create the SVG component**

```tsx
// packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-01-svg.tsx
export function WebhookStep01Svg() {
  return (
    <svg
      viewBox="0 0 260 170"
      width="260"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Chatwork Admin — navigate to Integrations → API → Webhook"
    >
      {/* Top nav bar */}
      <rect width="260" height="30" fill="#1a1f36" />
      <circle cx="14" cy="15" r="5" fill="#e84040" />
      <text x="24" y="19" fontFamily="sans-serif" fontSize="9" fill="white" fontWeight="bold">
        Chatwork
      </text>
      <text x="214" y="19" fontFamily="sans-serif" fontSize="8" fill="#888">
        Logout
      </text>

      {/* Sidebar */}
      <rect y="30" width="128" height="140" fill="#f5f5f5" />
      <line x1="128" y1="30" x2="128" y2="170" stroke="#ddd" strokeWidth="1" />

      {/* Main content hint */}
      <rect x="128" y="30" width="132" height="140" fill="white" />
      <text x="158" y="80" fontFamily="sans-serif" fontSize="8" fill="#e0e0e0">
        Admin Panel
      </text>

      {/* Integrations section header */}
      <rect x="0" y="40" width="3" height="12" fill="#e84040" />
      <text x="9" y="50" fontFamily="sans-serif" fontSize="8" fill="#e84040" fontWeight="bold">
        Integrations
      </text>

      {/* Integrations sub-items */}
      <text x="13" y="65" fontFamily="sans-serif" fontSize="7.5" fill="#555">
        3rd-Party Integrations
      </text>
      <text x="13" y="78" fontFamily="sans-serif" fontSize="7.5" fill="#555">
        Authorized OAuth Service
      </text>

      {/* API section header */}
      <rect x="0" y="88" width="3" height="12" fill="#e84040" />
      <text x="9" y="98" fontFamily="sans-serif" fontSize="8" fill="#e84040" fontWeight="bold">
        API
      </text>

      {/* API sub-items */}
      <text x="13" y="113" fontFamily="sans-serif" fontSize="7.5" fill="#555">
        API Token
      </text>
      <text x="13" y="126" fontFamily="sans-serif" fontSize="7.5" fill="#555">
        OAuth
      </text>

      {/* Webhook item — highlighted */}
      <rect x="0" y="131" width="128" height="20" fill="rgba(232,64,64,0.07)" />
      <rect x="0" y="131" width="3" height="20" fill="#e84040" />
      <text x="9" y="145" fontFamily="sans-serif" fontSize="8" fill="#1a1a2e" fontWeight="bold">
        ▶ Webhook
      </text>

      {/* Red dashed highlight border */}
      <rect
        x="2"
        y="132"
        width="124"
        height="18"
        rx="2"
        fill="none"
        stroke="#e84040"
        strokeWidth="1.5"
        strokeDasharray="3,2"
      />

      {/* Pill label */}
      <rect x="58" y="120" width="64" height="12" rx="6" fill="#e84040" />
      <text x="90" y="129" fontFamily="sans-serif" fontSize="7" fill="white" textAnchor="middle">
        ← Click here
      </text>
    </svg>
  )
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
bun test packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-01-svg.test.tsx
```

Expected: 2 pass.

- [ ] **Step 5: Export from barrel**

Replace `packages/dashboard/src/components/atoms/webhook-svgs/index.ts` contents:

```typescript
export { WebhookStep01Svg } from './webhook-step-01-svg'
```

- [ ] **Step 6: Wire into `webhook-stepper.tsx`**

Add import after the existing imports at the top of the file:

```typescript
import { WebhookStep01Svg } from '~/components/atoms/webhook-svgs'
```

Update STEPS[0] — change `svgFragment: null` to:

```typescript
    svgFragment: <WebhookStep01Svg />,
```

- [ ] **Step 7: Run stepper tests**

```bash
bun test packages/dashboard/src/components/molecules/webhook-stepper.test.tsx
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add \
  packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-01-svg.tsx \
  packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-01-svg.test.tsx \
  packages/dashboard/src/components/atoms/webhook-svgs/index.ts \
  packages/dashboard/src/components/molecules/webhook-stepper.tsx
git commit -m "feat(dashboard): add WebhookStep01Svg — admin navigation"
```

---

## Task 3: WebhookStep02Svg — Add Webhook button

**Files:**

- Create: `packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-02-svg.tsx`
- Create: `packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-02-svg.test.tsx`
- Modify: `packages/dashboard/src/components/atoms/webhook-svgs/index.ts`
- Modify: `packages/dashboard/src/components/molecules/webhook-stepper.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-02-svg.test.tsx
import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { WebhookStep02Svg } from './webhook-step-02-svg'

describe('WebhookStep02Svg', () => {
  it('renders an svg element', () => {
    const html = renderToStaticMarkup(createElement(WebhookStep02Svg, null))
    expect(html).toContain('<svg')
  })

  it('has role img and a non-empty aria-label', () => {
    const html = renderToStaticMarkup(createElement(WebhookStep02Svg, null))
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
bun test packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-02-svg.test.tsx
```

Expected: FAIL — `Cannot find module './webhook-step-02-svg'`

- [ ] **Step 3: Create the SVG component**

> Note: Step 02 shows the Chatwork webhook **list** page (not the Edit page in the reference screenshot). This is recreated from knowledge of the Chatwork Admin UI.

```tsx
// packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-02-svg.tsx
export function WebhookStep02Svg() {
  return (
    <svg
      viewBox="0 0 260 130"
      width="260"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Chatwork Admin — click Add webhook to create a new webhook"
    >
      {/* Top nav */}
      <rect width="260" height="30" fill="#1a1f36" />
      <circle cx="14" cy="15" r="5" fill="#e84040" />
      <text x="24" y="19" fontFamily="sans-serif" fontSize="9" fill="white" fontWeight="bold">
        Chatwork Admin
      </text>

      {/* Page content */}
      <rect y="30" width="260" height="100" fill="white" />

      {/* Page title */}
      <text x="12" y="54" fontFamily="sans-serif" fontSize="12" fill="#1a1a2e" fontWeight="bold">
        Webhook
      </text>

      {/* Add webhook button */}
      <rect x="170" y="38" width="78" height="22" rx="3" fill="#1a4080" />
      <text
        x="209"
        y="52"
        fontFamily="sans-serif"
        fontSize="8"
        fill="white"
        fontWeight="bold"
        textAnchor="middle"
      >
        + Add webhook
      </text>
      {/* Dashed highlight border */}
      <rect
        x="167"
        y="35"
        width="84"
        height="28"
        rx="4"
        fill="none"
        stroke="#e84040"
        strokeWidth="2"
        strokeDasharray="3,2"
      />

      {/* Pill label */}
      <rect x="175" y="23" width="68" height="12" rx="6" fill="#e84040" />
      <text x="209" y="32" fontFamily="sans-serif" fontSize="7" fill="white" textAnchor="middle">
        ← Click here
      </text>

      {/* Divider */}
      <line x1="8" y1="68" x2="252" y2="68" stroke="#eee" strokeWidth="1" />

      {/* Table header */}
      <rect x="8" y="70" width="244" height="14" fill="#f5f5f5" />
      <text x="16" y="80" fontFamily="sans-serif" fontSize="7" fill="#999">
        Webhook Name
      </text>
      <text x="120" y="80" fontFamily="sans-serif" fontSize="7" fill="#999">
        Webhook URL
      </text>
      <text x="210" y="80" fontFamily="sans-serif" fontSize="7" fill="#999">
        Status
      </text>

      {/* Table row */}
      <line x1="8" y1="84" x2="252" y2="84" stroke="#eee" strokeWidth="0.5" />
      <text x="16" y="96" fontFamily="sans-serif" fontSize="7" fill="#555">
        My Translation Bot
      </text>
      <text x="120" y="96" fontFamily="sans-serif" fontSize="7" fill="#555">
        https://mybot.example.com/...
      </text>
      <circle cx="212" cy="93" r="3" fill="#5bb89a" />

      {/* Empty hint */}
      <line x1="8" y1="100" x2="252" y2="100" stroke="#eee" strokeWidth="0.5" />
      <text x="16" y="116" fontFamily="sans-serif" fontSize="7" fill="#ccc" fontStyle="italic">
        Use the button above to add a new webhook.
      </text>
    </svg>
  )
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
bun test packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-02-svg.test.tsx
```

Expected: 2 pass.

- [ ] **Step 5: Export from barrel**

Replace `index.ts` contents:

```typescript
export { WebhookStep01Svg } from './webhook-step-01-svg'
export { WebhookStep02Svg } from './webhook-step-02-svg'
```

- [ ] **Step 6: Wire into `webhook-stepper.tsx`**

Update import line (add `WebhookStep02Svg`):

```typescript
import { WebhookStep01Svg, WebhookStep02Svg } from '~/components/atoms/webhook-svgs'
```

Update STEPS[1] — change `svgFragment: null` to:

```typescript
    svgFragment: <WebhookStep02Svg />,
```

- [ ] **Step 7: Run stepper tests**

```bash
bun test packages/dashboard/src/components/molecules/webhook-stepper.test.tsx
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add \
  packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-02-svg.tsx \
  packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-02-svg.test.tsx \
  packages/dashboard/src/components/atoms/webhook-svgs/index.ts \
  packages/dashboard/src/components/molecules/webhook-stepper.tsx
git commit -m "feat(dashboard): add WebhookStep02Svg — add webhook button"
```

---

## Task 4: WebhookStep03Svg — Webhook URL field

**Files:**

- Create: `packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-03-svg.tsx`
- Create: `packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-03-svg.test.tsx`
- Modify: `packages/dashboard/src/components/atoms/webhook-svgs/index.ts`
- Modify: `packages/dashboard/src/components/molecules/webhook-stepper.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-03-svg.test.tsx
import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { WebhookStep03Svg } from './webhook-step-03-svg'

describe('WebhookStep03Svg', () => {
  it('renders an svg element', () => {
    const html = renderToStaticMarkup(createElement(WebhookStep03Svg, null))
    expect(html).toContain('<svg')
  })

  it('has role img and a non-empty aria-label', () => {
    const html = renderToStaticMarkup(createElement(WebhookStep03Svg, null))
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
bun test packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-03-svg.test.tsx
```

Expected: FAIL — `Cannot find module './webhook-step-03-svg'`

- [ ] **Step 3: Create the SVG component**

```tsx
// packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-03-svg.tsx
export function WebhookStep03Svg() {
  return (
    <svg
      viewBox="0 0 260 106"
      width="260"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Chatwork webhook settings — paste the bot URL into the Webhook URL field"
    >
      {/* Top nav */}
      <rect width="260" height="26" fill="#1a1f36" />
      <circle cx="12" cy="13" r="4" fill="#e84040" />
      <text x="20" y="17" fontFamily="sans-serif" fontSize="8" fill="white" fontWeight="bold">
        Edit Webhook
      </text>

      {/* Form area */}
      <rect y="26" width="260" height="80" fill="white" />

      {/* Row 1: Webhook Name — dimmed context */}
      <line x1="0" y1="26" x2="260" y2="26" stroke="#eee" strokeWidth="1" />
      <text x="10" y="42" fontFamily="sans-serif" fontSize="7.5" fill="#bbb">
        Webhook Name
      </text>
      <rect
        x="90"
        y="30"
        width="162"
        height="16"
        rx="2"
        fill="#fafafa"
        stroke="#e0e0e0"
        strokeWidth="1"
      />
      <text x="96" y="41" fontFamily="sans-serif" fontSize="7.5" fill="#ccc">
        JP Project Demo
      </text>

      {/* Divider */}
      <line x1="0" y1="50" x2="260" y2="50" stroke="#eee" strokeWidth="1" />

      {/* Row 2: Webhook URL — HIGHLIGHTED */}
      <text x="10" y="66" fontFamily="sans-serif" fontSize="7.5" fill="#444" fontWeight="500">
        Webhook URL
      </text>
      {/* Required badge */}
      <rect
        x="79"
        y="58"
        width="34"
        height="11"
        rx="1"
        fill="none"
        stroke="#e84040"
        strokeWidth="1"
      />
      <text x="96" y="67" fontFamily="sans-serif" fontSize="6.5" fill="#e84040" textAnchor="middle">
        Required
      </text>

      {/* URL input — red highlight */}
      <rect
        x="118"
        y="55"
        width="134"
        height="18"
        rx="2"
        fill="rgba(232,64,64,0.05)"
        stroke="#e84040"
        strokeWidth="2"
      />
      <text x="123" y="67" fontFamily="sans-serif" fontSize="6.5" fill="#555">
        https://your-bot.server.com/webhook
      </text>

      {/* Helper text */}
      <text x="118" y="82" fontFamily="sans-serif" fontSize="6.5" fill="#aaa">
        Enter URL that starts with https.
      </text>

      {/* Pill label */}
      <rect x="122" y="44" width="82" height="12" rx="6" fill="#e84040" />
      <text x="163" y="53" fontFamily="sans-serif" fontSize="7" fill="white" textAnchor="middle">
        Paste URL here ↓
      </text>
    </svg>
  )
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
bun test packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-03-svg.test.tsx
```

Expected: 2 pass.

- [ ] **Step 5: Export from barrel**

Replace `index.ts` contents:

```typescript
export { WebhookStep01Svg } from './webhook-step-01-svg'
export { WebhookStep02Svg } from './webhook-step-02-svg'
export { WebhookStep03Svg } from './webhook-step-03-svg'
```

- [ ] **Step 6: Wire into `webhook-stepper.tsx`**

Update import line:

```typescript
import {
  WebhookStep01Svg,
  WebhookStep02Svg,
  WebhookStep03Svg,
} from '~/components/atoms/webhook-svgs'
```

Update STEPS[2] — change `svgFragment: null` to:

```typescript
    svgFragment: <WebhookStep03Svg />,
```

- [ ] **Step 7: Run stepper tests**

```bash
bun test packages/dashboard/src/components/molecules/webhook-stepper.test.tsx
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add \
  packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-03-svg.tsx \
  packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-03-svg.test.tsx \
  packages/dashboard/src/components/atoms/webhook-svgs/index.ts \
  packages/dashboard/src/components/molecules/webhook-stepper.tsx
git commit -m "feat(dashboard): add WebhookStep03Svg — webhook URL field"
```

---

## Task 5: WebhookStep04Svg — Event section

**Files:**

- Create: `packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-04-svg.tsx`
- Create: `packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-04-svg.test.tsx`
- Modify: `packages/dashboard/src/components/atoms/webhook-svgs/index.ts`
- Modify: `packages/dashboard/src/components/molecules/webhook-stepper.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-04-svg.test.tsx
import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { WebhookStep04Svg } from './webhook-step-04-svg'

describe('WebhookStep04Svg', () => {
  it('renders an svg element', () => {
    const html = renderToStaticMarkup(createElement(WebhookStep04Svg, null))
    expect(html).toContain('<svg')
  })

  it('has role img and a non-empty aria-label', () => {
    const html = renderToStaticMarkup(createElement(WebhookStep04Svg, null))
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
bun test packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-04-svg.test.tsx
```

Expected: FAIL — `Cannot find module './webhook-step-04-svg'`

- [ ] **Step 3: Create the SVG component**

```tsx
// packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-04-svg.tsx
export function WebhookStep04Svg() {
  return (
    <svg
      viewBox="0 0 260 150"
      width="260"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Chatwork webhook settings — select Room Event, tick Message created and Message updated, enter Room ID"
    >
      {/* Top nav */}
      <rect width="260" height="26" fill="#1a1f36" />
      <circle cx="12" cy="13" r="4" fill="#e84040" />
      <text x="20" y="17" fontFamily="sans-serif" fontSize="8" fill="white" fontWeight="bold">
        Edit Webhook
      </text>

      {/* Form area */}
      <rect y="26" width="260" height="124" fill="white" />

      {/* Webhook URL row — dimmed context */}
      <line x1="0" y1="26" x2="260" y2="26" stroke="#eee" strokeWidth="1" />
      <text x="10" y="42" fontFamily="sans-serif" fontSize="7" fill="#bbb">
        Webhook URL
      </text>
      <rect
        x="88"
        y="30"
        width="164"
        height="14"
        rx="2"
        fill="#fafafa"
        stroke="#e0e0e0"
        strokeWidth="1"
      />
      <text x="94" y="40" fontFamily="sans-serif" fontSize="6.5" fill="#ccc">
        https://your-bot.server.com/webhook
      </text>

      {/* Divider */}
      <line x1="0" y1="48" x2="260" y2="48" stroke="#eee" strokeWidth="1" />

      {/* Event row label */}
      <text x="10" y="65" fontFamily="sans-serif" fontSize="7.5" fill="#444" fontWeight="500">
        Event
      </text>
      {/* Required badge */}
      <rect
        x="38"
        y="57"
        width="34"
        height="11"
        rx="1"
        fill="none"
        stroke="#e84040"
        strokeWidth="1"
      />
      <text x="55" y="66" fontFamily="sans-serif" fontSize="6.5" fill="#e84040" textAnchor="middle">
        Required
      </text>

      {/* Account Event radio — unselected */}
      <rect
        x="88"
        y="56"
        width="72"
        height="18"
        rx="9"
        fill="white"
        stroke="#bbb"
        strokeWidth="1.5"
      />
      <circle cx="99" cy="65" r="4" fill="none" stroke="#bbb" strokeWidth="1.5" />
      <text x="108" y="69" fontFamily="sans-serif" fontSize="7" fill="#666">
        Account Event
      </text>

      {/* Room Event radio — selected */}
      <rect
        x="166"
        y="56"
        width="68"
        height="18"
        rx="9"
        fill="rgba(74,144,217,0.1)"
        stroke="#4a90d9"
        strokeWidth="1.5"
      />
      <circle cx="176" cy="65" r="4" fill="none" stroke="#4a90d9" strokeWidth="1.5" />
      <circle cx="176" cy="65" r="2.5" fill="#4a90d9" />
      <text x="185" y="69" fontFamily="sans-serif" fontSize="7" fill="#1a1a2e" fontWeight="bold">
        Room Event
      </text>

      {/* Message created checkbox */}
      <rect x="88" y="80" width="10" height="10" rx="1.5" fill="#4a90d9" />
      <text x="93" y="89" fontFamily="sans-serif" fontSize="9" fill="white" textAnchor="middle">
        ✓
      </text>
      <text x="103" y="89" fontFamily="sans-serif" fontSize="7.5" fill="#333">
        Message created
      </text>

      {/* Message updated checkbox */}
      <rect x="88" y="95" width="10" height="10" rx="1.5" fill="#4a90d9" />
      <text x="93" y="104" fontFamily="sans-serif" fontSize="9" fill="white" textAnchor="middle">
        ✓
      </text>
      <text x="103" y="104" fontFamily="sans-serif" fontSize="7.5" fill="#333">
        Message updated
      </text>

      {/* Room ID row */}
      <text x="88" y="122" fontFamily="sans-serif" fontSize="7.5" fill="#444">
        Room ID:
      </text>
      <rect
        x="122"
        y="112"
        width="82"
        height="14"
        rx="2"
        fill="white"
        stroke="#bbb"
        strokeWidth="1"
      />
      <text x="128" y="123" fontFamily="sans-serif" fontSize="7.5" fill="#555">
        424846369
      </text>

      {/* Dashed highlight bracket around event section */}
      <rect
        x="84"
        y="52"
        width="172"
        height="78"
        rx="3"
        fill="none"
        stroke="#e84040"
        strokeWidth="1.5"
        strokeDasharray="3,2"
      />

      {/* Pill label */}
      <rect x="80" y="136" width="130" height="12" rx="6" fill="#e84040" />
      <text x="145" y="145" fontFamily="sans-serif" fontSize="7" fill="white" textAnchor="middle">
        Select + tick both + enter Room ID
      </text>
    </svg>
  )
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
bun test packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-04-svg.test.tsx
```

Expected: 2 pass.

- [ ] **Step 5: Export from barrel**

Replace `index.ts` contents:

```typescript
export { WebhookStep01Svg } from './webhook-step-01-svg'
export { WebhookStep02Svg } from './webhook-step-02-svg'
export { WebhookStep03Svg } from './webhook-step-03-svg'
export { WebhookStep04Svg } from './webhook-step-04-svg'
```

- [ ] **Step 6: Wire into `webhook-stepper.tsx`**

Update import line:

```typescript
import {
  WebhookStep01Svg,
  WebhookStep02Svg,
  WebhookStep03Svg,
  WebhookStep04Svg,
} from '~/components/atoms/webhook-svgs'
```

Update STEPS[3] — change `svgFragment: null` to:

```typescript
    svgFragment: <WebhookStep04Svg />,
```

- [ ] **Step 7: Run stepper tests**

```bash
bun test packages/dashboard/src/components/molecules/webhook-stepper.test.tsx
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add \
  packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-04-svg.tsx \
  packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-04-svg.test.tsx \
  packages/dashboard/src/components/atoms/webhook-svgs/index.ts \
  packages/dashboard/src/components/molecules/webhook-stepper.tsx
git commit -m "feat(dashboard): add WebhookStep04Svg — event section"
```

---

## Task 6: WebhookStep05Svg — Save button

**Files:**

- Create: `packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-05-svg.tsx`
- Create: `packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-05-svg.test.tsx`
- Modify: `packages/dashboard/src/components/atoms/webhook-svgs/index.ts`
- Modify: `packages/dashboard/src/components/molecules/webhook-stepper.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-05-svg.test.tsx
import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { WebhookStep05Svg } from './webhook-step-05-svg'

describe('WebhookStep05Svg', () => {
  it('renders an svg element', () => {
    const html = renderToStaticMarkup(createElement(WebhookStep05Svg, null))
    expect(html).toContain('<svg')
  })

  it('has role img and a non-empty aria-label', () => {
    const html = renderToStaticMarkup(createElement(WebhookStep05Svg, null))
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
bun test packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-05-svg.test.tsx
```

Expected: FAIL — `Cannot find module './webhook-step-05-svg'`

- [ ] **Step 3: Create the SVG component**

```tsx
// packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-05-svg.tsx
export function WebhookStep05Svg() {
  return (
    <svg
      viewBox="0 0 260 90"
      width="260"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Chatwork webhook settings — click Save to activate the webhook"
    >
      {/* Top nav */}
      <rect width="260" height="26" fill="#1a1f36" />
      <circle cx="12" cy="13" r="4" fill="#e84040" />
      <text x="20" y="17" fontFamily="sans-serif" fontSize="8" fill="white" fontWeight="bold">
        Edit Webhook
      </text>

      {/* Form area */}
      <rect y="26" width="260" height="64" fill="white" />

      {/* Status row — dimmed context */}
      <line x1="0" y1="26" x2="260" y2="26" stroke="#eee" strokeWidth="1" />
      <text x="10" y="42" fontFamily="sans-serif" fontSize="7.5" fill="#bbb">
        Status
      </text>
      <circle cx="90" cy="39" r="4" fill="none" stroke="#bbb" strokeWidth="1.5" />
      <circle cx="90" cy="39" r="2.5" fill="#bbb" />
      <text x="98" y="42" fontFamily="sans-serif" fontSize="7.5" fill="#bbb">
        Enable
      </text>

      {/* Divider */}
      <line x1="0" y1="50" x2="260" y2="50" stroke="#eee" strokeWidth="1" />

      {/* Back button */}
      <rect
        x="10"
        y="58"
        width="44"
        height="20"
        rx="3"
        fill="white"
        stroke="#bbb"
        strokeWidth="1.5"
      />
      <text x="32" y="71" fontFamily="sans-serif" fontSize="8" fill="#666" textAnchor="middle">
        Back
      </text>

      {/* Save button */}
      <rect x="192" y="56" width="56" height="24" rx="3" fill="#1a4080" />
      <text
        x="220"
        y="71"
        fontFamily="sans-serif"
        fontSize="9"
        fill="white"
        fontWeight="bold"
        textAnchor="middle"
      >
        Save
      </text>
      {/* Dashed highlight border */}
      <rect
        x="189"
        y="53"
        width="62"
        height="30"
        rx="4"
        fill="none"
        stroke="#e84040"
        strokeWidth="2"
        strokeDasharray="3,2"
      />

      {/* Pill label */}
      <rect x="188" y="41" width="72" height="12" rx="6" fill="#e84040" />
      <text x="224" y="50" fontFamily="sans-serif" fontSize="7" fill="white" textAnchor="middle">
        Click to save ↓
      </text>

      {/* Delete link — context */}
      <text x="10" y="84" fontFamily="sans-serif" fontSize="7" fill="#bbb">
        × Delete
      </text>
    </svg>
  )
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
bun test packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-05-svg.test.tsx
```

Expected: 2 pass.

- [ ] **Step 5: Export from barrel — final state**

Replace `index.ts` with the complete final barrel:

```typescript
export { WebhookStep01Svg } from './webhook-step-01-svg'
export { WebhookStep02Svg } from './webhook-step-02-svg'
export { WebhookStep03Svg } from './webhook-step-03-svg'
export { WebhookStep04Svg } from './webhook-step-04-svg'
export { WebhookStep05Svg } from './webhook-step-05-svg'
```

- [ ] **Step 6: Wire into `webhook-stepper.tsx` — final state**

Update import line to final form:

```typescript
import {
  WebhookStep01Svg,
  WebhookStep02Svg,
  WebhookStep03Svg,
  WebhookStep04Svg,
  WebhookStep05Svg,
} from '~/components/atoms/webhook-svgs'
```

Update STEPS[4] — change `svgFragment: null` to:

```typescript
    svgFragment: <WebhookStep05Svg />,
```

- [ ] **Step 7: Run stepper tests**

```bash
bun test packages/dashboard/src/components/molecules/webhook-stepper.test.tsx
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add \
  packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-05-svg.tsx \
  packages/dashboard/src/components/atoms/webhook-svgs/webhook-step-05-svg.test.tsx \
  packages/dashboard/src/components/atoms/webhook-svgs/index.ts \
  packages/dashboard/src/components/molecules/webhook-stepper.tsx
git commit -m "feat(dashboard): add WebhookStep05Svg — save button"
```

---

## Task 7: Final verification

**Files:** none (read-only verification)

- [ ] **Step 1: Run all dashboard tests**

```bash
bun test packages/dashboard
```

Expected: all pass, including the 10 new SVG smoke tests.

- [ ] **Step 2: Run full typecheck**

```bash
cd packages/dashboard && bun run typecheck
```

Expected: no errors.

- [ ] **Step 3: Run lint**

```bash
cd packages/dashboard && bun run lint
```

Expected: no errors. Confirm no `../` imports exist in new files (all use `~/` or relative within the same `webhook-svgs/` folder).

- [ ] **Step 4: Run full project tests**

```bash
bun test
```

Expected: 586 + 10 = 596 pass, 0 fail.

---

## Self-Review

**Spec coverage check:**

| Spec requirement                                  | Covered by                                         |
| ------------------------------------------------- | -------------------------------------------------- |
| 5 SVG components                                  | Tasks 2–6                                          |
| `svgFragment: React.ReactNode` on Step interface  | Task 1 Step 2                                      |
| Grid wrapper (2-col on sm+, 1-col mobile)         | Task 1 Step 4 (`grid-cols-1 gap-4 sm:grid-cols-2`) |
| `min-h` bumped                                    | Task 1 Step 5                                      |
| Barrel export                                     | Tasks 2–6 Step 5 each                              |
| `role="img"` + `aria-label`                       | All SVG components                                 |
| Faithful Chatwork UI + red highlight + pill label | All SVG components                                 |
| Co-located smoke tests                            | Tasks 2–6                                          |
| Existing stepper tests pass                       | Verified each task Step 7                          |

**Placeholder scan:** None found — all steps contain complete code.

**Type consistency:**

- `WebhookStep01Svg`…`WebhookStep05Svg` — consistent across tests, components, barrel, and stepper wiring.
- `svgFragment: React.ReactNode` defined in Task 1, used as `<WebhookStepNNSvg />` (valid `ReactElement`) in Tasks 2–6.
- Import path `~/components/atoms/webhook-svgs` used consistently in stepper.
