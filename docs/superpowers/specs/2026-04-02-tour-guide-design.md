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

- Grand Tour duy nhất bao gồm 14 bước, cover toàn bộ core workflow: Standard Rooms (create, edit, delete, enable/disable), bao gồm cả 2 optional fields phức tạp: Translation Context và Keyword Protection
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
- [ ] Steps 9–10 giải thích đúng Translation Context (toggle + quick templates)
- [ ] Steps 11–12 giải thích đúng Keyword Protection (toggle + add form với keyword/category/placeholder)
- [ ] Stats section tách thành 3 steps riêng: Total / Active / Inactive
- [ ] Edge case 0 rooms: steps 14–17 dùng `selector: null`, hiển thị giữa màn hình
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

| Step | Màu                                    | Hex       |
| ---- | -------------------------------------- | --------- |
| 1    | Vàng — Welcome                         | `#ffd166` |
| 2    | Tím — Total Rooms                      | `#c9b1ff` |
| 3    | Mint — Active                          | `#86e8c0` |
| 4    | Peach — Inactive                       | `#fed7aa` |
| 5    | Sky blue — New Room button             | `#90cdf4` |
| 6    | Peach light — Room ID                  | `#ffc8a0` |
| 7    | Blush — Provider                       | `#ffb3c1` |
| 8    | Lime — Style                           | `#bef264` |
| 9    | Matcha — Translation Context 🧠 toggle | `#a8d8a8` |
| 10   | Mint soft — Quick Templates ⚡         | `#d1fae5` |
| 11   | Amber — Keyword Protection 🛡️ toggle   | `#fcd34d` |
| 12   | Butter — Keyword Add Form              | `#fef3c7` |
| 13   | Orange — Save                          | `#fb923c` |
| 14   | Yellow — Room card                     | `#fde68a` |
| 15   | Cyan — Toggle                          | `#a5f3fc` |
| 16   | Teal — Edit                            | `#99f6e4` |
| 17   | Rose — Delete                          | `#f9a8d4` |
| 18   | Coral — Completion                     | `#ff6b6b` |

**Step 18 (Completion):** coral solid, title/body text trắng (`#fff`).

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
  /* 18 steps */
]
```

---

## Tour Step Sequence (18 bước)

| #   | Route        | Selector                  | Nội dung tiếng Việt                                                                                                                                                                                                                      | Navigate to  |
| --- | ------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1   | `/`          | `null`                    | 👋 **Chào mừng!** Dashboard này giúp bạn quản lý các phòng dịch thuật Chatwork. Tour ~2 phút, giới thiệu toàn bộ từ đầu đến cuối.                                                                                                        | —            |
| 2   | `/`          | `#tour-stat-total`        | 📦 **Total Rooms** — tổng số phòng dịch đang được cấu hình trong hệ thống, bao gồm cả phòng đang hoạt động lẫn tạm dừng.                                                                                                                 | —            |
| 3   | `/`          | `#tour-stat-active`       | ✅ **Active** — số phòng đang **LIVE**, đang lắng nghe và dịch webhook Chatwork theo thời gian thực.                                                                                                                                     | —            |
| 4   | `/`          | `#tour-stat-inactive`     | ⏸️ **Inactive** — số phòng đang **tạm dừng**. Bot không dịch cho phòng này cho đến khi bạn bật lại bằng nút Toggle.                                                                                                                      | —            |
| 5   | `/`          | `#tour-new-room`          | ➕ **Tạo phòng mới** — nhấn nút này để thiết lập một phòng dịch. Chúng ta sẽ cùng điền form ngay bây giờ!                                                                                                                                | `/rooms/new` |
| 6   | `/rooms/new` | `#tour-field-roomid`      | 🔢 **Room ID** — số định danh phòng Chatwork nguồn. Lấy trong URL: `chatwork.com/#!rid**123456**` — số sau `rid` chính là Room ID.                                                                                                       | —            |
| 7   | `/rooms/new` | `#tour-field-provider`    | 🤖 **AI Provider & Model** — chọn dịch vụ AI (OpenAI / Gemini) và model cụ thể. Model khác nhau = chất lượng dịch và chi phí khác nhau.                                                                                                  | —            |
| 8   | `/rooms/new` | `#tour-field-style`       | 🎨 **Translation Style** — chọn phong cách dịch: `Casual` (thân thiện), `Business` (lịch sự), `Technical` (kỹ thuật). Mỗi phòng có thể dùng style khác nhau.                                                                             | —            |
| 9   | `/rooms/new` | `#tour-field-context`     | 🧠 **Translation Context** _(optional)_ — nhấn để mở. Mô tả mục đích phòng để AI hiểu ngữ cảnh, dịch chính xác hơn. Ví dụ: _"Đây là phòng báo cáo kỹ thuật nội bộ."_                                                                     | —            |
| 10  | `/rooms/new` | `#tour-context-templates` | ⚡ **Quick Templates** — 5 mẫu context sẵn: `Client Briefing`, `Internal Team`, `Technical`, `Cross-team`, `Executive`. Chọn 1 cái là tự điền vào textarea bên trái. Hoặc tự viết tùy ý. Tối đa 500 ký tự.                               | —            |
| 11  | `/rooms/new` | `#tour-field-keywords`    | 🛡️ **Keyword Protection** _(optional)_ — nhấn để mở. Liệt kê từ nhạy cảm không muốn AI dịch: tên công ty, tên người, mã dự án. AI sẽ tạm thay bằng mã `[COMPANY_1]` rồi điền lại tên thật vào kết quả cuối.                              | —            |
| 12  | `/rooms/new` | `#tour-keyword-addform`   | ➕ **Thêm keyword**: (1) nhập **Keyword Term** — từ gốc (vd: _Asia Vion_), (2) chọn **Category** — Company / Person / Project / Code / Other, (3) **Custom Placeholder** tùy chọn — nếu để trống AI tự dùng `[COMPANY_1]`. Nhấn **Add**. | —            |
| 13  | `/rooms/new` | `#tour-save-btn`          | 💾 **Lưu phòng** — nhấn **Create Room** là bot bắt đầu lắng nghe webhook ngay. Bạn sẽ được chuyển về Dashboard và thấy phòng mới xuất hiện.                                                                                              | `/`          |
| 14  | `/`          | `#tour-room-card-first`\* | 🃏 **Room Card** — mỗi card là 1 phòng dịch. Hiển thị tên, Room ID, AI Provider, Translation Style, và trạng thái Live / Paused.                                                                                                         | —            |
| 15  | `/`          | `#tour-status-toggle`\*   | 🔀 **Toggle** — bật/tắt lắng nghe webhook tức thì. Tắt = bot dừng dịch phòng này. Bật lại = tiếp tục ngay không mất cấu hình.                                                                                                            | —            |
| 16  | `/`          | `#tour-edit-btn`\*        | ✏️ **Edit** — chỉnh sửa mọi cài đặt phòng: Provider, Style, Context, Keywords. Mở form giống trang tạo phòng.                                                                                                                            | —            |
| 17  | `/`          | `#tour-delete-btn`\*      | 🗑️ **Delete** — xóa phòng khỏi hệ thống. Sẽ có confirm dialog trước khi xóa để tránh nhỡ tay.                                                                                                                                            | —            |
| 18  | `/`          | `null`                    | 🎉 **Xong rồi!** Bạn đã biết đủ để tự quản lý dashboard. Nhấn nút **?** bất cứ lúc nào để xem lại tour này.                                                                                                                              | —            |

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
│   └── tour-steps.ts                 ← 18 step configs + TOUR_VERSION constant
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

