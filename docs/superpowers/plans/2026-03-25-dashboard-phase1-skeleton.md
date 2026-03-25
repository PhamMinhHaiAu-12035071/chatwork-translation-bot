# Dashboard Phase 1: Skeleton UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a new `@chatwork-bot/dashboard` package with React 19 + Vite + TailwindCSS v4 + React Router v7 routing to 4 page shells, runnable on `localhost:5173`.

**Architecture:** Standalone Vite SPA in `packages/dashboard/`. No backend integration. Uses root ESLint/Prettier configs (no fragmented config files). Follows existing monorepo conventions: `~/` path alias, workspace scripts, tsconfig extends base.

**Tech Stack:** React 19, Vite 6, TailwindCSS v4, React Router v7, Zustand (store skeleton), TypeScript 5.4+ strict

**Spec:** `docs/superpowers/specs/2026-03-25-dashboard-multi-room-design.md`

**Ship & Review:** `bun run dev:dashboard` → open `localhost:5173` → user sees 4 pages with working nav

---

## File Map

| File                                             | Action | Responsibility                           |
| ------------------------------------------------ | ------ | ---------------------------------------- |
| `packages/dashboard/package.json`                | Create | Package config with required scripts     |
| `packages/dashboard/tsconfig.json`               | Create | Extends base, DOM lib, `~/` alias        |
| `packages/dashboard/vite.config.ts`              | Create | Vite + React plugin + path alias         |
| `packages/dashboard/index.html`                  | Create | SPA entry point with Google Fonts        |
| `packages/dashboard/src/main.tsx`                | Create | React root + RouterProvider              |
| `packages/dashboard/src/router.tsx`              | Create | Route definitions (4 pages)              |
| `packages/dashboard/src/layouts/app-layout.tsx`  | Create | Sidebar nav + main content area          |
| `packages/dashboard/src/pages/room-list.tsx`     | Create | Placeholder page `/`                     |
| `packages/dashboard/src/pages/room-create.tsx`   | Create | Placeholder page `/rooms/new`            |
| `packages/dashboard/src/pages/room-detail.tsx`   | Create | Placeholder page `/rooms/:id`            |
| `packages/dashboard/src/pages/webhook-guide.tsx` | Create | Placeholder page `/guide`                |
| `packages/dashboard/src/stores/room-store.ts`    | Create | Empty Zustand store skeleton             |
| `packages/dashboard/src/lib/api-client.ts`       | Create | Empty API client skeleton                |
| `packages/dashboard/src/styles/global.css`       | Create | TailwindCSS import                       |
| `packages/dashboard/src/app.test.ts`             | Create | Smoke test (bun:test, not vitest)        |
| `packages/dashboard/src/vite-env.d.ts`           | Create | Vite client types                        |
| `commitlint.config.ts`                           | Modify | Add `'dashboard'` to scope-enum          |
| `eslint.config.ts`                               | Modify | Fix ignores glob for nested config files |
| `package.json`                                   | Modify | Add `dev:dashboard` script               |

---

## Task 1: Scaffold package structure and configs

**Files:**

- Create: `packages/dashboard/package.json`
- Create: `packages/dashboard/tsconfig.json`
- Create: `packages/dashboard/vite.config.ts`
- Create: `packages/dashboard/src/vite-env.d.ts`

- [ ] **Step 1: Create `packages/dashboard/package.json`**

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
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.0.0",
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

- [ ] **Step 2: Create `packages/dashboard/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": "../..",
    "rootDir": "src",
    "outDir": "dist",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "paths": {
      "~/*": ["packages/dashboard/src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `packages/dashboard/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '~': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
  },
})
```

- [ ] **Step 4: Create `packages/dashboard/src/vite-env.d.ts`**

```typescript
/// <reference types="vite/client" />
```

- [ ] **Step 5: Install dependencies**

Run: `cd /Users/phamau/Desktop/projects/research/chatwork-translation-bot && bun install`
Expected: Dependencies installed, no errors.

---

## Task 2: Add commitlint scope and root scripts

**Files:**

- Modify: `commitlint.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Add `'dashboard'` to commitlint scope-enum**

In `commitlint.config.ts`, add `'dashboard'` to the `scope-enum` array (line 37, before `'repo'`):

