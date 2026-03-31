# SPEC: Neubrutalism Design System for Context Field

**Version:** 1.0  
**Date:** 2026-03-31  
**Prepared by:** AI-assisted (Claude Sonnet 4.5)  
**Status:** Ready for Implementation

## Objective

Convert Context Field component from gradient-heavy design to strict neubrutalism with flat colors, matching the design language established in Webhook Setup Guide (BrutalCard).

## Scope

**In Scope:**

- Template cards styling (5 templates)
- Textarea icon background
- Active state treatment (textarea + template cards)
- Candy progress bar color optimization
- Comet-burst effect styling

**Out of Scope:**

- Candy progress bar architecture (keep current 5-segment design)
- Component layout/structure
- Accessibility features (must maintain)
- Animation timing/motion design

## Non-Goals

- Redesigning the entire dashboard
- Changing component functionality
- Removing the candy progress bar feature

## Definition of Done

- ✅ All gradients removed from template cards
- ✅ Textarea icon uses flat color
- ✅ Active states use solid backgrounds + border colors (no glow)
- ✅ Candy bar colors are more vibrant (high contrast)
- ✅ Stripe patterns preserved in candy bar
- ✅ All tests passing
- ✅ Visual consistency with webhook guide BrutalCard

## Constraints

- **Design Priority:** Strict neubrutalism (user-confirmed)
- **Framework:** React + Tailwind CSS + Framer Motion
- **Browser Support:** Modern browsers (existing support maintained)
- **Accessibility:** WCAG 2.1 AA compliance maintained
- **No Breaking Changes:** API/props remain unchanged

## Design Decisions

### [DEC-001] Design Priority ✓

- **Decision:** Strict neubrutalism style
- **Status:** Accepted
- **Provenance:** User-stated
- **Risk:** Low
- **Notes:** User explicitly chose "brutal tuyệt đối" over balanced or UX-first approaches

### [DEC-002] Candy Progress Bar Treatment ✓

- **Decision:** Keep current design, optimize colors for vibrancy, maintain stripe pattern
- **Status:** Accepted
- **Provenance:** User-stated
- **Risk:** Low
- **Notes:** User confirmed current design is good, only needs more vibrant colors

### [DEC-003] Active State Treatment ✓

- **Decision:** Solid background + border color change, no glow effects
- **Status:** Accepted
- **Provenance:** User-stated
- **Risk:** Low
- **Notes:** Removes all radial gradients from active states

### [DEC-004] Template Cards Style ✓

- **Decision:** Match BrutalCard from webhook guide (flat, no gradient)
- **Status:** Accepted
- **Provenance:** User-stated
- **Risk:** Low
- **Notes:** Establishes design consistency across dashboard

### [DEC-005] Template Color Mapping ✓

- **Decision:** Map templates to semantic theme-card-\* colors
- **Status:** Accepted
- **Provenance:** AI-recommended (user-confirmed)
- **Risk:** Low
- **Mapping:**
  - 🤝 Client Project → `theme-card-cream` (formal, warm)
  - 🏠 Internal Team → `theme-card-matcha` (casual, friendly)
  - ⚙️ Tech Dev Room → `theme-card-sky` (tech, cool)
  - 📋 Cross-team Meeting → `theme-card-lilac` (neutral, professional)
  - 👔 Executive / Board → `theme-card-peach` (executive, refined)

### [DEC-006] Textarea Icon Color ✓

- **Decision:** Use `var(--warning)` for flat yellow background
- **Status:** Accepted
- **Provenance:** User-stated
- **Risk:** Low
- **Notes:** Replaces gradient `#fde7b7 → #f5c34b` with solid `var(--warning)`

### [DEC-007] Candy Bar Optimized Colors ✓

- **Decision:** Vibrant, high-contrast 5-color palette
- **Status:** Accepted
- **Provenance:** AI-recommended (user-confirmed)
- **Risk:** Low
- **Colors:**
  - Segment 1: `#e63946` (vibrant red, was `#f28d8d`)
  - Segment 2: `#f77f00` (vibrant orange, was `#f7b267`)
  - Segment 3: `#fcbf49` (vibrant yellow, was `#f7d65a`)
  - Segment 4: `#90be6d` (vibrant lime, was `#d7dd6f`)
  - Segment 5: `#43aa8b` (vibrant teal, was `#9fd9a7`)

### [DEC-008] Stripe Pattern Preservation ✓

