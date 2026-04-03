# Tour Guide Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Thêm tính năng tour guide 18 bước cho dashboard, hướng dẫn người dùng tự thao tác create / edit / delete / enable-disable room mà không cần hỗ trợ.

**Architecture:** Dùng `nextstepjs` React Router variant với custom `NeubTourCard` component theo phong cách Neubrutalism. Tour cross-page qua `useReactRouterAdapter`, trạng thái đã xem được persist trong Zustand `ui-store`, và replay được trigger từ floating help button. Vì dashboard chạy trên Vite, plan này bao gồm cả phần mock `next/navigation` và `ssr.noExternal` cho `nextstepjs`/`motion` theo tài liệu chính thức của NextStep để tránh lỗi build/runtime ngay từ bước setup.

**Tech Stack:** nextstepjs · motion · React 19 · React Router v7 · Zustand v5 · Framer Motion v12 · Tailwind v4 · Bun test

---

## File Map

| Action | File                                                                       |
| ------ | -------------------------------------------------------------------------- |
| Modify | `packages/dashboard/index.html`                                            |
| Modify | `packages/dashboard/vite.config.ts`                                        |
| Modify | `packages/dashboard/src/styles/global.css`                                 |
| Modify | `packages/dashboard/src/stores/ui-store.ts`                                |
| Create | `packages/dashboard/src/mocks/next-navigation.ts`                          |
| Create | `packages/dashboard/src/lib/tour-steps.ts`                                 |
| Create | `packages/dashboard/src/components/organisms/neub-tour-card.tsx`           |
| Create | `packages/dashboard/src/components/organisms/tour-float-button.tsx`        |
| Modify | `packages/dashboard/src/layouts/app-layout.tsx`                            |
| Modify | `packages/dashboard/src/main.tsx`                                          |
| Modify | `packages/dashboard/src/main.test.tsx`                                     |
| Modify | `packages/dashboard/src/pages/room-list.tsx`                               |
| Modify | `packages/dashboard/src/pages/room-create.tsx`                             |
| Modify | `packages/dashboard/src/components/molecules/context-field.tsx`            |
| Modify | `packages/dashboard/src/components/molecules/keyword-protection-field.tsx` |
| Create | `packages/dashboard/src/stores/ui-store.test.ts` (new tests appended)      |
| Create | `packages/dashboard/src/lib/tour-steps.test.ts`                            |

---

## Task 1: Install NextStep dependencies and make Vite compatible

**Files:**

- Run: `packages/dashboard/`
- Modify: `packages/dashboard/index.html`
- Modify: `packages/dashboard/vite.config.ts`
- Create: `packages/dashboard/src/mocks/next-navigation.ts`

- [ ] **Step 1: Install `nextstepjs` and `motion`**

```bash
cd packages/dashboard && bun add nextstepjs motion
```

- [ ] **Step 2: Verify install — check package.json**

```bash
rg -n '"nextstepjs"|"motion"' packages/dashboard/package.json
```

Expected output: package contains both `"nextstepjs"` and `"motion"`.

- [ ] **Step 3: Add the Next.js navigation mock**

Create `packages/dashboard/src/mocks/next-navigation.ts`:

```ts
export const useRouter = () => {
  return {
    push: () => {},
    replace: () => {},
    prefetch: () => {},
    back: () => {},
    forward: () => {},
    refresh: () => {},
  }
}

export const usePathname = () => ''

export const useSearchParams = () => new URLSearchParams()

export const useParams = () => ({})
```

- [ ] **Step 4: Update `vite.config.ts` for NextStep on Vite**

