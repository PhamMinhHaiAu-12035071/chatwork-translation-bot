# Tour Guide Feature — Design Spec

**Version:** 1.0  
**Date:** 2026-04-02  
**Prepared by:** AI-assisted (Claude Sonnet 4.6)  
**Status:** Approved — ready for implementation

---

## Objective

Triển khai tính năng **tour guide tương tác** cho `packages/dashboard`, giúp người dùng mới có thể tự thao tác dashboard (create / edit / delete / enable-disable room) mà không cần hỗ trợ từ người khác. Tour hoạt động như một "cookbook" từng bước, rõ ràng và thân thiện.

---

## Scope

**In scope:**

- Grand Tour duy nhất bao gồm 12 bước, cover toàn bộ core workflow: Standard Rooms (create, edit, delete, enable/disable)
- Cross-page navigation: tour tự di chuyển giữa `/` và `/rooms/new`
- Auto-trigger lần đầu vào dashboard (first-visit detection)
- Floating "?" button để replay bất cứ lúc nào
- Custom `NeubTourCard` component theo phong cách Neubrutalism 3D
- Persist trạng thái tour qua `ui-store` (Zustand persist + localStorage)

**Out of scope:**

- Free Rooms tour (defer sang tour v2)
- Interactive/guided execution (tour không yêu cầu user thực hiện action thật)
- Server-side tour state
- Multi-language (chỉ tiếng Việt)

---

## Definition of Done

- [ ] Tour tự khởi động khi user lần đầu vào dashboard (sau 800ms delay)
- [ ] Tour navigate đúng route tại từng bước cần cross-page
- [ ] Floating "?" button hiện ở mọi trang, trigger tour bất kể `tourSeenVersion`
- [ ] Hoàn thành hoặc skip tour đều set `tourSeenVersion = TOUR_VERSION`
- [ ] Mở Chrome session mới → không hiện tour lại (localStorage persists)
- [ ] Incognito / clear data → tour hiện lại (expected behavior)
- [ ] Edge case 0 rooms: steps 8–11 dùng `selector: null`, hiển thị giữa màn hình
- [ ] `bun test && bun run typecheck && bun run lint` pass

---

## Constraints

- Stack: Vite + React 19 + TypeScript 5.4 strict + Tailwind v4 + Framer Motion v12 + Zustand v5 + React Router v7
- Thư viện tour: **`nextstepjs`** (+ `motion` alias — đã có `framer-motion`)
- Không thêm font mới vào index.html: dùng `Shantell Sans` (đã load) cho heading tour card
- Thêm `Be Vietnam Pro` vào `index.html` cho body text trong tour card (Vietnamese diacritics)
- Không đụng global dashboard fonts (`Zen Maru Gothic`, `Fredoka`)
- Tour chỉ thêm `id` / `data-tour` attribute vào các element cần target — không refactor logic hiện tại

---

## UX / UI

### Tour Card — `NeubTourCard`

**Typography:**

- Heading/title: `Shantell Sans` 800, color `#1a1a2e`
- Body: `Be Vietnam Pro` 400/500, color `#2a2a3e`
- Buttons: `Shantell Sans` 800

**Style:**

- `border: 3px solid #1a1a2e`
- `border-radius: 18px`
- `box-shadow: 5px 5px 0 #1a1a2e` (Neubrutalism 3D hard shadow)
- Width: `300px`
- Arrow pointer: triangle CSS, hướng thay đổi theo vị trí element target

**Per-step solid colors (không gradient):**

| Step | Màu                | Hex       |
| ---- | ------------------ | --------- |
| 1    | Vàng — Welcome     | `#ffd166` |
| 2    | Tím — Stats        | `#c9b1ff` |
| 3    | Mint — New Room    | `#86e8c0` |
| 4    | Sky blue — Room ID | `#90cdf4` |
| 5    | Peach — Provider   | `#ffc8a0` |
| 6    | Blush — Style      | `#ffb3c1` |
| 7    | Lime — Save        | `#bef264` |
| 8    | Butter — Room card | `#fde68a` |
| 9    | Orange — Toggle    | `#fb923c` |
| 10   | Cyan — Edit        | `#a5f3fc` |
| 11   | Rose — Delete      | `#f9a8d4` |
| 12   | Coral — Completion | `#ff6b6b` |

**Step 12 (Completion):** coral solid, title/body text trắng (`#fff`).

### Spotlight Effect

Element được highlight:

```css
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

### Floating "?" Button — `TourFloatButton`

- Position: `fixed bottom-5 right-5 z-50`
- Size: `52×52px`, `border-radius: 50%`
- Background: `#6e77e5` (accent violet)
- Border: `3px solid #1a1a2e`, shadow: `4px 4px 0 #1a1a2e`
- Font: `Shantell Sans` 800, text: `?`
- Hover: `rotate(-5deg) translate(-2px, -2px)`
- Badge notification: hiện khi `tourSeenVersion === null` (chưa xem lần nào)

---

## Data Model

### `ui-store.ts` additions

```ts
interface UiStoreState {
  // existing
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void

  // new
  tourSeenVersion: number | null
  setTourSeen: (version: number) => void
  resetTour: () => void
}

// actions
setTourSeen: (version) => set({ tourSeenVersion: version })
resetTour: () => set({ tourSeenVersion: null })
```

Persisted tự động qua middleware `persist` hiện có (key: `chatwork-bot-ui-store`).

### `lib/tour-steps.ts`

```ts
export const TOUR_VERSION = 1

export interface TourStep {
  selector: string | null // null = center screen (welcome, completion, 0-rooms fallback)
  title: string
  content: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  nextRoute?: string // NextStep.js navigates trước khi show step
  color: string // per-step background color
}

export const tourSteps: TourStep[] = [
  /* 12 steps */
]
```

---

## Tour Step Sequence (12 bước)

| #   | Route        | Selector                  | Nội dung tiếng Việt                               | Navigate to  |
| --- | ------------ | ------------------------- | ------------------------------------------------- | ------------ |
| 1   | `/`          | `null`                    | 👋 Welcome — giới thiệu dashboard, ~2 phút        | —            |
| 2   | `/`          | `#tour-stats`             | 📊 3 ô thống kê Total / Active / Inactive         | —            |
| 3   | `/`          | `#tour-new-room`          | ➕ Đây là nút tạo phòng mới                       | `/rooms/new` |
| 4   | `/rooms/new` | `#tour-field-roomid`      | 🔢 Room ID là số trong URL Chatwork               | —            |
| 5   | `/rooms/new` | `#tour-field-provider`    | 🤖 Chọn AI provider dịch thuật                    | —            |
| 6   | `/rooms/new` | `#tour-field-style`       | 🎨 Phong cách dịch: Casual / Business / Technical | —            |
| 7   | `/rooms/new` | `#tour-save-btn`          | 💾 Nhấn Save để tạo phòng                         | `/`          |
| 8   | `/`          | `#tour-room-card-first`\* | 🃏 Mỗi card là 1 phòng dịch thuật                 | —            |
| 9   | `/`          | `#tour-status-toggle`\*   | 🔀 Toggle bật/tắt lắng nghe webhook               | —            |
| 10  | `/`          | `#tour-edit-btn`\*        | ✏️ Edit để chỉnh sửa cài đặt phòng                | —            |
| 11  | `/`          | `#tour-delete-btn`\*      | 🗑️ Delete xóa phòng khỏi hệ thống                 | —            |
| 12  | `/`          | `null`                    | 🎉 Hoàn thành — bạn đã sẵn sàng!                  | —            |

> \* = `selector: null` nếu `rooms.length === 0` (hiển thị giữa màn hình, giải thích abstractly)

---

## Auto-trigger Logic

```tsx
// Trong AppLayout (mount 1 lần duy nhất, bao toàn bộ app)
const { tourSeenVersion } = useUiStore()
const { startNextStep } = useNextStep()

useEffect(() => {
  if (tourSeenVersion === null) {
    const id = window.setTimeout(() => startNextStep(), 800)
    return () => window.clearTimeout(id)
  }
}, []) // chỉ chạy 1 lần khi mount
```

Đặt trong `AppLayout` (không phải `RoomListPage`) vì `AppLayout` mount 1 lần duy nhất và bao toàn bộ router — đảm bảo trigger chính xác 1 lần bất kể user vào từ route nào. Delay 800ms để tránh trigger trước khi layout render xong.

---

## Component File Structure

```
packages/dashboard/src/
├── components/
│   └── organisms/
│       ├── neub-tour-card.tsx        ← custom card component cho NextStep.js
│       └── tour-float-button.tsx     ← floating "?" button
├── lib/
│   └── tour-steps.ts                 ← 12 step configs + TOUR_VERSION constant
└── stores/
    └── ui-store.ts                   ← thêm tourSeenVersion, setTourSeen, resetTour
```

**`main.tsx` integration:**

```tsx
<NextStepProvider steps={tourSteps} cardComponent={NeubTourCard}>
  <RouterProvider router={router} />
  <TourFloatButton />
</NextStepProvider>
```

---

## Selector Attributes cần thêm

