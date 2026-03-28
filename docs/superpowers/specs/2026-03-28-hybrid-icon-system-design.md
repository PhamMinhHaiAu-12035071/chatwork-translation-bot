# Hybrid Icon System — Neubrutalism 3D Claymorphism

**Version:** 1.0
**Date:** 2026-03-28
**Prepared by:** AI-assisted (Claude Sonnet 4.6)
**Status:** Approved — ready for implementation planning
**Preview pack:** `.superpowers/brainstorm/icon-system-preview-pack-2026-03-28/`

---

## Objective

Upgrade tất cả icons trong `packages/dashboard` từ thin stroke basic SVGs và text symbols lên một **Hybrid Icon System** phù hợp với phong cách Neubrutalism 3D Claymorphism hiện có. Build `<Icon>` component library tái sử dụng được.

## Scope

**In scope:**

- Tất cả 12 icon locations hiện có trong dashboard (xem inventory bên dưới)
- Thêm icons vào các buttons đang text-only (`+ New Room`, `Edit`, `Delete`, `Webhook Guide`)
- Xây dựng `<Icon name="..." variant="..." size={n} />` component thống nhất
- CSS micro-animation per icon (bounce + shine, directional slide, wiggle, glow)
- `prefers-reduced-motion` support

**Out of scope:**

- Icon library cho packages khác ngoài `@chatwork-bot/dashboard`
- Icon font hoặc Iconify/Lucide integration (dùng inline SVG)
- Dark mode variants (dashboard chưa có dark mode)
- Animated SVG path morphing

---

## Non-Goals

- Không replace animation system (Framer Motion) đang dùng trong card/spotlight
- Không thay đổi button shapes, colors, hay border styles
- Không thêm icon cho skeleton loaders hoặc empty states

---

## Constraints

- Stack hiện tại: Bun + TypeScript 5.4 strict + React + Tailwind (via Vite)
- Fonts: Shantell Sans (heading), Fredoka (metric), Zen Maru Gothic (body) — import Google Fonts
- Color palette locked: dùng CSS vars đã có (`--border`, `--accent`, `--card-*`, etc.)
- ESLint `no-restricted-imports`: dùng `~/path` alias, không dùng `../`
- Bun test + typecheck + lint phải pass

---

## Icon Inventory — Toàn bộ locations

| #   | Location                            | File                      | Icon            | Variant | Notes                         |
| --- | ----------------------------------- | ------------------------- | --------------- | ------- | ----------------------------- |
| 1   | Room List — "New Room" button       | `room-list.tsx`           | `plus`          | Clay    | Replaces text `"+"`           |
| 2   | Room List — "Webhook Guide" button  | `room-list.tsx`           | `book`          | Clay    | Add icon (text only hiện tại) |
| 3   | Room Card — "Edit" button           | `room-list.tsx`           | `pencil`        | Clay    | Add icon (text only hiện tại) |
| 4   | Room Card — "Delete" button         | `room-list.tsx`           | `trash`         | Clay    | Add icon (text only hiện tại) |
| 5   | Room Detail — "Back to Dashboard"   | `room-detail.tsx:142`     | `arrow-left`    | Stroke  | Replace thin stroke           |
| 6   | Room Detail — "Back" (edit form)    | `room-detail.tsx:310`     | `arrow-left`    | Stroke  | Replace thin stroke           |
| 7   | Room Detail — "View Webhook Guide"  | `room-detail.tsx:400`     | `external-link` | Stroke  | Replace thin stroke           |
| 8   | Room Detail — Webhook URL field     | `room-detail.tsx:354`     | `link`          | Clay    | Replace thin stroke chain     |
| 9   | Room Create — "Open Webhook Guide"  | `room-create.tsx:208`     | `external-link` | Stroke  | Replace thin stroke           |
| 10  | Webhook Stepper — "Previous" button | `webhook-stepper.tsx:216` | `arrow-left`    | Stroke  | Replace thin stroke           |
| 11  | Webhook Stepper — "Next" button     | `webhook-stepper.tsx:256` | `arrow-right`   | Stroke  | Replace thin stroke           |
| 12  | Webhook Stepper — action link       | `webhook-stepper.tsx:168` | `arrow-right`   | Stroke  | Replace thin stroke           |
| 13  | Toast — dismiss button              | `brutal-toast.tsx:54`     | `close`         | Stroke  | Replace thin stroke           |
| 14  | Select — dropdown chevron           | `brutal-select.tsx:22`    | `chevron-down`  | Stroke  | Replace thin stroke           |

