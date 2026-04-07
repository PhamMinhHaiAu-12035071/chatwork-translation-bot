# Route-Scoped Tour Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor tour guide to scope steps per route, preventing cross-page navigation during replay tours.

**Architecture:** Route-based tour configs (Approach A) - separate step arrays per route (dashboard empty/with-room, create, edit), resolver function picks correct array based on pathname + room state, TourFloatButton updates global tours array before starting.

**Tech Stack:** TypeScript 5.4+, React 18, react-router v7, nextstepjs, Zustand, Bun test runner

---

## Task 1: Create tour-steps unit tests (RED phase)

**Files:**

- Create: `packages/dashboard/src/lib/tour-steps.test.ts`

- [ ] **Step 1: Write failing test for getTourStepsForRoute() - dashboard empty**

```typescript
import { describe, expect, it } from 'bun:test'
import { getTourStepsForRoute } from './tour-steps'

describe('getTourStepsForRoute', () => {
  it('returns dashboard empty steps when pathname is / and no rooms', () => {
    const steps = getTourStepsForRoute('/', false)

    expect(steps.length).toBe(6)
    expect(steps[0].title).toContain('Chào mừng')
    expect(steps[1].selector).toBe('#tour-sidebar-nav')
    expect(steps[2].selector).toBe('#tour-stat-total')
    expect(steps[3].selector).toBe('#tour-stat-active')
    expect(steps[4].selector).toBe('#tour-stat-inactive')
    expect(steps[5].title).toContain('Xong rồi')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/dashboard/src/lib/tour-steps.test.ts`

Expected: FAIL with "getTourStepsForRoute is not defined" or "Expected 6, received undefined"

- [ ] **Step 3: Write failing test for dashboard with rooms**

```typescript
it('returns dashboard with room steps when pathname is / and has rooms', () => {
  const steps = getTourStepsForRoute('/', true)

  expect(steps.length).toBe(10)
  expect(steps[0].title).toContain('Chào mừng')
  expect(steps[5].selector).toBe('#tour-room-card-first')
  expect(steps[6].selector).toBe('#tour-status-toggle')
  expect(steps[7].selector).toBe('#tour-edit-btn')
  expect(steps[8].selector).toBe('#tour-delete-btn')
  expect(steps[9].title).toContain('Xong rồi')
})
```

- [ ] **Step 4: Write failing test for create room route**

```typescript
it('returns create room steps when pathname is /rooms/new', () => {
  const steps = getTourStepsForRoute('/rooms/new', false)

  expect(steps.length).toBe(13)
  expect(steps[0].selector).toBe('#tour-field-roomid')
  expect(steps[6].selector).toBe('#tour-field-token')
  expect(steps[12].title).toContain('Xong rồi')
})
```

- [ ] **Step 5: Write failing test for edit room route**

```typescript
it('returns edit room steps when pathname is /rooms/:id', () => {
  const steps = getTourStepsForRoute('/rooms/123', false)

  expect(steps.length).toBe(13)
  expect(steps[0].selector).toBe('#tour-field-roomid')
})

it('recognizes various edit room paths', () => {
  expect(getTourStepsForRoute('/rooms/abc', false).length).toBe(13)
  expect(getTourStepsForRoute('/rooms/999', false).length).toBe(13)
})
```

- [ ] **Step 6: Write failing test for unknown routes**

```typescript
it('returns empty array for unknown routes', () => {
  expect(getTourStepsForRoute('/unknown', false)).toEqual([])
  expect(getTourStepsForRoute('/free-rooms', false)).toEqual([])
  expect(getTourStepsForRoute('/guide', false)).toEqual([])
  expect(getTourStepsForRoute('/rooms', false)).toEqual([])
})
```

- [ ] **Step 7: Run all tests to verify they fail**

Run: `bun test packages/dashboard/src/lib/tour-steps.test.ts`

Expected: 6 FAIL

- [ ] **Step 8: Commit RED phase**

```bash
git add packages/dashboard/src/lib/tour-steps.test.ts
git commit -m "test: add failing tests for route-scoped tour resolver"
```

---

## Task 2: Implement getTourStepsForRoute() (GREEN phase)

**Files:**

- Modify: `packages/dashboard/src/lib/tour-steps.ts`

- [ ] **Step 1: Read current tour-steps.ts structure**