```typescript
'scope-enum': [
  2,
  'always',
  [
    'chatwork',
    'core',
    'dashboard',
    'translator',
    'webhook-logger',
    'translation-prompt',
    'provider-gemini',
    'provider-openai',
    'provider-cursor',
    'repo',
  ],
],
```

- [ ] **Step 2: Fix ESLint ignores glob for nested config files**

In `eslint.config.ts`, line 29, change `'*.config.ts'` to `'**/*.config.ts'` so nested Vite config files are ignored by ESLint:

```typescript
{
  ignores: ['dist/**', 'node_modules/**', '*.js', '**/*.config.ts'],
},
```

**Why:** ESLint flat config `*.config.ts` only matches root-level files. `packages/dashboard/vite.config.ts` would fail lint because it imports from `vite` which isn't type-checked by the project service.

- [ ] **Step 3: Add `dev:dashboard` script to root `package.json`**

Add to `scripts` object:

```json
"dev:dashboard": "bun run --cwd packages/dashboard dev"
```

- [ ] **Step 4: Commit scaffold**

```bash
git add packages/dashboard/package.json packages/dashboard/tsconfig.json packages/dashboard/vite.config.ts packages/dashboard/src/vite-env.d.ts commitlint.config.ts eslint.config.ts package.json bun.lock
git commit -m "feat(dashboard): scaffold package with Vite + React 19 + TailwindCSS v4"
```

---

## Task 3: Create SPA entry point and router

**Files:**

- Create: `packages/dashboard/index.html`
- Create: `packages/dashboard/src/main.tsx`
- Create: `packages/dashboard/src/router.tsx`
- Create: `packages/dashboard/src/styles/global.css`

- [ ] **Step 1: Create `packages/dashboard/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Chatwork Translation Bot — Dashboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Shantell+Sans:wght@700;800&family=Kiwi+Maru:wght@400;500&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `packages/dashboard/src/styles/global.css`**

```css
@import 'tailwindcss';
```

- [ ] **Step 3: Create `packages/dashboard/src/router.tsx`**

```tsx
import { createBrowserRouter } from 'react-router'
import { AppLayout } from '~/layouts/app-layout'
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
      { path: '/guide', element: <WebhookGuidePage /> },
    ],
  },
])
```

- [ ] **Step 4: Create `packages/dashboard/src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from '~/router'
import '~/styles/global.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
```

---

## Task 4: Create app layout with sidebar navigation

**Files:**

- Create: `packages/dashboard/src/layouts/app-layout.tsx`

- [ ] **Step 1: Create `packages/dashboard/src/layouts/app-layout.tsx`**

Minimal layout with sidebar nav and content area. No styling beyond basic structure (Phase 2 adds design).

```tsx
import { NavLink, Outlet } from 'react-router'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/rooms/new', label: '+ New Room' },
  { to: '/guide', label: 'Webhook Guide' },
] as const

export function AppLayout() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r border-gray-200 bg-white p-6">
        <h1 className="mb-8 text-xl font-bold">Translation Bot</h1>
        <nav className="flex flex-col gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-lg px-4 py-2 text-sm transition-colors ${
                  isActive ? 'bg-gray-100 font-semibold' : 'hover:bg-gray-50'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  )
}
```

---

## Task 5: Create 4 placeholder pages

**Files:**

- Create: `packages/dashboard/src/pages/room-list.tsx`
- Create: `packages/dashboard/src/pages/room-create.tsx`
- Create: `packages/dashboard/src/pages/room-detail.tsx`
- Create: `packages/dashboard/src/pages/webhook-guide.tsx`

- [ ] **Step 1: Create `packages/dashboard/src/pages/room-list.tsx`**

```tsx
export function RoomListPage() {
  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Room List</h2>
      <p className="text-gray-500">No rooms configured yet. Create your first translation room.</p>
    </div>
  )
}
```

- [ ] **Step 2: Create `packages/dashboard/src/pages/room-create.tsx`**

```tsx
export function RoomCreatePage() {
  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Create New Room</h2>
      <p className="text-gray-500">Room configuration form will be here.</p>
    </div>
  )
}
```

- [ ] **Step 3: Create `packages/dashboard/src/pages/room-detail.tsx`**

```tsx
import { useParams } from 'react-router'