**Total: 14 locations, 2 new icons added (+ New Room, Webhook Guide buttons)**

---

## Design Decision: Approach C — Hybrid Icon System

Sử dụng **hai variants riêng biệt** trong cùng một `<Icon>` component:

### Variant 1: `stroke` — Navigation & Inline Icons

**Dùng khi:** Icon xuất hiện inside text flow, navigation buttons, inline controls.

**Design spec:**

- `strokeWidth: 3.5px` (tăng từ 2.2–2.5px hiện tại)
- `strokeLinecap="round"`, `strokeLinejoin="round"`
- Hard 3D shadow: duplicate path offset `(1.3px, 1.3px)`, `fill="#1a1a2e"` stroke, `opacity="0.22"`
- `color="currentColor"` — inherits từ button text color
- ViewBox: `0 0 20 20` (arrows), `0 0 18 18` (close), `0 0 18 12` (chevron)

**Hover animation:** CSS `@keyframes stroke-lift` — translate(-1.5px, -1.5px) tại 40%, về 0 tại 100%. Duration: 280ms ease.

**Directional arrows:** Slide theo direction — `arrow-right` slide phải (6px), `arrow-left` slide trái (-6px), fade out/in. Duration: 400ms.

**Close (×):** `@keyframes wiggle` — rotate 12deg → -10deg → 7deg → -4deg. Duration: 450ms ease.

### Variant 2: `clay` — Action Icons (Recommended — đã chọn)

**Dùng khi:** Icon xuất hiện trong action buttons (`+`, Edit, Delete, Guide) hoặc standalone (webhook URL field).

**Design spec — mỗi clay icon có 4 layers:**

1. **Shadow rect** — `rect` offset `(+2px, +2px)`, fill `#1a1a2e`, `opacity="0.20"`, `rx="13"`
2. **Main body** — `rect` fill `linearGradient` (pastel top-left → slightly saturated bottom-right), `stroke="#1a1a2e"` `strokeWidth="2.5"`, `rx="13"`
3. **Inner shine** — `ellipse` fill white, `opacity="0.42"`, rotated -18deg at top-left corner
4. **Icon symbol** — centered path/shape, `stroke="#1a1a2e"` thick (2–5.5px depending on icon)

**ViewBox:** `0 0 44 44` (canonical), display size via `width`/`height` prop.

**Default sizes per context:**

- Inside button: `20px` (small, tách biệt với text)
- Standalone (link field): `22px`
- Icon cell / showcase: `48px`

**Clay bounce + shine on hover:**

```
@keyframes clay-bounce {
  0%   → scale(1)
  20%  → scale(1.22) rotate(-5deg)
  45%  → scale(0.9) rotate(3deg)
  65%  → scale(1.1) rotate(-2deg)
  100% → scale(1)
}
@keyframes shine-sweep {
  0%   → translateX(-130%) skewX(-15deg), opacity: 0
  15%  → opacity: 1
  100% → translateX(230%) skewX(-15deg), opacity: 0
}
```

Duration: `clay-bounce` 500ms cubic-bezier(0.36,0.07,0.19,0.97); `shine-sweep` 600ms ease.

**`prefers-reduced-motion`:** All animations → `animation: none`.

### Color Mapping — Clay Icons