Run: `cat packages/dashboard/src/lib/tour-steps.ts | head -20`

Note current exports: `TOUR_VERSION`, `TOUR_NAME`, `NeubStep`, `steps`, `tours`

- [ ] **Step 2: Create dashboardEmptySteps array**

Add after line 7 (after `export type NeubStep = Step & { color: string }`):

```typescript
// Route-specific step configurations

const dashboardEmptySteps: NeubStep[] = [
  {
    icon: null,
    title: '👋 Chào mừng!',
    content:
      'Đây là nơi để xem và quản lý các phòng dịch. Mình sẽ chỉ bạn từng phần, ngắn gọn và dễ làm theo.',
    side: 'bottom',
    showControls: true,
    showSkip: true,
    color: '#ffd166',
  },
  {
    icon: null,
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
    icon: null,
    selector: '#tour-stat-total',
    title: '📦 Tổng số phòng',
    content: 'Con số này cho biết bạn đang có tất cả bao nhiêu phòng đã được tạo.',
    side: 'bottom',
    showControls: true,
    showSkip: true,
    color: '#c9b1ff',
  },
  {
    icon: null,
    selector: '#tour-stat-active',
    title: '✅ Phòng đang bật',
    content: 'Đây là số phòng đang hoạt động. Khi phòng đang bật, bot đang làm việc.',
    side: 'bottom',
    showControls: true,
    showSkip: true,
    color: '#86e8c0',
  },
  {
    icon: null,
    selector: '#tour-stat-inactive',
    title: '⏸️ Phòng đang tạm dừng',
    content: 'Đây là số phòng đang nghỉ tạm. Muốn dùng lại thì chỉ cần bật lên.',
    side: 'bottom',
    showControls: true,
    showSkip: true,
    color: '#fed7aa',
  },
  {
    icon: null,
    title: '🎉 Xong rồi!',
    content:
      'Bạn đã xem xong tour dashboard. Khi nào cần xem lại, chỉ cần bấm nút dấu hỏi ở góc màn hình.',
    side: 'bottom',
    showControls: true,
    showSkip: false,
    color: '#ff6b6b',
  },
]
```

- [ ] **Step 3: Create dashboardWithRoomSteps array**

Add after dashboardEmptySteps:

```typescript
const dashboardWithRoomSteps: NeubStep[] = [
  {
    icon: null,
    title: '👋 Chào mừng!',
    content:
      'Đây là nơi để xem và quản lý các phòng dịch. Mình sẽ chỉ bạn từng phần, ngắn gọn và dễ làm theo.',
    side: 'bottom',
    showControls: true,
    showSkip: true,
    color: '#ffd166',
  },
  {
    icon: null,
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
    icon: null,
    selector: '#tour-stat-total',
    title: '📦 Tổng số phòng',
    content: 'Con số này cho biết bạn đang có tất cả bao nhiêu phòng đã được tạo.',
    side: 'bottom',
    showControls: true,
    showSkip: true,
    color: '#c9b1ff',
  },
  {
    icon: null,
    selector: '#tour-stat-active',
    title: '✅ Phòng đang bật',
    content: 'Đây là số phòng đang hoạt động. Khi phòng đang bật, bot đang làm việc.',
    side: 'bottom',
    showControls: true,
    showSkip: true,
    color: '#86e8c0',
  },
  {
    icon: null,
    selector: '#tour-stat-inactive',
    title: '⏸️ Phòng đang tạm dừng',
    content: 'Đây là số phòng đang nghỉ tạm. Muốn dùng lại thì chỉ cần bật lên.',
    side: 'bottom',
    showControls: true,
    showSkip: true,
    color: '#fed7aa',
  },
  {
    icon: null,
    selector: '#tour-room-card-first',
    title: '🃏 Thẻ phòng',
    content: 'Mỗi thẻ là một phòng bạn đã tạo. Trong thẻ có các thông tin chính của phòng đó.',
    side: 'right',
    showControls: true,
    showSkip: true,
    color: '#fde68a',
  },
  {
    icon: null,
    selector: '#tour-status-toggle',
    title: '🔀 Bật / Tắt',
    content: 'Nút này dùng để bật hoặc tắt bot của phòng. Bật là bot làm việc, tắt là bot nghỉ.',
    side: 'left',
    showControls: true,
    showSkip: true,
    color: '#a5f3fc',
  },
  {
    icon: null,
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
    icon: null,
    selector: '#tour-delete-btn',
    title: '🗑️ Xóa phòng',
    content: 'Muốn xóa phòng thì bấm Delete. Hệ thống sẽ hỏi lại một lần nữa để tránh bấm nhầm.',
    side: 'top',
    showControls: true,
    showSkip: true,
    color: '#f9a8d4',
  },
  {
    icon: null,
    title: '🎉 Xong rồi!',
    content:
      'Bạn đã xem xong tour dashboard. Khi nào cần xem lại, chỉ cần bấm nút dấu hỏi ở góc màn hình.',
    side: 'bottom',
    showControls: true,
    showSkip: false,
    color: '#ff6b6b',
  },
]
```