- **Decision:** Keep candy bar stripe pattern (brutal with texture)
- **Status:** Accepted
- **Provenance:** User-stated
- **Risk:** Low
- **Notes:** Maintains visual interest while staying brutal

## Technical Implementation

### Files to Modify:

1. **`packages/dashboard/src/styles/global.css`**
   - Remove all `radial-gradient` and `linear-gradient` from:
     - `.context-editor-shell::before` (lines 238-245)
     - `.context-editor-shell[data-template-active='true'] textarea` (lines 265-268)
     - `.context-template-card` background (lines 239-240, 266-267, 391, 403-404)
     - `.context-template-comet-burst` (line 426)
     - `.context-template-check` (line 444)
   - Update candy segment colors to vibrant palette
   - Replace textarea icon gradient with `var(--warning)`

2. **`packages/dashboard/src/components/molecules/context-field.tsx`**
   - Update `CANDY_PROGRESS_SEGMENTS` constant with new colors
   - Update `TEMPLATE_MOTION_TONES` to use theme-card-\* mappings
   - Remove glow values from motion tones (or set to transparent)
   - Update textarea icon inline style (line 183)

### Brutal Logic for Unspecified Elements:

**Textarea Active Background:**

- Remove all gradients
- Use solid `rgba(255, 255, 255, 0.94)` base
- Add template theme color as tinted overlay: `var(--context-template-soft)`
- Border: `var(--context-template-accent)` (2px solid)
- Shadow: `4px 4px 0 var(--border)` (brutal shadow, no blur)

**Comet-Burst Active Effect:**

- Remove gradient background `linear-gradient(180deg, #fffdfa 0%, #fff3da 100%)`
- Use solid template theme color base
- Keep border/shadow brutal treatment
- Animation: Keep motion but remove color transitions

**Template Card Active State:**

- Background: Solid theme color (no radial gradient overlay)
- Border: Accent color (2px solid)
- Shadow: `4px 4px 0 var(--border)` offset brutal shadow
- No glow, no blur effects

## Acceptance Criteria

1. ✅ No `linear-gradient` or `radial-gradient` in any Context Field element except candy stripe pattern
2. ✅ All 5 template cards use flat theme-card-\* colors
3. ✅ Textarea icon background is solid `var(--warning)`
4. ✅ Active template state shows solid bg + colored border (no glow)
5. ✅ Candy bar uses new vibrant 5-color palette
6. ✅ Candy stripe pattern remains functional
7. ✅ Visual consistency with BrutalCard from webhook guide
8. ✅ All existing tests pass
9. ✅ No accessibility regressions (contrast ratios maintained)
10. ✅ Reduced motion preferences respected

## Happy Path

1. User opens room creation/edit page
2. Context Field renders with flat-colored components
3. User clicks template card → card shows solid bg + accent border (no glow)
4. User types in textarea → candy bar fills with vibrant colors
5. Selected template applies solid theme color to textarea background
6. All interactions feel brutally simple and bold

## Edge Cases

- **Empty state:** Trigger button shows default styling
- **Max length (500 chars):** Candy bar at 100%, error message shows
- **Reduced motion:** All transitions disabled, colors remain
- **Multiple rapid template selections:** Framer Motion layoutId handles transitions
- **Focus states:** Maintain brutal shadow treatment

## Failure Cases

- **Invalid template body:** Falls back to default theme (lilac)
- **Missing CSS variable:** Falls back to hardcoded color
- **Animation disabled:** Static colors work without motion

## Testing Strategy

1. **Visual Regression:**
   - Screenshot compare: template cards vs webhook guide BrutalCard
   - Verify no gradients in inspector
   - Check color contrast ratios (WCAG AA)

2. **Unit Tests:**
   - Existing tests must pass (`context-field.test.tsx`)
   - Verify no gradient CSS in source (test already exists)
   - Verify candy color values match new palette

3. **Manual Testing:**
   - Select each template → verify solid colors
   - Type to 100% → verify vibrant candy bar
   - Test reduced motion preference
   - Test keyboard navigation

## Rollout Plan

1. Implement changes in feature branch
2. Run all tests (`bun test && bun run typecheck && bun run lint`)
3. Visual review in dev environment
4. Merge to main (no feature flag needed - pure visual change)

## Open Risks

None. All decisions confirmed.

## Out of Scope (Future Enhancements)

_From scope extension backlog - not part of current spec:_

- None identified during interview