| File                           | Element                                            | Attribute                                       |
| ------------------------------ | -------------------------------------------------- | ----------------------------------------------- |
| `room-list.tsx`                | Total Rooms `BrutalCard` wrapper `<div>`           | `id="tour-stat-total"`                          |
| `room-list.tsx`                | Active `BrutalCard` wrapper `<div>`                | `id="tour-stat-active"`                         |
| `room-list.tsx`                | Inactive `BrutalCard` wrapper `<div>`              | `id="tour-stat-inactive"`                       |
| `room-list.tsx`                | "New Room" button                                  | `id="tour-new-room"`                            |
| `room-list.tsx`                | First room card outer wrapper                      | `id="tour-room-card-first"` (chỉ card đầu tiên) |
| `room-list.tsx`                | `RoomStatusToggle` trong card đầu                  | `id="tour-status-toggle"`                       |
| `room-list.tsx`                | Edit button trong card đầu                         | `id="tour-edit-btn"`                            |
| `room-list.tsx`                | Delete button trong card đầu                       | `id="tour-delete-btn"`                          |
| `room-create.tsx`              | Room ID input wrapper `<div>`                      | `id="tour-field-roomid"`                        |
| `room-create.tsx`              | Provider select wrapper `<div>`                    | `id="tour-field-provider"`                      |
| `room-create.tsx`              | Style select wrapper `<div>`                       | `id="tour-field-style"`                         |
| `room-create.tsx`              | `<ContextField>` outer wrapper `<div>`             | `id="tour-field-context"`                       |
| `room-create.tsx`              | `<KeywordProtectionField>` outer wrapper `<div>`   | `id="tour-field-keywords"`                      |
| `room-create.tsx`              | Save/Submit button                                 | `id="tour-save-btn"`                            |
| `context-field.tsx`            | `<div className="context-template-list-wrap">` div | `id="tour-context-templates"`                   |
| `keyword-protection-field.tsx` | Add form `<div>` (border + #fffbeb background)     | `id="tour-keyword-addform"`                     |

> **Lưu ý stats IDs**: Stats cards render qua `.map()`. Thêm `tourId` field vào mỗi stat object, dùng `<div id={stat.tourId}>` wrap bên ngoài mỗi `BrutalCard`.

> **Lưu ý context-field.tsx**: `#tour-context-templates` chỉ visible khi accordion mở. Trong showcase tour, step 10 sẽ dùng `selector: null` nếu element không visible — NextStep.js fallback tự động về center screen.

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
| `rooms.length === 0` khi đến steps 14–17        | `selector: null` → tooltip center screen                                  |
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
- Unit test: `tour-steps.ts` — validate 18 steps có đúng fields bắt buộc
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