- [ ] **Step 4: Create createRoomSteps array**

Add after dashboardWithRoomSteps:

```typescript
const createRoomSteps: NeubStep[] = [
  {
    icon: null,
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
    icon: null,
    selector: '#tour-field-roomname-orig',
    title: '🏢 Original Room Name',
    content:
      'Tên gốc của room từ Chatwork. Bot sẽ tự động lấy tên này từ API của Chatwork sau khi bạn nhập Room ID.',
    side: 'right',
    showControls: true,
    showSkip: true,
    color: '#b8e6e6',
  },
  {
    icon: null,
    selector: '#tour-field-roomname',
    title: '🏷️ Tên phòng',
    content: 'Đặt một cái tên dễ nhớ cho phòng này. Ví dụ: Nhom Ky Thuat JP hoặc Bao Cao Sang.',
    side: 'right',
    showControls: true,
    showSkip: true,
    color: '#f4978e',
  },
  {
    icon: null,
    selector: '#tour-field-provider',
    title: '🤖 Hãng AI',
    content: 'Chọn hãng AI sẽ giúp bạn dịch, ví dụ OpenAI hoặc Gemini.',
    side: 'right',
    showControls: true,
    showSkip: true,
    color: '#ffb3c1',
  },
  {
    icon: null,
    selector: '#tour-field-model',
    title: '🧠 Model AI',
    content: 'Chọn model AI. Bạn có thể hiểu đơn giản đây là phiên bản AI mà bot sẽ dùng.',
    side: 'right',
    showControls: true,
    showSkip: true,
    color: '#9381ff',
  },
  {
    icon: null,
    selector: '#tour-field-style',
    title: '🎨 Kiểu dịch',
    content: 'Chọn kiểu lời văn bạn muốn bot dùng, như thân thiện, lịch sự, hoặc kỹ thuật.',
    side: 'right',
    showControls: true,
    showSkip: true,
    color: '#bef264',
  },
  {
    icon: null,
    selector: '#tour-field-token',
    title: '🔑 API Token',
    content: 'Dán chìa khóa API của hãng AI vào đây. Thiếu ô này thì bot sẽ không làm việc được.',
    side: 'right',
    showControls: true,
    showSkip: true,
    color: '#e4c1f9',
  },
  {
    icon: null,
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
    icon: null,
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
    icon: null,
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
    icon: null,
    selector: '#tour-keyword-addform',
    title: '➕ Thêm keyword',
    content:
      'Nhập từ cần giữ nguyên, chọn loại của nó, nếu muốn thì đặt tên thay thế, rồi bấm Add.',
    side: 'bottom',
    showControls: true,
    showSkip: true,
    color: '#fef3c7',
  },
  {
    icon: null,
    selector: '#tour-save-btn',
    title: '💾 Lưu phòng',
    content: 'Khi đã kiểm tra xong, bấm Create Room để lưu.',
    side: 'top',
    showControls: true,
    showSkip: true,
    color: '#fb923c',
  },
  {
    icon: null,
    title: '🎉 Xong rồi!',
    content: 'Bạn đã xem xong tour. Khi nào cần xem lại, chỉ cần bấm nút dấu hỏi ở góc màn hình.',
    side: 'bottom',
    showControls: true,
    showSkip: false,
    color: '#ff6b6b',
  },
]
```

- [ ] **Step 5: Create editRoomSteps alias**

Add after createRoomSteps:

```typescript
const editRoomSteps = createRoomSteps // Edit room uses same steps as create
```