| Icon name       | Color (light → dark)                | Dashboard palette match                  |
| --------------- | ----------------------------------- | ---------------------------------------- |
| `plus`          | `#ede8ff → #bfb3f7` (lilac/violet)  | `theme-button-violet`                    |
| `pencil`        | `#d5f0ff → #7dc8ec` (sky blue)      | `room-card-action-btn--edit` (#87d2ff)   |
| `trash`         | `#ffe0f0 → #f4a0c8` (pink coral)    | `room-card-action-btn--delete` (#ff6f9f) |
| `book`          | `#fde7c0 → #f4a060` (warm amber)    | `theme-button-warm`                      |
| `link`          | `#e9fad8 → #7abf64` (matcha green)  | `--matcha-accent`                        |
| `external-link` | Transparent bg                      | Stroke-only, no clay                     |
| `webhook`       | `#d5e8ff → #6eaaec` (sky accent)    | `--sky-accent`                           |
| `pause`         | `#fef9d0 → #f9d44a` (butter yellow) | `--warning`                              |
| `play`          | `#c8f5e0 → #4dd8a0` (mint green)    | `--success`                              |

> **Note:** `external-link` dùng `stroke` variant (không có clay background) vì xuất hiện inline trong flow buttons. Nếu cần standalone thì dùng `link` clay icon.

---

## Component Architecture

### File structure

```
packages/dashboard/src/components/atoms/icons/
  index.ts                  ← barrel export
  icon.tsx                  ← <Icon> unified component
  stroke-icon.tsx           ← variant="stroke" renderer
  clay-icon.tsx             ← variant="clay" renderer
  icon-paths.ts             ← SVG path data per name
  clay-colors.ts            ← gradient color map per name
  icon.css                  ← @keyframes animations
```

### Component API

```tsx
// Unified entry point
<Icon name="plus"      variant="clay"   size={20} />
<Icon name="arrow-left" variant="stroke" size={16} />

// Types
type IconName =
  | 'plus' | 'pencil' | 'trash' | 'book' | 'link'
  | 'webhook' | 'pause' | 'play'        // clay only
  | 'arrow-left' | 'arrow-right'
  | 'chevron-down' | 'close'
  | 'external-link'                      // stroke only

type IconVariant = 'stroke' | 'clay'

interface IconProps {
  name: IconName
  variant: IconVariant
  size?: number    // default: 20
  className?: string
  'aria-hidden'?: boolean
  'aria-label'?: string
}
```

### Animation wrapper

`ClayIcon` renders với `.clay-icon-wrap` wrapper (relative + overflow:hidden):

- `::after` pseudo-element = shine streak (white gradient skew)
- `:hover svg` triggers `clay-bounce`
- `:hover::after` triggers `shine-sweep`

`StrokeIcon` renders với `.stroke-icon-wrap`:

- `:hover svg` triggers animation specific to icon name (`stroke-lift`, `slide-right`, `slide-left`, `wiggle`)
- Nhận `data-direction="left|right"` attribute để distinguish slide animations

---

## Usage Examples — Post-implementation

```tsx
// room-list.tsx — New Room button
<button className="brutal-button theme-button-violet ...">
  <Icon name="plus" variant="clay" size={20} aria-hidden />
  New Room
</button>

// room-list.tsx — Edit/Delete room card buttons
<button className="room-card-action-btn room-card-action-btn--edit">
  <Icon name="pencil" variant="clay" size={16} aria-hidden />
  Edit
</button>
<button className="room-card-action-btn room-card-action-btn--delete">
  <Icon name="trash" variant="clay" size={16} aria-hidden />
  Delete
</button>

// room-detail.tsx — Back button
<button className="brutal-button theme-button-violet ...">
  <Icon name="arrow-left" variant="stroke" size={16} aria-hidden />
  Back to Dashboard
</button>

// brutal-select.tsx — Dropdown chevron
<Icon name="chevron-down" variant="stroke" size={14} aria-hidden />

// brutal-toast.tsx — Dismiss button
<button aria-label="Dismiss">
  <Icon name="close" variant="stroke" size={14} />
</button>
```

---

## Acceptance Criteria

- [ ] `<Icon>` component exported từ `~/components/atoms/icons`
- [ ] Tất cả 14 icon locations đã được upgrade (xem inventory table)
- [ ] Clay icons render đúng 4 layers (shadow, body, shine, symbol)
- [ ] Stroke icons render đúng với shadow path offset
- [ ] Hover animations hoạt động đúng per icon type
- [ ] `prefers-reduced-motion: reduce` → tất cả animations disabled
- [ ] `aria-hidden="true"` mặc định trên decorative icons; `aria-label` available
- [ ] TypeScript strict — `IconName` là typed union, không dùng `string`
- [ ] `bun test && bun run typecheck && bun run lint` pass
- [ ] Không có `../` imports (dùng `~/` alias)

---

## Happy Path

1. User mở Room List page → thấy "+ New Room" button với clay plus icon tím (lilac), "Webhook Guide" với clay book icon cam
2. Hover "New Room" → icon bounce + shine sweep, button lift up (existing behavior)
3. Room card hiển thị "Edit" với clay pencil icon xanh, "Delete" với clay trash icon hồng
4. Hover "Edit" → pencil icon bounces, hover "Delete" → trash bounces
5. Click "Edit" → Room Detail page với stroke arrow ← back button
6. Hover "Back" → arrow slides left briefly
7. Webhook URL field hiển thị clay link icon matcha green
8. Dropdown select hiển thị bold chevron với 3D shadow
9. Toast dismiss hiển thị bold × close icon, hover → wiggle
10. Webhook stepper "Next"/"Prev" dùng stroke arrow-right/left với slide animation

## Edge Cases

- **Icon trong disabled button:** CSS `.brutal-btn:disabled .clay-icon-wrap { animation: none; opacity: 0.6; }` — inherit disabled opacity
- **Very small sizes (≤12px):** Shadow path opacity giảm còn 0.12 để tránh visual noise
- **Icon ngoài button context (standalone):** Clay icon wrapper có `display: inline-flex`, không tự thêm click target
- **SSR/hydration:** SVGs inline không cần hydration — safe

## Failure Cases

- **LinearGradient ID collision:** Mỗi instance cần unique gradient ID — dùng `React.useId()` hoặc prefix bằng icon name + random suffix
- **Animation FOUC:** `icon.css` phải được import trước khi component render — import trong `icon.tsx`
- **TypeScript strict "excess props":** `IconProps` phải forward `className` và `aria-*` props đúng cách

---

## Technical Approach

1. **icon-paths.ts** — object map `{ [name: IconName]: { d: string | string[], viewBox: string, strokeWidth?: number } }`
2. **clay-colors.ts** — object map `{ [name: IconName]: { from: string, to: string } }`
3. **stroke-icon.tsx** — renders viewBox + shadow path + main path, `data-direction` attribute drives animation class
4. **clay-icon.tsx** — renders 4 layers, wraps in `.clay-icon-wrap` div, unique gradient ID via `useId()`
5. **icon.tsx** — discriminated union dispatch to stroke vs clay renderer
6. **icon.css** — tất cả `@keyframes` + `.clay-icon-wrap`, `.stroke-icon-wrap` classes; import `@media (prefers-reduced-motion)` reset
7. Update 14 call sites theo inventory table

---

## Testing

- Unit test: `icon.test.tsx` — render `<Icon>` với mỗi `name` + `variant`, snapshot test
- Accessibility: `aria-hidden` propagation, `aria-label` khi cần
- Visual regression: không có tool hiện tại — rely on HTML preview pack + manual review
- Reduced motion: test với `@media (prefers-reduced-motion: reduce)` emulation

---

## Rollout / Ops

- Single PR — tất cả icon locations trong một PR (không breaking change, purely additive cho visual)
- Không có migration concern — pure frontend, không ảnh hưởng API hay state
- `bun test && bun run typecheck && bun run lint` là definition of done

---

## Risks & Trade-offs

| Risk                                                           | Mitigation                                                        |
| -------------------------------------------------------------- | ----------------------------------------------------------------- |
| LinearGradient ID collision nếu render nhiều icon cùng type    | Dùng `React.useId()` cho gradient ID                              |
| Bundle size tăng nhẹ (inline SVG thay vì icon font)            | Acceptable — SVG inline tốt hơn cho accessibility và no-network   |
| Clay variant quá "loud" trên một số card backgrounds           | Giảm shadow opacity xuống 0.15 nếu cần — configurable qua CSS var |
| Overflow:hidden trên clay-icon-wrap clip shine ở icon size nhỏ | Min size cho shine effect là 16px; dưới đó disable shine          |

---

## Out of Scope

- Icon support cho packages ngoài dashboard
- Icon trong loading skeleton states
- Custom icon colors (màu auto-assigned per name)
- SVG sprite sheet optimization

## Future Scope / Deferred Features

_(Đã confirm là ngoài scope hiện tại — chưa estimate, chưa commit)_

- `size="xs|sm|md|lg|xl"` semantic size tokens thay vì pixel numbers
- Icon cho empty states (tạo first room, no results)
- Icon animation cho `RoomStatusToggle` (play/pause icons animate khi toggle)
- Storybook/Chromatic visual regression cho icon library
