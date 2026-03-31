# Spotlight Animation Neubrutalism 3D Redesign — Design Document

**Date:** 2026-03-31  
**Status:** Approved  
**Prepared by:** AI-assisted  
**Selected Approach:** **Approach 3: Orbital Glare Sweep** 🌟

---

## Executive Summary

Replace existing spotlight animation in dashboard room list with **Approach 3: Orbital Glare Sweep** — a neubrutalism 3D animation featuring orbital spotlight, rotating shadows, and maximum wow factor.

**Key Decision:** User selected Approach 3 for its cinematic, memorable experience despite higher complexity. Willing to accept performance trade-offs for maximum visual impact.

---

## Background

**Current Implementation:**

- Framer Motion `layout` animation with `backgroundColor` and `boxShadow` keyframes
- Duration: 2.2s (SPOTLIGHT_DURATION_MS = 2400ms)
- Highlighted effect (butter theme #ffe19a) with shadow animation
- Stretch/layout animation causes poor UX

**User Feedback:**

- Highlighted effect is good
- Stretch/layout animation is not appealing
- Want creative, wow, neubrutalism 3D style animation

---

## Requirements

| Requirement            | Value                            | Source             |
| ---------------------- | -------------------------------- | ------------------ |
| **Scope**              | Spotlight room only              | User confirmed     |
| **Duration**           | 2.2-2.4s (keep existing)         | User confirmed     |
| **3D Intensity**       | Moderate                         | User confirmed     |
| **Additional Effects** | Glow/light rays                  | User confirmed     |
| **Colors**             | Butter theme (#ffe19a + #d44470) | User confirmed     |
| **Performance Target** | 60fps, GPU-accelerated           | System requirement |
| **Approach Selected**  | Approach 3: Orbital Glare Sweep  | User approved      |

---

## Design: Approach 3 — Orbital Glare Sweep 🌟

### Concept

Card tilts into 3D space while a radial spotlight gradient orbits around it. Shadow rotates in sync with spotlight direction, creating a dynamic, cinematic effect.

### Animation Sequence (2.4s)

```
Timeline:
┌─────────────────────────────────────────────────────────────┐
│ 0.0s → 0.5s: Card tilts into 3D space                      │
│   rotateX: 0deg → 8deg                                      │
│   rotateY: 0deg → -5deg                                     │
│   transition: ease-out                                      │
├─────────────────────────────────────────────────────────────┤
│ 0.5s → 2.0s: Orbital spotlight sweep (360°)                │
│   Spotlight gradient orbits around card center             │
│   Path: Circular, 40% radius from center                   │
│   Shadow rotates in sync (4 cardinal transitions)          │
│   Update frequency: 40 FPS (25ms interval)                 │
├─────────────────────────────────────────────────────────────┤
│ 1.5s → 2.4s: "NEW" sticker elastic bounce                  │
│   opacity: 0 → 1                                            │
│   scale: 0.8 → 1                                            │
│   easing: cubic-bezier(0.34, 1.56, 0.64, 1)                │
├─────────────────────────────────────────────────────────────┤
│ 2.0s → 2.4s: Settle back + Glow fade                       │
│   rotateX: 8deg → 0deg                                      │
│   rotateY: -5deg → 0deg                                     │
│   Spotlight opacity: 1 → 0                                  │
│   Shadow reset: current → 4px 4px 0 var(--border)          │
└─────────────────────────────────────────────────────────────┘
```

### Visual Components

#### 1. Spotlight Gradient Overlay

```typescript
// Radial gradient that orbits around card
style={{
  position: 'absolute',
  inset: 0,
  borderRadius: '18px',
  background: `radial-gradient(
    circle at ${x}% ${y}%,
    rgba(255, 225, 154, 0.9),
    transparent 40%
  )`,
  mixBlendMode: 'overlay',
  pointerEvents: 'none',
  opacity: spotlightActive ? 1 : 0
}}
```

**Orbital Calculation:**

```typescript
const angle = progressInDegrees // 0 → 360
const x = 50 + 40 * Math.cos((angle * Math.PI) / 180)
const y = 50 + 40 * Math.sin((angle * Math.PI) / 180)
```

#### 2. Shadow Choreography

Shadow direction changes in sync with spotlight position (4 cardinal transitions):

| Angle Range | Shadow Direction | Box Shadow Value            |
| ----------- | ---------------- | --------------------------- |
| 0° - 90°    | Southeast        | `8px 8px 0 var(--border)`   |
| 90° - 180°  | Northeast        | `8px -8px 0 var(--border)`  |
| 180° - 270° | Northwest        | `-8px -8px 0 var(--border)` |
| 270° - 360° | Southwest        | `-8px 8px 0 var(--border)`  |

**Why 4 transitions instead of continuous?**

- Neubrutalism aesthetic: Hard, discrete shadow offsets (not smooth gradients)
- Performance: 4 box-shadow updates vs continuous transformation
- Visual clarity: Distinct shadow positions create rhythm

#### 3. Card 3D Tilt

```typescript
// Initial tilt into 3D space
transform: 'rotateX(8deg) rotateY(-5deg)'
transformStyle: 'preserve-3d'

// Parent container
style={{ perspective: 1200 }}
```

**Asymmetric tilt** (8deg X, -5deg Y) creates organic, intentional feel aligned with neubrutalism philosophy.

#### 4. Colors & Theme

- **Spotlight gradient core:** `rgba(255, 225, 154, 0.9)` (butter)
- **Shadow color:** `var(--border)` (#1a1a2e)
- **Card background:** `var(--card-butter)` (rgba(253, 230, 138, 0.9))
- **Accent:** `var(--pink-accent)` (#d44470) — used subtly in glow

---

## Technical Implementation

### Component Structure

```
<motion.div>  // Outer container (current spotlight wrapper)
  ↓
  <motion.div style={{ perspective: 1200 }}>  // Perspective container
    ↓
    <motion.div>  // Animated card with 3D transforms
      ↓
      <div>  // Spotlight gradient overlay (absolute positioned)
      <BrutalCard>  // Existing card content
        <StatusRibbon />
        <StickerLabel />  // "NEW" sticker
        ...
      </BrutalCard>
    </motion.div>
  </motion.div>
</motion.div>
```

### Framer Motion Implementation

#### Main Animation

```tsx
const spotlightAnimate = isSpotlighted
  ? {
      // Tilt phase
      rotateX: [0, 8, 8, 0],
      rotateY: [0, -5, -5, 0],
      // Shadow handled separately via setInterval
    }
  : {
      rotateX: 0,
      rotateY: 0,
    }

const transition = {
  rotateX: { duration: 0.5, times: [0, 0.2, 0.85, 1], ease: 'easeOut' },
  rotateY: { duration: 0.5, times: [0, 0.2, 0.85, 1], ease: 'easeOut' },
}
```

#### Orbital Spotlight Logic

```tsx
useEffect(() => {
  if (!spotlightRoomId) return

  let angle = 0
  const spotlightInterval = setInterval(() => {
    angle += 6 // 6° per frame = 360° in 1.5s at 25ms interval

    const x = 50 + 40 * Math.cos((angle * Math.PI) / 180)
    const y = 50 + 40 * Math.sin((angle * Math.PI) / 180)

    setSpotlightPosition({ x, y })

    // Shadow rotation logic
    if (angle >= 0 && angle < 90) {
      setBoxShadow('8px 8px 0 var(--border)')
    } else if (angle >= 90 && angle < 180) {
      setBoxShadow('8px -8px 0 var(--border)')
    } else if (angle >= 180 && angle < 270) {
      setBoxShadow('-8px -8px 0 var(--border)')
    } else {
      setBoxShadow('-8px 8px 0 var(--border)')
    }

    if (angle >= 360) {
      clearInterval(spotlightInterval)
    }
  }, 25) // 40 FPS

  return () => clearInterval(spotlightInterval)
}, [spotlightRoomId])
```

### Performance Optimizations

#### 1. GPU Acceleration

```tsx
style={{
  willChange: 'transform',
  transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
  transformStyle: 'preserve-3d'
}}
```

**Why `willChange`?**

- Signals browser to optimize layer promotion
- Critical for smooth 3D transforms
- Remove after animation completes to free resources

#### 2. Layer Optimization

```tsx
// Spotlight overlay on separate layer
style={{
  position: 'absolute',
  willChange: 'opacity', // Only opacity changes
  isolation: 'isolate'   // Create stacking context
}}
```

#### 3. Reduced Motion Support

```tsx
const reducedMotion = useReducedMotion()

const spotlightAnimate = isSpotlighted
  ? reducedMotion
    ? {
        // Fallback: Simple highlight without 3D
        backgroundColor: 'rgba(255, 225, 154, 0.92)',
        boxShadow: '8px 8px 0 rgba(212, 68, 112, 0.92)',
      }
    : {
        // Full 3D animation
        rotateX: [0, 8, 8, 0],
        rotateY: [0, -5, -5, 0],
      }
  : {}
```

---

## Architecture & Data Flow

### Existing Spotlight Mechanism

Current implementation in `room-list.tsx`:

1. **Trigger:** Navigate returns from create/edit with `spotlightRoomId` in location state
2. **State:** `useState<string | null>` tracks active spotlight
3. **Timeout:** `setTimeout` clears spotlight after SPOTLIGHT_DURATION_MS
4. **Cleanup:** `useEffect` cleanup on unmount

**No changes needed to trigger mechanism** — only animation implementation changes.

### Modified Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Navigate back with spotlightRoomId in state         │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│ 2. useEffect detects spotlightRoomId                    │
│    setSpotlightRoomId(id)                               │
│    navigate(path, { replace: true, state: null })       │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Spotlighted room card renders with:                  │
│    - 3D tilt animation (Framer Motion)                  │
│    - Orbital spotlight (setInterval)                    │
│    - Shadow choreography (state updates)                │
│    - "NEW" sticker bounce                               │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│ 4. After SPOTLIGHT_DURATION_MS (2400ms):                │
│    setSpotlightRoomId(null) → animation cleanup         │
└─────────────────────────────────────────────────────────┘
```

---

## Component Changes

### File: `packages/dashboard/src/pages/room-list.tsx`

**Changes:**

1. Add state for spotlight position and shadow
2. Add spotlight overlay element
3. Add orbital spotlight useEffect
4. Modify motion.div animate props for Approach 3
5. Keep existing spotlight trigger logic (no changes)

**Lines to modify:** ~326-342 (current spotlight animation block)

**New elements:**

- Spotlight position state: `useState<{x: number, y: number}>`
- Shadow state: `useState<string>`
- Spotlight overlay div (absolute positioned)
- Orbital interval cleanup

---

## Testing Strategy

### Unit Tests

**No new tests required** — spotlight trigger mechanism unchanged.

### Manual Testing Checklist

- [ ] Create new room → Navigate back → Verify Approach 3 animation plays
- [ ] Edit existing room → Navigate back → Verify animation plays
- [ ] Animation completes in ~2.4s
- [ ] Spotlight orbits smoothly (no jank)
- [ ] Shadow rotates in sync with spotlight
- [ ] "NEW" sticker bounces at 1.5s
- [ ] Card returns to rest state after animation
- [ ] Reduced motion: Fallback to simple highlight
- [ ] No layout shift or scroll jump
- [ ] Performance: 60fps on target devices

### Performance Testing

**Target Devices:**

- Desktop: Chrome/Firefox/Safari (Latest)
- Mobile: iOS Safari, Chrome Android
- Low-end test: 4-year-old device

**Metrics:**

- Animation FPS: ≥ 55fps (allow 5fps buffer)
- CPU usage: < 30% during animation
- No dropped frames on scroll
- Memory: No leaks (check with DevTools)

**If performance issues:**

1. Reduce spotlight update frequency (25ms → 40ms)
2. Simplify shadow transitions (4 steps → 2 steps)
3. Remove spotlight overlay, use box-shadow glow only

---

## Accessibility

### Reduced Motion

Users with `prefers-reduced-motion: reduce` receive:

- Simple highlight (backgroundColor + boxShadow)
- No 3D transforms
- No orbital animation
- Duration reduced to 0.5s

### Keyboard Navigation

- Spotlight animation **does not** interfere with keyboard focus
- Animation is purely visual enhancement
- All interactive elements remain focusable during animation

### Screen Readers

- No ARIA changes needed
- Animation is decorative (does not convey information)
- Screen reader users already get "New room created" toast

---

## Rollout Plan

### Phase 1: Implementation (Day 1)

1. Implement Approach 3 in `room-list.tsx`
2. Test locally with create/edit flows
3. Verify reduced motion fallback
4. Check performance with DevTools

### Phase 2: Testing (Day 1-2)

1. Manual testing on all target devices
2. Performance profiling
3. Accessibility audit
4. Cross-browser verification

### Phase 3: Deployment (Day 2)

1. Merge to main
2. Deploy to staging
3. Smoke test in staging
4. Deploy to production

### Rollback Plan

If critical issues found:

1. Revert to previous spotlight animation (layout animation)
2. Keep changes isolated to `room-list.tsx` for easy revert
3. File bug ticket with performance metrics

---

## Known Limitations & Trade-offs

### Performance Trade-offs

| Aspect                 | Trade-off                            | Mitigation                             |
| ---------------------- | ------------------------------------ | -------------------------------------- |
| **CPU Usage**          | setInterval at 40 FPS = 25ms updates | ✅ Limit to spotlight room only        |
| **GPU Layers**         | 3D transform + overlay = 2 layers    | ✅ Clean up with `will-change` removal |
| **Box-shadow updates** | 4 shadow changes during animation    | ✅ Use CSS custom property for perf    |
| **Radial gradient**    | Expensive on some browsers           | ✅ Fallback to simple glow if janky    |

### Browser Compatibility

- **Chrome/Edge 85+:** Full support ✅
- **Safari 14+:** Full support ✅
- **Firefox 90+:** Full support ✅
- **Safari iOS 14+:** Full support ✅
- **Chrome Android:** May drop frames on low-end devices ⚠️

**Graceful degradation:** If browser doesn't support `transform-style: preserve-3d`, fallback to 2D animation.

### Maintenance Considerations

- **Complexity:** Highest of 3 approaches (orbital calculation, shadow sync)
- **Future changes:** Modifying animation timing requires updating multiple synchronized parts
- **Testing:** More scenarios to test (angles, shadow transitions, etc.)

**Recommendation:** Document animation logic clearly in code comments.

---

## Success Metrics

### Qualitative

- [ ] Animation feels "wow" and memorable
- [ ] Neubrutalism aesthetic maintained
- [ ] No negative user feedback on performance
- [ ] Team consensus: Better than old layout animation

### Quantitative

- [ ] Performance: ≥ 55fps on target devices
- [ ] Duration: 2.2-2.4s actual vs expected
- [ ] CPU: < 30% during animation
- [ ] No crashes or freezes reported

---

## Future Enhancements (Out of Scope)

Potential improvements for future iterations:

1. **Sound effect:** Subtle "whoosh" when spotlight sweeps (optional)
2. **Particle trails:** 4-6 small dots following spotlight (see brainstorm doc)
3. **Different animations for create vs edit:** Subtle variation to differentiate
4. **User preference:** Allow users to choose animation intensity in settings
5. **Easter egg:** Special animation for 10th, 50th, 100th room created

---

## References

- Brainstorm Document: `docs/plans/2026-03-31-spotlight-animation-neubrutalism-3d-brainstorm.md`
- Demo File: `spotlight-animation-demo.html`
- Existing Implementation: `packages/dashboard/src/pages/room-list.tsx` lines 300-425
- Neubrutalism Research: https://lucky.graphics/learn/neo-brutalism-2026/
- 60fps CSS Techniques: Frontend.fyi CSS 3D tutorials

---

**Status:** ✅ Design Approved — Ready for Implementation  
**Next Step:** Create implementation plan and execute  
**Owner:** Development Team  
**Timeline:** 1-2 days implementation + testing