export function RoomDetailPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Room Detail</h2>
      <p className="text-gray-500">Room config ID: {id}</p>
    </div>
  )
}
```

- [ ] **Step 4: Create `packages/dashboard/src/pages/webhook-guide.tsx`**

```tsx
export function WebhookGuidePage() {
  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Webhook Setup Guide</h2>
      <p className="text-gray-500">Step-by-step guide for configuring Chatwork webhooks.</p>
    </div>
  )
}
```

- [ ] **Step 5: Commit pages and layout**

```bash
git add packages/dashboard/index.html packages/dashboard/src/
git commit -m "feat(dashboard): add router, layout, and 4 placeholder pages"
```

---

## Task 6: Create Zustand store and API client skeletons

**Files:**

- Create: `packages/dashboard/src/stores/room-store.ts`
- Create: `packages/dashboard/src/lib/api-client.ts`

- [ ] **Step 1: Create `packages/dashboard/src/stores/room-store.ts`**

```typescript
import { create } from 'zustand'

interface RoomStore {
  rooms: unknown[]
}

export const useRoomStore = create<RoomStore>()(() => ({
  rooms: [],
}))
```

- [ ] **Step 2: Create `packages/dashboard/src/lib/api-client.ts`**

```typescript
const API_BASE = '/api'

export const apiClient = {
  baseUrl: API_BASE,
}
```

- [ ] **Step 3: Commit skeletons**

```bash
git add packages/dashboard/src/stores/ packages/dashboard/src/lib/
git commit -m "feat(dashboard): add Zustand store and API client skeletons"
```

---

## Task 7: Add smoke test

**Files:**

- Create: `packages/dashboard/src/app.test.ts`

**Note:** Phase 1 uses `bun:test` (same as all other packages) for the smoke test. Vitest + jsdom + testing-library will be introduced in a later phase when component rendering tests are needed. This avoids a test runner conflict (`bun test` at root discovers all `*.test.ts` files and would fail on vitest imports).

- [ ] **Step 1: Create `packages/dashboard/src/app.test.ts`**

```typescript
import { describe, it, expect } from 'bun:test'

describe('dashboard', () => {
  it('smoke test: module loads without error', () => {
    expect(true).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `bun test packages/dashboard`
Expected: 1 test passes.

- [ ] **Step 3: Run verify:standards to check package compliance**

Run: `bun run verify:standards`
Expected: `[verify-standards] ✓ All packages meet standards`

- [ ] **Step 4: Run full quality checks**

Run: `bun run typecheck && bun test && bun run lint`
Expected: All pass, including dashboard.

- [ ] **Step 5: Commit test**

```bash
git add packages/dashboard/src/app.test.ts
git commit -m "test(dashboard): add smoke test with bun:test"
```

---

## Task 8: Verify dev server runs and ship for review

- [ ] **Step 1: Start dev server**

Run: `bun run dev:dashboard`
Expected: Vite starts on `http://localhost:5173`

- [ ] **Step 2: Manual verification checklist**

Open browser to `http://localhost:5173` and verify:

1. ✅ Page loads with sidebar showing "Translation Bot" title
2. ✅ Sidebar has 3 nav links: Dashboard, + New Room, Webhook Guide
3. ✅ Click "Dashboard" → shows Room List page at `/`
4. ✅ Click "+ New Room" → shows Room Create page at `/rooms/new`
5. ✅ Click "Webhook Guide" → shows Webhook Guide page at `/guide`
6. ✅ Navigate to `/rooms/test-123` → shows Room Detail page with ID "test-123"
7. ✅ Active nav link is visually highlighted

- [ ] **Step 3: Stop dev server and run full pre-commit checks**

Run: `bun run typecheck && bun test && bun run lint`
Expected: All pass.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(dashboard): complete Phase 1 skeleton with routing and nav"
```

---

## Ship & Review

**User action:** Run `bun run dev:dashboard` → open `http://localhost:5173`

**Success criteria:** 4 pages render with working sidebar navigation. All links navigate correctly. Active link is highlighted.

**Await user approval before proceeding to Phase 2.**