| File              | Element                           | Attribute                                       |
| ----------------- | --------------------------------- | ----------------------------------------------- |
| `room-list.tsx`   | Stats wrapper div                 | `id="tour-stats"`                               |
| `room-list.tsx`   | "New Room" button                 | `id="tour-new-room"`                            |
| `room-list.tsx`   | First room card wrapper           | `id="tour-room-card-first"` (chỉ card đầu tiên) |
| `room-list.tsx`   | `RoomStatusToggle` trong card đầu | `id="tour-status-toggle"`                       |
| `room-list.tsx`   | Edit button trong card đầu        | `id="tour-edit-btn"`                            |
| `room-list.tsx`   | Delete button trong card đầu      | `id="tour-delete-btn"`                          |
| `room-create.tsx` | Room ID input                     | `id="tour-field-roomid"`                        |
| `room-create.tsx` | Provider select                   | `id="tour-field-provider"`                      |
| `room-create.tsx` | Style select                      | `id="tour-field-style"`                         |
| `room-create.tsx` | Save/Submit button                | `id="tour-save-btn"`                            |

---

## `index.html` changes

Thêm `Be Vietnam Pro` vào font link hiện có:

```html
<link
  href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;700&family=Fredoka:wght@500;600;700&family=Shantell+Sans:wght@400;500;700;800&family=Zen+Maru+Gothic:wght@400;500;700&display=swap"
  rel="stylesheet"
/>
```

---

## Error / Edge Cases

| Tình huống                                      | Xử lý                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------- |
| `rooms.length === 0` khi đến steps 8–11         | `selector: null` → tooltip center screen                                  |
| User đóng tab giữa chừng (step 5/12)            | Tour không resume — trigger lại từ đầu vì `tourSeenVersion` chưa được set |
| User click "Bỏ qua" (skip)                      | `setTourSeen(TOUR_VERSION)` — không hiện auto lại                         |
| User click "Hoàn thành"                         | `setTourSeen(TOUR_VERSION)`                                               |
| Clear localStorage / Incognito                  | `tourSeenVersion = null` → tour auto-trigger (expected)                   |
| Dev release tour mới                            | Tăng `TOUR_VERSION = 2` → user cũ thấy tour lại 1 lần                     |
| NextStep.js navigate fail (route không tồn tại) | NextStep.js fallback: show step tại route hiện tại                        |

---

## Dependencies

```bash
bun add nextstepjs
```

> `motion` **không cần install riêng** — `framer-motion` v12 đã export tất cả từ cùng package. NextStep.js docs ghi `npm install nextstepjs motion` nhưng `motion` là tên cũ; với `framer-motion ^12.6.3` đã có trong dependencies, không cần thêm gì.

---

## Testing

- Unit test: `neub-tour-card.tsx` — render đúng title/content/color theo props
- Unit test: `tour-float-button.tsx` — hiện badge khi `tourSeenVersion === null`
- Unit test: `ui-store` — `setTourSeen`, `resetTour` hoạt động đúng
- Unit test: `tour-steps.ts` — validate 12 steps có đúng fields bắt buộc
- Manual: chạy tour từ đầu đến cuối trên fresh localStorage
- Manual: replay tour qua floating "?" button
- Manual: edge case 0 rooms — steps 8–11 hiện giữa màn hình

---

## Risks & Trade-offs

| Risk                                                            | Mức độ | Mitigation                                                      |
| --------------------------------------------------------------- | ------ | --------------------------------------------------------------- |
| NextStep.js compatibility với React Router v7                   | Medium | Docs ghi hỗ trợ React Router — verify khi install               |
| `framer-motion` v12 vs `motion` package alias                   | Low    | Check NextStep.js peer deps, dùng alias nếu cần                 |
| Tour card bị che khuất bởi sidebar overlay                      | Low    | Điều chỉnh `z-index` của NextStep.js overlay                    |
| `id` attribute trên room card đầu tiên bị stale khi sort/filter | Low    | Assign `id` theo DOM position (`.rooms[0]`), không theo room.id |

---

## Future Scope / Deferred Features

> Các mục sau đã được xác nhận là **ngoài scope hiện tại**, chưa estimate, chưa commit:

- **Free Rooms tour** — tour v2 cover `/free-rooms` workflow
- **Interactive mode** — tour dẫn user thực sự thao tác (tạo room thật, etc.)
- **Mini per-task tours** — trigger tour riêng lẻ cho từng thao tác
- **Multi-language** — hỗ trợ tiếng Anh / tiếng Nhật ngoài tiếng Việt
- **Tour analytics** — track bao nhiêu user hoàn thành vs skip