- [ ] **Step 6: Implement getTourStepsForRoute() function**

Add after editRoomSteps:

```typescript
export function getTourStepsForRoute(pathname: string, hasRooms: boolean): NeubStep[] {
  // Dashboard route
  if (pathname === '/') {
    return hasRooms ? dashboardWithRoomSteps : dashboardEmptySteps
  }

  // Create room route
  if (pathname === '/rooms/new') {
    return createRoomSteps
  }

  // Edit room route (any /rooms/:id except /rooms/new)
  if (pathname.startsWith('/rooms/') && pathname !== '/rooms/new') {
    return editRoomSteps
  }

  // No tour for this route
  return []
}
```

- [ ] **Step 7: Run tests to verify GREEN**

Run: `bun test packages/dashboard/src/lib/tour-steps.test.ts`

Expected: 6 PASS

- [ ] **Step 8: Commit GREEN phase**

```bash
git add packages/dashboard/src/lib/tour-steps.ts
git commit -m "feat: add route-scoped tour step configs and resolver"
```

---

## Task 3: Add updateToursForRoute() function with tests

**Files:**

- Modify: `packages/dashboard/src/lib/tour-steps.ts`
- Modify: `packages/dashboard/src/lib/tour-steps.test.ts`

- [ ] **Step 1: Write failing test for updateToursForRoute()**

Add to tour-steps.test.ts after existing tests:

```typescript
describe('updateToursForRoute', () => {
  it('updates global tours array with dashboard empty steps', () => {
    updateToursForRoute('/', false)

    expect(tours[0].tour).toBe(TOUR_NAME)
    expect(tours[0].steps.length).toBe(6)
    expect(tours[0].steps).toBe(dashboardEmptySteps)
  })

  it('updates global tours array with dashboard with room steps', () => {
    updateToursForRoute('/', true)

    expect(tours[0].steps.length).toBe(10)
    expect(tours[0].steps[5].selector).toBe('#tour-room-card-first')
  })

  it('updates global tours array with create room steps', () => {
    updateToursForRoute('/rooms/new', false)

    expect(tours[0].steps.length).toBe(13)
    expect(tours[0].steps[0].selector).toBe('#tour-field-roomid')
  })

  it('updates global tours array with edit room steps', () => {
    updateToursForRoute('/rooms/123', false)

    expect(tours[0].steps.length).toBe(13)
  })

  it('updates with empty array for unknown routes', () => {
    updateToursForRoute('/guide', false)

    expect(tours[0].steps).toEqual([])
  })
})
```

Note: Tests will fail because updateToursForRoute() doesn't exist yet, and dashboardEmptySteps isn't exported.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/dashboard/src/lib/tour-steps.test.ts`

Expected: 5 FAIL (updateToursForRoute/tours not defined, dashboardEmptySteps not exported)

- [ ] **Step 3: Export step arrays for testing**

In tour-steps.ts, change const to export const for test access:

```typescript
export const dashboardEmptySteps: NeubStep[] = [
  // ... existing content ...
]

export const dashboardWithRoomSteps: NeubStep[] = [
  // ... existing content ...
]

export const createRoomSteps: NeubStep[] = [
  // ... existing content ...
]

export const editRoomSteps = createRoomSteps
```

- [ ] **Step 4: Update tours export to be mutable**

Find the existing `export const tours` line (around line 252) and replace with:

```typescript
// Mutable tours array for dynamic step updates
export const tours: { tour: string; steps: NeubStep[] }[] = [
  { tour: TOUR_NAME, steps: [] }, // Steps populated dynamically by updateToursForRoute
]
```

- [ ] **Step 5: Implement updateToursForRoute() function**

Add after getTourStepsForRoute():

```typescript
export function updateToursForRoute(pathname: string, hasRooms: boolean): void {
  const steps = getTourStepsForRoute(pathname, hasRooms)
  tours[0].steps = steps
}
```

- [ ] **Step 6: Update test imports**

In tour-steps.test.ts, update import line:

```typescript
import {
  getTourStepsForRoute,
  updateToursForRoute,
  tours,
  TOUR_NAME,
  dashboardEmptySteps,
} from './tour-steps'
```

- [ ] **Step 7: Run tests to verify GREEN**

Run: `bun test packages/dashboard/src/lib/tour-steps.test.ts`

Expected: 11 PASS (6 from getTourStepsForRoute + 5 from updateToursForRoute)

- [ ] **Step 8: Commit**

```bash
git add packages/dashboard/src/lib/tour-steps.ts packages/dashboard/src/lib/tour-steps.test.ts
git commit -m "feat: add updateToursForRoute() to sync global tours array"
```

---

## Task 4: Update TourFloatButton with route detection (RED)

**Files:**

- Create: `packages/dashboard/src/components/organisms/tour-float-button.test.tsx`

- [ ] **Step 1: Write failing test for dashboard empty route**

```typescript
import { describe, expect, it, vi } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import { TourFloatButton } from './tour-float-button'
import { tours, TOUR_NAME } from '~/lib/tour-steps'