Replace the config body with:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '~': resolve(__dirname, 'src'),
      'next/navigation': resolve(__dirname, 'src/mocks/next-navigation.ts'),
    },
  },
  ssr: {
    noExternal: ['nextstepjs', 'motion'],
  },
  server: {
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.TRANSLATOR_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 5: Add Be Vietnam Pro to index.html**

In `packages/dashboard/index.html`, replace the existing font link:

```html
<!-- Before -->
<link
  href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Shantell+Sans:wght@400;500;700;800&family=Zen+Maru+Gothic:wght@400;500;700&display=swap"
  rel="stylesheet"
/>
```

```html
<!-- After -->
<link
  href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,500;0,700;1,400&family=Fredoka:wght@500;600;700&family=Shantell+Sans:wght@400;500;700;800&family=Zen+Maru+Gothic:wght@400;500;700&display=swap&subset=vietnamese"
  rel="stylesheet"
/>
```

- [ ] **Step 6: Run typecheck to confirm no breakage**

```bash
cd packages/dashboard && bun run typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/dashboard/index.html packages/dashboard/package.json packages/dashboard/bun.lockb packages/dashboard/vite.config.ts packages/dashboard/src/mocks/next-navigation.ts
git commit -m "feat(dashboard): install nextstepjs for Vite and add tour fonts"
```

---

## Task 2: Extend ui-store with tour state

**Files:**

- Modify: `packages/dashboard/src/stores/ui-store.ts`
- Create: `packages/dashboard/src/stores/ui-store.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/dashboard/src/stores/ui-store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'bun:test'
import { useUiStore } from './ui-store'

describe('ui-store — tour state', () => {
  beforeEach(() => {
    useUiStore.setState({ tourSeenVersion: null })
  })

  it('tourSeenVersion starts as null', () => {
    expect(useUiStore.getState().tourSeenVersion).toBeNull()
  })

  it('setTourSeen sets the version', () => {
    useUiStore.getState().setTourSeen(1)
    expect(useUiStore.getState().tourSeenVersion).toBe(1)
  })

  it('resetTour sets tourSeenVersion back to null', () => {
    useUiStore.getState().setTourSeen(1)
    useUiStore.getState().resetTour()
    expect(useUiStore.getState().tourSeenVersion).toBeNull()
  })

  it('setTourSeen with higher version updates correctly', () => {
    useUiStore.getState().setTourSeen(1)
    useUiStore.getState().setTourSeen(2)
    expect(useUiStore.getState().tourSeenVersion).toBe(2)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
bun test packages/dashboard/src/stores/ui-store.test.ts 2>&1 | tail -10
```

Expected: FAIL because `tourSeenVersion`, `setTourSeen`, and `resetTour` do not exist in `ui-store.ts` yet.

- [ ] **Step 3: Extend ui-store.ts**

Replace `packages/dashboard/src/stores/ui-store.ts` with:

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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun test packages/dashboard/src/stores/ui-store.test.ts
```

Expected: 4 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/src/stores/ui-store.ts packages/dashboard/src/stores/ui-store.test.ts
git commit -m "feat(dashboard): extend ui-store with tourSeenVersion state"
```

---

## Task 3: Create tour-steps.ts with 22 steps

**Files:**

- Create: `packages/dashboard/src/lib/tour-steps.ts`
- Create: `packages/dashboard/src/lib/tour-steps.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/dashboard/src/lib/tour-steps.test.ts`:

```ts
import { describe, it, expect } from 'bun:test'
import { tours, TOUR_VERSION, TOUR_NAME } from './tour-steps'

describe('tour-steps', () => {
  const steps = tours[0]?.steps ?? []

  it('exports exactly one tour named main-tour', () => {
    expect(tours).toHaveLength(1)
    expect(tours[0]?.tour).toBe(TOUR_NAME)
  })

  it('has exactly 22 steps', () => {
    expect(steps).toHaveLength(22)
  })

  it('covers the sidebar and every create-room field we want to explain', () => {
    const selectors = steps.map((step) => step.selector ?? null)

    expect(selectors).toContain('#tour-sidebar-nav')
    expect(selectors).toContain('#tour-new-room')
    expect(selectors).toContain('#tour-field-roomid')
    expect(selectors).toContain('#tour-field-roomname')
    expect(selectors).toContain('#tour-field-provider')
    expect(selectors).toContain('#tour-field-model')
    expect(selectors).toContain('#tour-field-style')
    expect(selectors).toContain('#tour-field-token')
    expect(selectors).toContain('#tour-field-context')
    expect(selectors).toContain('#tour-context-templates')
    expect(selectors).toContain('#tour-field-keywords')
    expect(selectors).toContain('#tour-keyword-addform')
    expect(selectors).toContain('#tour-save-btn')
  })

  it('every step has title and content', () => {
    for (const step of steps) {
      expect(typeof step.title).toBe('string')
      expect(step.title.length).toBeGreaterThan(0)
      expect(typeof step.content).toBe('string')
      expect((step.content as string).length).toBeGreaterThan(0)
    }
  })

  it('every step uses a unique solid hex color', () => {
    const colors = steps.map((step) => (step as { color: string }).color)

    expect(new Set(colors).size).toBe(colors.length)

    for (const color of colors) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('steps 6 and 17 have nextRoute (cross-page navigation)', () => {
    // Step index 5 (step #6): New Room → /rooms/new
    expect((steps[5] as { nextRoute?: string }).nextRoute).toBe('/rooms/new')
    // Step index 16 (step #17): Save → /
    expect((steps[16] as { nextRoute?: string }).nextRoute).toBe('/')
  })

  it('TOUR_VERSION is a positive integer', () => {
    expect(typeof TOUR_VERSION).toBe('number')
    expect(TOUR_VERSION).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
bun test packages/dashboard/src/lib/tour-steps.test.ts 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create tour-steps.ts**

Create `packages/dashboard/src/lib/tour-steps.ts`:

```ts
import type { Step } from 'nextstepjs'

export const TOUR_VERSION = 1
export const TOUR_NAME = 'main-tour' as const

export type NeubStep = Step & { color: string }

const steps: NeubStep[] = [
  {
    title: '👋 Chào mừng!',
    content:
      'Đây là nơi để xem và quản lý các phòng dịch. Mình sẽ chỉ bạn từng phần, ngắn gọn và dễ làm theo.',
    side: 'bottom',
    showControls: true,
    showSkip: true,
    color: '#ffd166',
  },
  {
    selector: '#tour-sidebar-nav',
    title: '🧭 Thanh menu',
    content:
      'Cột này là menu chính. Dashboard để xem tổng quan, New Room để tạo phòng mới, Free Rooms để xem phòng miễn phí, New Free Room để tạo phòng miễn phí, Webhook Guide để xem cách nối Chatwork.',
    side: 'right',
    showControls: true,
    showSkip: true,
    color: '#7a9e9f',
  },
  {
    selector: '#tour-stat-total',
    title: '📦 Tổng số phòng',
    content: 'Con số này cho biết bạn đang có tất cả bao nhiêu phòng đã được tạo.',
    side: 'bottom',
    showControls: true,
    showSkip: true,
    color: '#c9b1ff',
  },
  {
    selector: '#tour-stat-active',
    title: '✅ Phòng đang bật',
    content: 'Đây là số phòng đang hoạt động. Khi phòng đang bật, bot đang làm việc.',
    side: 'bottom',
    showControls: true,
    showSkip: true,
    color: '#86e8c0',
  },
  {
    selector: '#tour-stat-inactive',
    title: '⏸️ Phòng đang tạm dừng',
    content: 'Đây là số phòng đang nghỉ tạm. Muốn dùng lại thì chỉ cần bật lên.',
    side: 'bottom',
    showControls: true,
    showSkip: true,
    color: '#fed7aa',
  },
  {
    selector: '#tour-new-room',
    title: '➕ Tạo phòng mới',
    content: 'Bấm nút này để mở trang tạo phòng mới. Mình sẽ đi cùng bạn từng ô một.',
    side: 'bottom',
    showControls: true,
    showSkip: true,
    nextRoute: '/rooms/new',
    color: '#90cdf4',
  },
  {
    selector: '#tour-field-roomid',
    title: '🔢 Room ID',
    content:
      'Điền số ID của room Chatwork cần dịch. Trong link của room, nhìn phần nằm sau chữ rid.',
    side: 'right',
    showControls: true,
    showSkip: true,
    color: '#ffc8a0',
  },
  {
    selector: '#tour-field-roomname',
    title: '🏷️ Tên phòng',
    content: 'Đặt một cái tên dễ nhớ cho phòng này. Ví dụ: Nhom Ky Thuat JP hoặc Bao Cao Sang.',
    side: 'right',
    showControls: true,
    showSkip: true,
    color: '#f4978e',
  },
  {
    selector: '#tour-field-provider',
    title: '🤖 Hãng AI',
    content: 'Chọn hãng AI sẽ giúp bạn dịch, ví dụ OpenAI hoặc Gemini.',
    side: 'right',
    showControls: true,
    showSkip: true,
    color: '#ffb3c1',
  },
  {
    selector: '#tour-field-model',
    title: '🧠 Model AI',
    content: 'Chọn model AI. Bạn có thể hiểu đơn giản đây là phiên bản AI mà bot sẽ dùng.',
    side: 'right',
    showControls: true,
    showSkip: true,
    color: '#9381ff',
  },
  {
    selector: '#tour-field-style',
    title: '🎨 Kiểu dịch',
    content: 'Chọn kiểu lời văn bạn muốn bot dùng, như thân thiện, lịch sự, hoặc kỹ thuật.',
    side: 'right',
    showControls: true,
    showSkip: true,
    color: '#bef264',
  },
  {
    selector: '#tour-field-token',
    title: '🔑 API Token',
    content: 'Dán chìa khóa API của hãng AI vào đây. Thiếu ô này thì bot sẽ không làm việc được.',
    side: 'right',
    showControls: true,
    showSkip: true,
    color: '#e4c1f9',
  },
  {
    selector: '#tour-field-context',
    title: '📝 Translation Context',
    content:
      'Nếu cần, mở phần này và viết vài câu để nói room này đang nói về chủ đề gì. AI sẽ hiểu bài hơn.',
    side: 'top',
    showControls: true,
    showSkip: true,
    color: '#a8d8a8',
  },
  {
    selector: '#tour-context-templates',
    title: '⚡ Mẫu điền nhanh',
    content:
      'Nếu chưa biết viết gì, bạn có thể bấm một mẫu có sẵn để điền nhanh, rồi sửa lại cho hợp ý mình.',
    side: 'left',
    showControls: true,
    showSkip: true,
    color: '#d1fae5',
  },
  {
    selector: '#tour-field-keywords',
    title: '🛡️ Keyword Protection',
    content:
      'Nếu có tên riêng không muốn bị dịch, mở phần này để giữ nguyên những từ quan trọng đó.',
    side: 'top',
    showControls: true,
    showSkip: true,
    color: '#fcd34d',
  },
  {
    selector: '#tour-keyword-addform',
    title: '➕ Thêm keyword',
    content:
      'Nhập từ cần giữ nguyên, chọn loại của nó, nếu muốn thì đặt tên thay thế, rồi bấm Add.',
    side: 'top',
    showControls: true,
    showSkip: true,
    color: '#fef3c7',
  },
  {
    selector: '#tour-save-btn',
    title: '💾 Lưu phòng',
    content: 'Khi đã kiểm tra xong, bấm Create Room để lưu. Sau đó bạn sẽ quay về dashboard.',
    side: 'top',
    showControls: true,
    showSkip: true,
    nextRoute: '/',
    color: '#fb923c',
  },
  {
    selector: '#tour-room-card-first',
    title: '🃏 Thẻ phòng',
    content: 'Mỗi thẻ là một phòng bạn đã tạo. Trong thẻ có các thông tin chính của phòng đó.',
    side: 'right',
    showControls: true,
    showSkip: true,
    color: '#fde68a',
  },
  {
    selector: '#tour-status-toggle',
    title: '🔀 Bật / Tắt',
    content: 'Nút này dùng để bật hoặc tắt bot của phòng. Bật là bot làm việc, tắt là bot nghỉ.',
    side: 'left',
    showControls: true,
    showSkip: true,
    color: '#a5f3fc',
  },
  {
    selector: '#tour-edit-btn',
    title: '✏️ Sửa phòng',
    content:
      'Muốn sửa thông tin thì bấm Edit. Màn hình sửa gần giống lúc tạo nên bạn chỉ cần đổi chỗ cần đổi.',
    side: 'top',
    showControls: true,
    showSkip: true,
    color: '#99f6e4',
  },
  {
    selector: '#tour-delete-btn',
    title: '🗑️ Xóa phòng',
    content: 'Muốn xóa phòng thì bấm Delete. Hệ thống sẽ hỏi lại một lần nữa để tránh bấm nhầm.',
    side: 'top',
    showControls: true,
    showSkip: true,
    color: '#f9a8d4',
  },
  {
    title: '🎉 Xong rồi!',
    content: 'Bạn đã xem xong tour. Khi nào cần xem lại, chỉ cần bấm nút dấu hỏi ở góc màn hình.',
    side: 'bottom',
    showControls: true,
    showSkip: false,
    color: '#ff6b6b',
  },
]

export const tours: { tour: string; steps: NeubStep[] }[] = [{ tour: TOUR_NAME, steps }]
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun test packages/dashboard/src/lib/tour-steps.test.ts
```

Expected: 7 pass, 0 fail.

- [ ] **Step 5: Run typecheck**

```bash
cd packages/dashboard && bun run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/dashboard/src/lib/tour-steps.ts packages/dashboard/src/lib/tour-steps.test.ts
git commit -m "feat(dashboard): add 22-step tour flow with simpler copy"
```

---

## Task 4: Add spotlight CSS to global.css

**Files:**

- Modify: `packages/dashboard/src/styles/global.css`

- [ ] **Step 1: Append spotlight styles at the end of global.css**

Add these rules at the very end of `packages/dashboard/src/styles/global.css`:

```css
/* ── Tour Guide — NextStep.js spotlight ─────────────────────────── */
[data-nextstep-highlighted] {
  outline: 3px solid #ff6b00 !important;
  outline-offset: 4px;
  box-shadow:
    0 0 0 8px rgba(255, 107, 0, 0.15),
    5px 5px 0 #ff6b00 !important;
  border-radius: 10px;
  animation: tour-pulse 1.5s ease-in-out infinite;
}

@keyframes tour-pulse {
  0%,
  100% {
    box-shadow:
      0 0 0 4px rgba(255, 107, 0, 0.2),
      5px 5px 0 #ff6b00;
  }
  50% {
    box-shadow:
      0 0 0 10px rgba(255, 107, 0, 0.08),
      5px 5px 0 #ff6b00;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/dashboard/src/styles/global.css
git commit -m "feat(dashboard): add tour spotlight pulse CSS"
```

---

## Task 5: Create NeubTourCard component

**Files:**

- Create: `packages/dashboard/src/components/organisms/neub-tour-card.tsx`

- [ ] **Step 1: Create the component**

Create `packages/dashboard/src/components/organisms/neub-tour-card.tsx`:

```tsx
import type { NeubStep } from '~/lib/tour-steps'

interface NeubTourCardProps {
  step: NeubStep
  currentStep: number
  totalSteps: number
  nextStep: () => void
  prevStep: () => void
  skipTour: () => void
  arrow: React.ReactNode
}

export function NeubTourCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  skipTour,
  arrow,
}: NeubTourCardProps) {
  const isFirst = currentStep === 0
  const isLast = currentStep === totalSteps - 1
  const isCompletionStep = isLast
  const textColor = isCompletionStep ? '#fff' : '#1a1a2e'
  const bodyTextColor = isCompletionStep ? 'rgba(255,255,255,0.92)' : '#2a2a3e'

  return (
    <div
      style={{
        position: 'relative',
        width: 300,
        border: '3px solid #1a1a2e',
        borderRadius: 18,
        boxShadow: '5px 5px 0 #1a1a2e',
        backgroundColor: step.color,
        overflow: 'visible',
      }}
    >
      {arrow}

      <div style={{ padding: '16px 18px 14px' }}>
        {/* Step counter + skip */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontFamily: "'Shantell Sans', cursive",
              fontSize: '0.62rem',
              fontWeight: 800,
              color: textColor,
              opacity: 0.65,
              letterSpacing: '0.08em',
            }}
          >
            {currentStep + 1} / {totalSteps}
          </span>

          {step.showSkip && !isLast && (
            <button
              type="button"
              onClick={skipTour}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'Shantell Sans', cursive",
                fontSize: '0.62rem',
                fontWeight: 800,
                color: textColor,
                opacity: 0.55,
                padding: '2px 4px',
                textDecoration: 'underline',
              }}
            >
              Bỏ qua
            </button>
          )}
        </div>

        {/* Title */}
        <h3
          style={{
            fontFamily: "'Shantell Sans', cursive",
            fontSize: '1rem',
            fontWeight: 800,
            color: textColor,
            marginBottom: 8,
            lineHeight: 1.3,
            margin: '0 0 8px',
          }}
        >
          {step.title}
        </h3>

        {/* Content */}
        <p
          style={{
            fontFamily: "'Be Vietnam Pro', sans-serif",
            fontSize: '0.8rem',
            fontWeight: 400,
            color: bodyTextColor,
            lineHeight: 1.65,
            margin: '0 0 14px',
          }}
        >
          {step.content as string}
        </p>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {!isFirst && !isLast && (
            <button
              type="button"
              onClick={prevStep}
              style={{
                fontFamily: "'Shantell Sans', cursive",
                fontSize: '0.7rem',
                fontWeight: 800,
                padding: '6px 12px',
                border: '2.5px solid #1a1a2e',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.55)',
                boxShadow: '2px 2px 0 #1a1a2e',
                cursor: 'pointer',
                color: '#1a1a2e',
              }}
            >
              ← Trước
            </button>
          )}

          <button
            type="button"
            onClick={nextStep}
            style={{
              fontFamily: "'Shantell Sans', cursive",
              fontSize: '0.7rem',
              fontWeight: 800,
              padding: '6px 14px',
              border: '2.5px solid #1a1a2e',
              borderRadius: 8,
              background: '#1a1a2e',
              boxShadow: '2px 2px 0 rgba(0,0,0,0.35)',
              cursor: 'pointer',
              color: step.color,
            }}
          >
            {isLast ? '🎉 Hoàn thành!' : 'Tiếp →'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd packages/dashboard && bun run typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/dashboard/src/components/organisms/neub-tour-card.tsx
git commit -m "feat(dashboard): add NeubTourCard Neubrutalism 3D component"
```

---

## Task 6: Create TourFloatButton component

**Files:**

- Create: `packages/dashboard/src/components/organisms/tour-float-button.tsx`

- [ ] **Step 1: Create the component**

Create `packages/dashboard/src/components/organisms/tour-float-button.tsx`:

```tsx
import { useNextStep } from 'nextstepjs'
import { TOUR_NAME } from '~/lib/tour-steps'
import { useUiStore, selectTourSeenVersion } from '~/stores/ui-store'

export function TourFloatButton() {
  const { startNextStep } = useNextStep()
  const tourSeenVersion = useUiStore(selectTourSeenVersion)
  const showBadge = tourSeenVersion === null

  return (
    <button
      type="button"
      onClick={() => {
        startNextStep(TOUR_NAME)
      }}
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
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Shantell Sans', cursive",
        fontSize: '1.3rem',
        fontWeight: 800,
        color: '#fff',
        transition: 'transform 0.12s ease, box-shadow 0.12s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'rotate(-5deg) translate(-2px, -2px)'
        e.currentTarget.style.boxShadow = '6px 6px 0 #1a1a2e'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = '4px 4px 0 #1a1a2e'
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

- [ ] **Step 2: Run typecheck**

```bash
cd packages/dashboard && bun run typecheck 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add packages/dashboard/src/components/organisms/tour-float-button.tsx
git commit -m "feat(dashboard): add TourFloatButton with notification badge"
```

---

## Task 7: Add tour IDs to room-list.tsx

**Files:**

- Modify: `packages/dashboard/src/pages/room-list.tsx`

- [ ] **Step 1: Add tourId field to stat objects and wrap each BrutalCard**

In `packages/dashboard/src/pages/room-list.tsx`, replace the stats grid section:

```tsx
// Before — the array starts at line ~237:
{[
  {
    label: 'Total Rooms',
    value: rooms.length,
    tone: 'accent' as const,
    theme: 'theme-card-lilac',
    tilt: 'left' as const,
  },
  {
    label: 'Active',
    value: activeCount,
    tone: 'success' as const,
    theme: 'theme-card-mint',
    tilt: 'flat' as const,
  },
  {
    label: 'Inactive',
    value: inactiveCount,
    tone: 'warning' as const,
    theme: 'theme-card-butter',
    tilt: 'right' as const,
  },
].map((stat) => (
  <BrutalCard
    key={stat.label}
    tilt={stat.tilt}
    className={[stat.theme, 'space-y-3'].join(' ')}
  >
```

```tsx
// After:
{[
  {
    label: 'Total Rooms',
    tourId: 'tour-stat-total',
    value: rooms.length,
    tone: 'accent' as const,
    theme: 'theme-card-lilac',
    tilt: 'left' as const,
  },
  {
    label: 'Active',
    tourId: 'tour-stat-active',
    value: activeCount,
    tone: 'success' as const,
    theme: 'theme-card-mint',
    tilt: 'flat' as const,
  },
  {
    label: 'Inactive',
    tourId: 'tour-stat-inactive',
    value: inactiveCount,
    tone: 'warning' as const,
    theme: 'theme-card-butter',
    tilt: 'right' as const,
  },
].map((stat) => (
  <div key={stat.label} id={stat.tourId}>
    <BrutalCard
      tilt={stat.tilt}
      className={[stat.theme, 'space-y-3'].join(' ')}
    >
```

Also close the wrapping div after the BrutalCard's closing `</BrutalCard>`:

```tsx
    </BrutalCard>
  </div>
))}
```

- [ ] **Step 2: Add id="tour-new-room" to the New Room button**

Find the New Room button (around line 202):

```tsx
// Before:
<button
  type="button"
  onClick={() => {
    void navigate('/rooms/new')
  }}
  className="brutal-button theme-button-violet grid w-full grid-cols-[2.5rem_1fr] items-center gap-x-2 px-4 py-3 text-left font-heading text-sm font-bold text-white whitespace-nowrap"
>
```

```tsx
// After:
<button
  id="tour-new-room"
  type="button"
  onClick={() => {
    void navigate('/rooms/new')
  }}
  className="brutal-button theme-button-violet grid w-full grid-cols-[2.5rem_1fr] items-center gap-x-2 px-4 py-3 text-left font-heading text-sm font-bold text-white whitespace-nowrap"
>
```

- [ ] **Step 3: Add tour IDs to first room card (index 0)**

Update `rooms.map((room) =>` to `rooms.map((room, roomIndex) =>`:

```tsx
// Before:
{rooms.map((room) =>
  (() => {
    const isSpotlighted = room.id === spotlightRoomId

    return (
      <div
        key={room.id}
        className="rounded-[24px] p-1"
        style={{ position: 'relative' }}
      >
```

```tsx
// After:
{rooms.map((room, roomIndex) =>
  (() => {
    const isSpotlighted = room.id === spotlightRoomId

    return (
      <div
        key={room.id}
        id={roomIndex === 0 ? 'tour-room-card-first' : undefined}
        className="rounded-[24px] p-1"
        style={{ position: 'relative' }}
      >
```

- [ ] **Step 4: Add tour IDs to toggle, edit, delete in first card**

Wrap the `RoomStatusToggle` with a div for the toggle ID:

```tsx
// Before:
<RoomStatusToggle
  enabled={room.enabled}
  loading={roomToggleAction.loading}
  onToggle={() => {
    void handleToggle(room.id, room.destinationRoomName, room.enabled)
  }}
/>
```

```tsx
// After:
<div id={roomIndex === 0 ? 'tour-status-toggle' : undefined}>
  <RoomStatusToggle
    enabled={room.enabled}
    loading={roomToggleAction.loading}
    onToggle={() => {
      void handleToggle(room.id, room.destinationRoomName, room.enabled)
    }}
  />
</div>
```

Add `id` to the Edit button:

```tsx
// Before:
<button
  type="button"
  onClick={() => {
    void navigate(`/rooms/${room.id}`)
  }}
  className="brutal-button theme-button-sky inline-flex items-center gap-2 px-4 py-1.5 font-heading text-xs font-bold text-[var(--border)]"
>
```

```tsx
// After:
<button
  id={roomIndex === 0 ? 'tour-edit-btn' : undefined}
  type="button"
  onClick={() => {
    void navigate(`/rooms/${room.id}`)
  }}
  className="brutal-button theme-button-sky inline-flex items-center gap-2 px-4 py-1.5 font-heading text-xs font-bold text-[var(--border)]"
>
```

Add `id` to the Delete button:

```tsx
// Before:
<button
  type="button"
  onClick={() => {
    setSelectedRoom(room)
  }}
  className="brutal-button theme-button-pink inline-flex items-center gap-2 px-4 py-1.5 font-heading text-xs font-bold text-[#fff7ed]"
>
```

```tsx
// After:
<button
  id={roomIndex === 0 ? 'tour-delete-btn' : undefined}
  type="button"
  onClick={() => {
    setSelectedRoom(room)
  }}
  className="brutal-button theme-button-pink inline-flex items-center gap-2 px-4 py-1.5 font-heading text-xs font-bold text-[#fff7ed]"
>
```

- [ ] **Step 5: Run typecheck**

```bash
cd packages/dashboard && bun run typecheck 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add packages/dashboard/src/pages/room-list.tsx
git commit -m "feat(dashboard): add tour selector IDs to room-list stats and cards"
```

---

## Task 8: Add tour IDs to room-create.tsx

**Files:**

- Modify: `packages/dashboard/src/pages/room-create.tsx`

- [ ] **Step 1: Wrap Room ID input with tour div**

In `packages/dashboard/src/pages/room-create.tsx`, wrap the `Original Room ID` BrutalInput:

```tsx
// Before:
<BrutalInput
  label="Original Room ID"
  type="text"
  inputMode="numeric"
  hint="The numeric ID of the source Chatwork room."
  error={errors.originalRoomId?.message}
  {...register('originalRoomId', {
    setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
  })}
/>
```

```tsx
// After:
<div id="tour-field-roomid">
  <BrutalInput
    label="Original Room ID"
    type="text"
    inputMode="numeric"
    hint="The numeric ID of the source Chatwork room."
    error={errors.originalRoomId?.message}
    {...register('originalRoomId', {
      setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
    })}
  />
</div>
```

- [ ] **Step 2: Wrap Destination Room Name input with tour div**

```tsx
// Before:
<BrutalInput
  label="Destination Room Name"
  type="text"
  hint="Internal name for the translated output room."
  error={errors.destinationRoomName?.message}
  {...register('destinationRoomName')}
/>
```

```tsx
// After:
<div id="tour-field-roomname">
  <BrutalInput
    label="Destination Room Name"
    type="text"
    hint="Internal name for the translated output room."
    error={errors.destinationRoomName?.message}
    {...register('destinationRoomName')}
  />
</div>
```

- [ ] **Step 3: Wrap AI Provider select with tour div**

```tsx
// Before:
<BrutalSelect
  label="AI Provider"
  options={providerOptions}
  colorVariant="accent"
  hint="Choose which AI service handles translations."
  error={errors.aiProvider?.message}
  {...aiProviderField}
/>
```

```tsx
// After:
<div id="tour-field-provider">
  <BrutalSelect
    label="AI Provider"
    options={providerOptions}
    colorVariant="accent"
    hint="Choose which AI service handles translations."
    error={errors.aiProvider?.message}
    {...aiProviderField}
  />
</div>
```

- [ ] **Step 4: Wrap AI Model select with tour div**

```tsx
// Before:
<BrutalSelect
  label="AI Model"
  options={modelOptions}
  colorVariant="mint"
  hint="Select the model for translation quality and cost balance."
  error={errors.aiModel?.message}
  value={aiModel}
  {...register('aiModel')}
/>
```

```tsx
// After:
<div id="tour-field-model">
  <BrutalSelect
    label="AI Model"
    options={modelOptions}
    colorVariant="mint"
    hint="Select the model for translation quality and cost balance."
    error={errors.aiModel?.message}
    value={aiModel}
    {...register('aiModel')}
  />
</div>
```

- [ ] **Step 5: Wrap Translation Style select with tour div**

```tsx
// Before:
<BrutalSelect
  label="Translation Style"
  options={styleOptions}
  colorVariant="peach"
  hint="Controls the tone and formality of output."
  error={errors.translationStyle?.message}
  {...register('translationStyle')}
/>
```

```tsx
// After:
<div id="tour-field-style">
  <BrutalSelect
    label="Translation Style"
    options={styleOptions}
    colorVariant="peach"
    hint="Controls the tone and formality of output."
    error={errors.translationStyle?.message}
    {...register('translationStyle')}
  />
</div>
```

- [ ] **Step 6: Wrap AI API Token input with tour div**

```tsx
// Before:
<BrutalInput
  label="AI API Token"
  type="password"
  placeholder={selectedProvider === 'openai' ? 'sk-...' : 'AIza...'}
  hint="Your provider API key for the selected translation service."
  error={errors.aiApiToken?.message}
  {...register('aiApiToken')}
/>
```

```tsx
// After:
<div id="tour-field-token">
  <BrutalInput
    label="AI API Token"
    type="password"
    placeholder={selectedProvider === 'openai' ? 'sk-...' : 'AIza...'}
    hint="Your provider API key for the selected translation service."
    error={errors.aiApiToken?.message}
    {...register('aiApiToken')}
  />
</div>
```

- [ ] **Step 7: Wrap ContextField with tour div**

```tsx
// Before (inside the xl:col-span-2 section):
{
  ;(() => {
    const contextFieldProps: {
      value: string
      onChange: (v: string) => void
      error?: string
    } = {
      value: watch('context'),
      onChange: (v: string) => {
        setValue('context', v, { shouldValidate: true })
      },
    }
    if (errors.context?.message) {
      contextFieldProps.error = errors.context.message
    }
    return <ContextField {...contextFieldProps} />
  })()
}
```

```tsx
// After:
<div id="tour-field-context">
  {(() => {
    const contextFieldProps: {
      value: string
      onChange: (v: string) => void
      error?: string
    } = {
      value: watch('context'),
      onChange: (v: string) => {
        setValue('context', v, { shouldValidate: true })
      },
    }
    if (errors.context?.message) {
      contextFieldProps.error = errors.context.message
    }
    return <ContextField {...contextFieldProps} />
  })()}
</div>
```

- [ ] **Step 8: Wrap KeywordProtectionField with tour div**

```tsx
// Before:
<KeywordProtectionField
  value={watch('protectedKeywords')}
  onChange={(v) => {
    setValue('protectedKeywords', v, { shouldValidate: true })
  }}
/>
```

```tsx
// After:
<div id="tour-field-keywords">
  <KeywordProtectionField
    value={watch('protectedKeywords')}
    onChange={(v) => {
      setValue('protectedKeywords', v, { shouldValidate: true })
    }}
  />
</div>
```

- [ ] **Step 9: Add id to Save/Submit button**

```tsx
// Before:
<button
  type="submit"
  disabled={isSubmitting}
  className="brutal-button theme-button-violet px-6 py-3 font-heading text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
>
```

```tsx
// After:
<button
  id="tour-save-btn"
  type="submit"
  disabled={isSubmitting}
  className="brutal-button theme-button-violet px-6 py-3 font-heading text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
>
```

- [ ] **Step 10: Run typecheck**

```bash
cd packages/dashboard && bun run typecheck
```

- [ ] **Step 11: Commit**

```bash
git add packages/dashboard/src/pages/room-create.tsx
git commit -m "feat(dashboard): add tour selector IDs to every create-room field"
```

---

## Task 9: Add inner tour IDs to context-field and keyword-protection-field

**Files:**

- Modify: `packages/dashboard/src/components/molecules/context-field.tsx`
- Modify: `packages/dashboard/src/components/molecules/keyword-protection-field.tsx`

- [ ] **Step 1: Add id to context-template-list-wrap in context-field.tsx**

In `packages/dashboard/src/components/molecules/context-field.tsx`, find:

```tsx
<div className="context-template-list-wrap">
```

Replace with:

```tsx
<div id="tour-context-templates" className="context-template-list-wrap">
```

- [ ] **Step 2: Add id to add form div in keyword-protection-field.tsx**

In `packages/dashboard/src/components/molecules/keyword-protection-field.tsx`, find the add form div:

```tsx
{/* Add form */}
<div
  style={{
    border: '2px solid rgba(26,26,46,0.25)',
    borderRadius: 10,
    padding: 12,
    background: '#fffbeb',
  }}
>
```

Replace with:

```tsx
{/* Add form */}
<div
  id="tour-keyword-addform"
  style={{
    border: '2px solid rgba(26,26,46,0.25)',
    borderRadius: 10,
    padding: 12,
    background: '#fffbeb',
  }}
>
```

- [ ] **Step 3: Run typecheck**

```bash
cd packages/dashboard && bun run typecheck 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add packages/dashboard/src/components/molecules/context-field.tsx packages/dashboard/src/components/molecules/keyword-protection-field.tsx
git commit -m "feat(dashboard): add #tour-context-templates and #tour-keyword-addform IDs"
```

---

## Task 10: Add auto-trigger to app-layout.tsx

**Files:**

- Modify: `packages/dashboard/src/layouts/app-layout.tsx`

- [ ] **Step 1: Add `id="tour-sidebar-nav"` to the desktop sidebar nav**

Find the desktop sidebar nav:

```tsx
<nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:space-y-2 lg:overflow-visible lg:pb-0">
```

Replace with:

```tsx
<nav
  id="tour-sidebar-nav"
  className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:space-y-2 lg:overflow-visible lg:pb-0"
>
```

- [ ] **Step 2: Add imports for useNextStep and TOUR_NAME**

At the top of `packages/dashboard/src/layouts/app-layout.tsx`, add to imports:

```tsx
import { useEffect } from 'react'
import { useNextStep } from 'nextstepjs'
import { TOUR_NAME } from '~/lib/tour-steps'
```

- [ ] **Step 3: Add auto-trigger logic inside AppLayout function body**

Inside the `AppLayout` function, after the existing `const sidebarCollapsed` and `const toggleSidebar` lines, add:

```tsx
const { startNextStep } = useNextStep()

useEffect(() => {
  // Only auto-trigger on very first visit (tourSeenVersion === null in localStorage)
  if (useUiStore.getState().tourSeenVersion !== null) return

  const id = window.setTimeout(() => {
    startNextStep(TOUR_NAME)
  }, 800)

  return () => {
    window.clearTimeout(id)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

- [ ] **Step 4: Run typecheck**

```bash
cd packages/dashboard && bun run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/src/layouts/app-layout.tsx
git commit -m "feat(dashboard): add sidebar tour selector and auto-trigger"
```

---

## Task 11: Wire NextStepProvider + TourFloatButton in main.tsx

**Files:**

- Modify: `packages/dashboard/src/main.tsx`

- [ ] **Step 1: Update main.tsx**

Replace `packages/dashboard/src/main.tsx` entirely with:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { NextStepProvider, NextStepReact } from 'nextstepjs'
import { useReactRouterAdapter } from 'nextstepjs/adapters/react-router'
import { ToastProvider } from '~/components/organisms/toast-provider'
import { NeubTourCard } from '~/components/organisms/neub-tour-card'
import { TourFloatButton } from '~/components/organisms/tour-float-button'
import { tours, TOUR_VERSION } from '~/lib/tour-steps'
import { useUiStore } from '~/stores/ui-store'
import { router } from '~/router'
import '~/styles/global.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <ToastProvider>
      <NextStepProvider>
        <NextStepReact
          steps={tours}
          cardComponent={NeubTourCard}
          navigationAdapter={useReactRouterAdapter}
          onComplete={() => {
            useUiStore.getState().setTourSeen(TOUR_VERSION)
          }}
          onSkip={() => {
            useUiStore.getState().setTourSeen(TOUR_VERSION)
          }}
        >
          <RouterProvider router={router} />
          <TourFloatButton />
        </NextStepReact>
      </NextStepProvider>
    </ToastProvider>
  </StrictMode>,
)
```

- [ ] **Step 2: Run typecheck**

```bash
cd packages/dashboard && bun run typecheck
```

- [ ] **Step 3: Run full test suite**

```bash
bun test && bun run typecheck && bun run lint 2>&1 | tail -20
```

Expected: all tests pass, no type errors, no lint errors.

- [ ] **Step 4: Commit**

```bash
git add packages/dashboard/src/main.tsx
git commit -m "feat(dashboard): wire NextStepProvider and TourFloatButton in main.tsx"
```

---

## Task 12: Final verification

- [ ] **Step 1: Run full test suite one last time**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: command exits 0 with no test, typecheck, or lint failures.

- [ ] **Step 2: Manual smoke test — first visit**

```bash
cd packages/dashboard && bun run dev
```

Open browser in incognito / clear localStorage for `chatwork-bot-ui-store`. Navigate to dashboard. After 800ms, tour should auto-start. Verify:

- Step 1 (Welcome) appears center screen
- Step 2 highlights the sidebar menu
- Steps 3–5 highlight Total / Active / Inactive one-by-one
- Step 6 highlights New Room and navigates to `/rooms/new`
- Steps 7–12 highlight every required create-room field: Room ID, Destination Room Name, AI Provider, AI Model, Translation Style, AI API Token
- Steps 13–16 explain the optional sections: Context, Quick Templates, Keyword Protection, Keyword Add Form
- Step 17 highlights Save and navigates back to `/`
- Steps 18–21 highlight room card, toggle, edit, and delete (or center screen if 0 rooms)
- Step 22 (Completion) appears center screen

- [ ] **Step 3: Manual smoke test — replay button**

Complete or skip the tour. Floating `?` button should appear bottom-right. Badge disappears after first view. Click `?` to replay — tour restarts from step 1.

- [ ] **Step 4: Manual smoke test — persist across sessions**

Complete tour. Close browser. Reopen. Tour should NOT auto-trigger again. Open incognito — tour should auto-trigger again.

- [ ] **Step 5: Final commit**

```bash
git add -A packages/dashboard
git commit -m "feat(dashboard): complete tour guide feature — 22-step walkthrough"
```

---

## Edge Cases Checklist

| Scenario                                    | Expected Behavior                                                                                                                                        |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rooms.length === 0` khi đến steps 18–21    | `selector: '#tour-room-card-first'` không tìm được element → NextStep.js fallback: card hiện giữa màn hình                                               |
| User đóng tab giữa tour                     | `tourSeenVersion` chưa set → tour auto-trigger lại khi mở tab mới                                                                                        |
| User click "Bỏ qua"                         | `onSkip` callback → `setTourSeen(TOUR_VERSION)`                                                                                                          |
| User click "Hoàn thành" (step 22)           | `onComplete` callback → `setTourSeen(TOUR_VERSION)`                                                                                                      |
| Clear localStorage / Incognito              | `tourSeenVersion = null` → auto-trigger (expected)                                                                                                       |
| `TOUR_VERSION` tăng lên 2 trong release mới | Users cũ có `tourSeenVersion: 1` → `1 !== null` nên tour KHÔNG re-trigger. Để re-trigger, implement version comparison: `tourSeenVersion < TOUR_VERSION` |

> **Note về version comparison**: Spec hiện tại dùng `!== null` check. Nếu muốn re-trigger khi version tăng, sửa check trong `app-layout.tsx` thành `useUiStore.getState().tourSeenVersion !== TOUR_VERSION`. Đây là deferred improvement.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-02-tour-guide.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration.

**2. Parallel Session (separate)** - Open new session with `superpowers:executing-plans`, batch execution with checkpoints.

Which approach?