// Mock dependencies
vi.mock('nextstepjs', () => ({
  useNextStep: () => ({
    startNextStep: vi.fn(),
  }),
}))

vi.mock('react-router', () => ({
  useLocation: () => ({
    pathname: '/',
  }),
}))

vi.mock('~/stores/room-store', () => ({
  useRoomStore: () => [],
}))

vi.mock('~/stores/ui-store', () => ({
  useUiStore: () => null,
  selectTourSeenVersion: (state: any) => state,
}))

describe('TourFloatButton', () => {
  it('enables button and updates tours array for dashboard empty route', () => {
    const { startNextStep } = require('nextstepjs').useNextStep()

    render(<TourFloatButton />)

    const button = screen.getByRole('button', { name: /xem lại tour/i })
    expect(button).not.toBeDisabled()

    fireEvent.click(button)

    expect(tours[0].steps.length).toBe(6)
    expect(startNextStep).toHaveBeenCalledWith(TOUR_NAME)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/dashboard/src/components/organisms/tour-float-button.test.tsx`

Expected: FAIL (button still has old implementation, tours array not updated)

- [ ] **Step 3: Write failing test for dashboard with rooms**

Add after first test:

```typescript
  it('enables button and updates tours array for dashboard with rooms', () => {
    // Override room store mock for this test
    vi.mock('~/stores/room-store', () => ({
      useRoomStore: () => [{ id: '1', name: 'Test Room' }],
    }))

    const { startNextStep } = require('nextstepjs').useNextStep()

    render(<TourFloatButton />)

    fireEvent.click(screen.getByRole('button'))

    expect(tours[0].steps.length).toBe(10)
    expect(tours[0].steps[5].selector).toBe('#tour-room-card-first')
    expect(startNextStep).toHaveBeenCalledWith(TOUR_NAME)
  })
```

- [ ] **Step 4: Write failing test for create room route**

```typescript
  it('enables button and updates tours array for create room route', () => {
    vi.mock('react-router', () => ({
      useLocation: () => ({
        pathname: '/rooms/new',
      }),
    }))

    const { startNextStep } = require('nextstepjs').useNextStep()

    render(<TourFloatButton />)

    fireEvent.click(screen.getByRole('button'))

    expect(tours[0].steps.length).toBe(13)
    expect(tours[0].steps[0].selector).toBe('#tour-field-roomid')
    expect(startNextStep).toHaveBeenCalledWith(TOUR_NAME)
  })
```

- [ ] **Step 5: Write failing test for disabled button on unknown route**

```typescript
  it('disables button for routes without tour', () => {
    vi.mock('react-router', () => ({
      useLocation: () => ({
        pathname: '/guide',
      }),
    }))

    const { startNextStep } = require('nextstepjs').useNextStep()

    render(<TourFloatButton />)

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveStyle({ opacity: '0.5' })

    fireEvent.click(button)
    expect(startNextStep).not.toHaveBeenCalled()
  })
```

- [ ] **Step 6: Run all tests to verify they fail**

Run: `bun test packages/dashboard/src/components/organisms/tour-float-button.test.tsx`

Expected: 4 FAIL

- [ ] **Step 7: Commit RED phase**

```bash
git add packages/dashboard/src/components/organisms/tour-float-button.test.tsx
git commit -m "test: add failing tests for route-aware TourFloatButton"
```

---

## Task 5: Implement TourFloatButton route detection (GREEN)

**Files:**

- Modify: `packages/dashboard/src/components/organisms/tour-float-button.tsx`

- [ ] **Step 1: Add imports for route detection**

At top of file, replace existing imports with:

```typescript
import { useNextStep } from 'nextstepjs'
import { useLocation } from 'react-router'

import { TOUR_NAME, getTourStepsForRoute, updateToursForRoute } from '~/lib/tour-steps'
import { selectTourSeenVersion, useUiStore } from '~/stores/ui-store'
import { useRoomStore } from '~/stores/room-store'
```

- [ ] **Step 2: Add route detection logic in component**

Replace component body (keep return statement structure, update logic):

```typescript
export function TourFloatButton() {
  const { startNextStep } = useNextStep()
  const location = useLocation()
  const rooms = useRoomStore((state) => state.rooms)
  const tourSeenVersion = useUiStore(selectTourSeenVersion)
  const showBadge = tourSeenVersion === null

  // Detect if current route has tour available
  const pathname = location.pathname
  const hasRooms = rooms.length > 0
  const hasTourForCurrentRoute = getTourStepsForRoute(pathname, hasRooms).length > 0

  const handleClick = () => {
    // Early return if no tour (button is disabled anyway)
    if (!hasTourForCurrentRoute) {
      return
    }

    // Update global tours array with route-specific steps
    updateToursForRoute(pathname, hasRooms)

    // Start tour (nextstepjs reads from updated tours array)
    startNextStep(TOUR_NAME)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!hasTourForCurrentRoute}
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
        cursor: hasTourForCurrentRoute ? 'pointer' : 'not-allowed',
        opacity: hasTourForCurrentRoute ? 1 : 0.5,
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
        if (hasTourForCurrentRoute) {
          e.currentTarget.style.transform = 'rotate(-5deg) translate(-2px, -2px)'
          e.currentTarget.style.boxShadow = '6px 6px 0 #1a1a2e'
        }
      }}
      onMouseLeave={(e) => {
        if (hasTourForCurrentRoute) {
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

- [ ] **Step 3: Run tests to verify GREEN**

Run: `bun test packages/dashboard/src/components/organisms/tour-float-button.test.tsx`

Expected: 4 PASS

- [ ] **Step 4: Commit GREEN phase**

```bash
git add packages/dashboard/src/components/organisms/tour-float-button.tsx
git commit -m "feat: add route detection and dynamic tour loading to TourFloatButton"
```

---

## Task 6: Add integration test to app-layout

**Files:**

- Modify: `packages/dashboard/src/layouts/app-layout.test.tsx`

- [ ] **Step 1: Write test for TourFloatButton visibility**

Add at end of existing describe block:

```typescript
it('renders TourFloatButton for tour replay', async () => {
  const source = await Bun.file(new URL('./app-layout.tsx', import.meta.url)).text()

  expect(source).toContain('import { TourFloatButton }')
  expect(source).toContain('<TourFloatButton />')
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `bun test packages/dashboard/src/layouts/app-layout.test.tsx`

Expected: 7 PASS (6 existing + 1 new)

- [ ] **Step 3: Commit**

```bash
git add packages/dashboard/src/layouts/app-layout.test.tsx
git commit -m "test: add TourFloatButton visibility test to app-layout"
```

---

## Task 7: Run full test suite and fix any issues

**Files:**

- Various (as needed)

- [ ] **Step 1: Run all dashboard tests**

Run: `bun test packages/dashboard/`

Expected: All tests PASS

If any fail, investigate and fix before proceeding.

- [ ] **Step 2: Run TypeScript typecheck**

Run: `bun run typecheck`

Expected: No type errors

If errors found, fix type issues:

- Ensure all imports are correct
- Check function signatures match between files
- Fix any missing type exports

- [ ] **Step 3: Run ESLint**

Run: `bun run lint`

Expected: No lint errors

If errors found, fix:

- Unused imports
- Unused variables (prefix with `_` if intentional)
- Missing dependencies in useEffect

- [ ] **Step 4: Manual smoke test - Dashboard empty**

1. Start dev server: `bun run dev`
2. Navigate to `http://localhost:5173/`
3. Ensure no rooms exist (delete all if needed)
4. Click `?` button
5. Verify tour has 6 steps and doesn't navigate
6. Complete or skip tour

Expected: Tour runs smoothly, stays on dashboard

- [ ] **Step 5: Manual smoke test - Dashboard with room**

1. Create a room via UI
2. Return to dashboard
3. Click `?` button
4. Verify tour has 10 steps including room card
5. Complete or skip tour

Expected: Tour includes room interaction steps

- [ ] **Step 6: Manual smoke test - Create room**

1. Navigate to `/rooms/new`
2. Click `?` button
3. Verify tour has 13 steps for form fields
4. Complete or skip tour

Expected: Tour covers all form fields, doesn't navigate

- [ ] **Step 7: Manual smoke test - Edit room**

1. Navigate to `/rooms/:id` (edit any room)
2. Click `?` button
3. Verify tour has 13 steps (same as create)
4. Complete or skip tour

Expected: Tour works identically to create room

- [ ] **Step 8: Manual smoke test - Disabled button**

1. Navigate to `/guide`
2. Verify `?` button is grey/disabled
3. Try clicking - nothing should happen
4. Repeat for `/free-rooms`

Expected: Button disabled, no console errors

- [ ] **Step 9: Manual smoke test - Auto-start tour**

1. Clear localStorage to reset tour seen status
2. Reload dashboard
3. Verify auto-start tour still works (cross-page)

Expected: Auto-start tour unchanged

- [ ] **Step 10: Check browser console**

Verify no errors or warnings related to tour functionality

- [ ] **Step 11: Commit final verification**

```bash
git add -A
git commit -m "chore: verify route-scoped tour implementation complete"
```

---

## Task 8: Final review and documentation

**Files:**

- Create: `docs/features/route-scoped-tour.md` (optional)

- [ ] **Step 1: Verify all acceptance criteria met**

Review design spec acceptance criteria:

- [x] Dashboard empty: 6-step tour
- [x] Dashboard with room: 10-step tour
- [x] Create room: 13-step tour
- [x] Edit room: 13-step tour (reuses create)
- [x] Button disabled on `/guide`, `/free-rooms`
- [x] No cross-page navigation in replay tours
- [x] No console errors
- [x] Auto-start tour still works
- [x] All tests pass
- [x] TypeScript compiles
- [x] ESLint passes

- [ ] **Step 2: Create summary commit**

```bash
git log --oneline --since="1 hour ago"
```

Review commit history to ensure clean story.

- [ ] **Step 3: Optional: Write feature documentation**

If requested, create `docs/features/route-scoped-tour.md`:

```markdown
# Route-Scoped Tour Guide

## Overview

The tour guide (`?` button) now shows route-specific steps instead of navigating across pages.

## Routes with Tours

- `/` - Dashboard (6 or 10 steps depending on room count)
- `/rooms/new` - Create room form (13 steps)
- `/rooms/:id` - Edit room form (13 steps, same as create)

## Routes without Tours

Button is disabled (grey, 50% opacity) on:

- `/guide`
- `/free-rooms`
- `/free-rooms/new`

## Implementation

- Route detection: `useLocation().pathname`
- Room state: `useRoomStore().rooms.length > 0`
- Resolver: `getTourStepsForRoute(pathname, hasRooms)`
- Dynamic tours: `updateToursForRoute()` before `startNextStep()`

## Testing

Run: `bun test packages/dashboard/src/lib/tour-steps.test.ts`
Run: `bun test packages/dashboard/src/components/organisms/tour-float-button.test.tsx`
```

- [ ] **Step 4: Final commit**

```bash
git add docs/features/route-scoped-tour.md
git commit -m "docs: add route-scoped tour feature documentation"
```

---

## Implementation Complete

**Total commits expected:** 8

**Files modified:**

- `packages/dashboard/src/lib/tour-steps.ts`
- `packages/dashboard/src/components/organisms/tour-float-button.tsx`
- `packages/dashboard/src/layouts/app-layout.test.tsx`

**Files created:**

- `packages/dashboard/src/lib/tour-steps.test.ts`
- `packages/dashboard/src/components/organisms/tour-float-button.test.tsx`
- `docs/features/route-scoped-tour.md` (optional)

**Test coverage:**

- 11 unit tests (tour-steps.test.ts)
- 4 component tests (tour-float-button.test.tsx)
- 1 integration test (app-layout.test.tsx)
- Total: 16 automated tests

**Verification commands:**

```bash
bun test packages/dashboard/
bun run typecheck
bun run lint
```

All acceptance criteria from design spec met. Ready for code review.
