# Spotlight Animation Neubrutalism 3D Redesign — Brainstorm

**Date:** 2026-03-31  
**Status:** Brainstorming  
**Prepared by:** AI-assisted

## Context

Dashboard room list hiện tại có spotlight animation khi navigate về từ create/edit room. Animation hiện tại sử dụng:

- Framer Motion `layout` animation với `backgroundColor` và `boxShadow` keyframes
- Duration: 2.2s (SPOTLIGHT_DURATION_MS = 2400ms)
- Highlighted effect (butter theme #ffe19a) kèm shadow animation
- Stretch/layout animation gây UX không smooth

**User feedback:** Highlighted effect OK, nhưng stretch/layout animation không đẹp. Muốn animation sáng tạo, wow, theo phong cách neubrutalism 3D.

## Requirements Confirmed

✅ **Scope:** Chỉ spotlight room có animation đặc biệt (giữ nguyên animation của các room khác)  
✅ **Duration:** 2.2-2.4s (giữ nguyên SPOTLIGHT_DURATION_MS)  
✅ **3D Intensity:** Moderate (cân bằng wow + professional)  
✅ **Additional Effects:** Glow/light rays  
✅ **Colors:** Giữ butter theme (#ffe19a + #d44470)  
✅ **Performance Target:** 60fps, GPU-accelerated

## Research Insights

### Neubrutalism Design Principles (2026 Trends)

From research on neubrutalism trends và Dribbble:

1. **Raw Authenticity:** Counter-movement to AI-generated overly polished visuals
2. **Visual DNA:**
   - Strong black outlines replacing soft shadows
   - Hard, solid shadow offsets WITHOUT blur (e.g., `8px 8px 0 var(--border)`)
   - High-contrast colors (black & white + accent)
   - Intentional asymmetry (human-made feel)
   - Tactile micro-interactions với defined states

3. **Typography:** Oversized sans-serif, extreme weight variants
4. **Philosophy:** "Pixels like physical blocks—heavy, solid, undeniable"

### 60fps Animation Techniques

1. **GPU Acceleration:**
   - Use `transform` và `opacity` chỉ (avoid `top`, `left`, `width`, `height`)
   - Add `will-change: transform` cho elements sẽ animate
   - `transform-style: preserve-3d` cho 3D space

2. **CSS 3D Transforms:**
   - `rotateX()`, `rotateY()`, `rotateZ()` cho 3D rotation
   - `translateZ()` cho depth
   - `perspective()` trên container (recommended: 800-1500px)

3. **Framer Motion Best Practices:**
   - Spring physics: `{type: 'spring', stiffness: 120-320, damping: 18-28}`
   - Use `useReducedMotion()` để respect accessibility
   - Stagger animations với `delay` prop

## 🎨 Three Animation Approaches

---

### **Approach 1: "Brutal Pop-Stamp"** ⚡

**Concept:** Card "đóng dấu" xuống bề mặt với chuyển động asymmetric bold.

**Animation Sequence (2.2s):**

```
Timeline:
0.0s → 0.3s: Scale up + Asymmetric tilt
0.3s → 1.5s: Hard shadow grows (solid offset)
0.5s → 1.0s: "NEW" sticker bounces in
1.5s → 2.2s: Glow pulse + Shadow reset
```

**Technical Details:**

```tsx
// Framer Motion variants
const brutaPopVariants = {
  initial: {
    scale: 1,
    rotate: 0,
    boxShadow: '4px 4px 0 var(--border)',
  },
  animate: {
    scale: [1, 1.05, 1.05, 1],
    rotate: [0, 3, 3, 0],
    boxShadow: [
      '4px 4px 0 var(--border)',
      '8px 8px 0 var(--border)',
      '12px 12px 0 var(--border)',
      '4px 4px 0 var(--border)',
    ],
  },
  transition: {
    duration: 2.2,
    times: [0, 0.15, 0.7, 1],
    ease: [0.34, 1.56, 0.64, 1], // Elastic out
  },
}

// Glow pulse (separate layer)
const glowVariants = {
  animate: {
    boxShadow: [
      '0 0 0 rgba(255, 225, 154, 0)',
      '0 0 32px rgba(255, 225, 154, 0.6)',
      '0 0 48px rgba(255, 225, 154, 0.8)',
      '0 0 0 rgba(255, 225, 154, 0)',
    ],
  },
  transition: {
    duration: 1.5,
    delay: 1.2,
    ease: 'easeInOut',
  },
}
```

**Visual Characteristics:**

- Hard shadow offsets (neubrutalism style): NO blur
- Asymmetric rotation (3deg tilt) → human-made feel
- "NEW" sticker bounces với elastic easing
- Glow pulse subtle ở cuối sequence

**Performance:** ⭐⭐⭐⭐⭐

- GPU-accelerated transforms only
- No repaints/reflows
- 60fps guaranteed even on low-end devices

**Wow Factor:** ⭐⭐⭐

- Clean, professional, on-brand
- Neubrutalism authentic
- Không quá flashy nhưng memorable

**Pros:**

- ✅ Simplest implementation
- ✅ Best performance
- ✅ Most accessible (reduced motion friendly)
- ✅ True to neubrutalism philosophy

**Cons:**

- ❌ Least dramatic trong 3 options
- ❌ Không có 3D depth effect

---

### **Approach 2: "3D Flip Carnival"** 🎡 ⭐ RECOMMENDED

**Concept:** Card flips trên Y-axis với shadow choreography và glow rays emanating từ edges.

**Animation Sequence (2.2s):**

```
Timeline:
0.0s → 0.4s: Lift up + Slight scale
0.4s → 1.4s: 360° rotateY flip (spring physics)
  - Mid-flip (180°): Shadow flips direction
  - Background gradient shifts
1.0s → 1.5s: "NEW" sticker elastic bounce
1.4s → 2.0s: Glow rays expand từ 4 edges
2.0s → 2.2s: Settle back, rays fade
```

**Technical Details:**

```tsx
// Container with perspective
;<motion.div style={{ perspective: 1200 }} className="rounded-[24px] p-1">
  <motion.div
    animate={{
      // Lift phase
      translateZ: [0, 20, 20, 0],
      scale: [1, 1.08, 1.08, 1],
      // Flip phase
      rotateY: [0, 360],
    }}
    transition={{
      translateZ: { duration: 0.4, ease: 'easeOut' },
      scale: { duration: 0.4, ease: 'easeOut' },
      rotateY: {
        duration: 1.0,
        delay: 0.4,
        type: 'spring',
        stiffness: 120,
        damping: 18,
      },
    }}
    style={{
      transformStyle: 'preserve-3d',
      willChange: 'transform',
    }}
  >
    {/* Card content */}
  </motion.div>
</motion.div>

// Shadow choreography (custom hook)
const shadowDirection = rotateY > 180 ? '-8px 8px 0' : '8px 8px 0'

// Glow rays (4 layered box-shadows)
const glowRays = {
  animate: {
    boxShadow: [
      '0 0 0 transparent',
      '0 -12px 24px rgba(255,225,154,0.4), 0 12px 24px rgba(255,225,154,0.4), -12px 0 24px rgba(212,68,112,0.3), 12px 0 24px rgba(212,68,112,0.3)',
      '0 -20px 40px rgba(255,225,154,0.6), 0 20px 40px rgba(255,225,154,0.6), -20px 0 40px rgba(212,68,112,0.5), 20px 0 40px rgba(212,68,112,0.5)',
      '0 0 0 transparent',
    ],
  },
  transition: {
    duration: 0.8,
    delay: 1.4,
    ease: 'easeInOut',
  },
}
```

**Visual Characteristics:**

- 3D flip với spring physics → organic, playful
- Shadow flips direction mid-animation → neubrutalism choreography
- Butter gradient background có subtle shift
- Glow rays emanate từ 4 edges (butter + pink colors)
- "NEW" sticker bounces với elastic ease

**Performance:** ⭐⭐⭐⭐

- GPU-accelerated 3D transforms
- `will-change` optimization
- Smooth 60fps với proper perspective setup
- May drop frames on very old devices

**Wow Factor:** ⭐⭐⭐⭐⭐

- Memorable, playful, cinematic
- Clear visual beats
- Embodies neubrutalism boldness

**Pros:**

- ✅ Perfect balance wow + performance
- ✅ No mouse tracking needed (simpler than Approach 3)
- ✅ Shadow choreography tạo depth authentically
- ✅ Spring physics feels organic
- ✅ Fits 2.2s duration perfectly
- ✅ Scalable: có thể tweak intensity dễ dàng

**Cons:**

- ❌ Slightly complex hơn Approach 1
- ❌ Requires perspective container setup

---

### **Approach 3: "Orbital Glare Sweep"** 🌟

**Concept:** Card tilts vào 3D space, radial spotlight quét theo orbital path, shadow rotates theo, kèm particle trails.

**Animation Sequence (2.4s):**

```
Timeline:
0.0s → 0.5s: Card tilt vào 3D space
0.5s → 2.0s: Radial spotlight orbits 360° quanh card
  - Shadow rotates cùng direction
  - Particles (4-6 dots) follow spotlight path
1.5s → 2.4s: Settle back + Glow fade
2.0s → 2.4s: Particles dissipate
```

**Technical Details:**

```tsx
// Orbital spotlight calculation
const spotlightAngle = useMotionValue(0)
const spotlightX = useTransform(spotlightAngle, [0, 360], ['0%', '100%'])
const spotlightY = useTransform(spotlightAngle, [0, 360], ['0%', '100%'])

// Animation
useEffect(() => {
  if (isSpotlighted) {
    animate(spotlightAngle, 360, {
      duration: 1.5,
      delay: 0.5,
      ease: 'linear'
    })
  }
}, [isSpotlighted])

// Spotlight gradient overlay
<motion.div
  style={{
    position: 'absolute',
    inset: 0,
    background: `radial-gradient(circle at ${spotlightX}% ${spotlightY}%, rgba(255,225,154,0.9), transparent 40%)`,
    mixBlendMode: 'overlay',
    pointerEvents: 'none'
  }}
/>

// Particle system (6 particles with staggered delay)
const particles = [0, 1, 2, 3, 4, 5].map(i => ({
  delay: 0.5 + (i * 0.15),
  angle: i * 60 // Distributed around circle
}))

// Shadow rotation (sync với spotlight)
const shadowRotation = useTransform(
  spotlightAngle,
  [0, 90, 180, 270, 360],
  [
    '8px 8px 0 var(--border)',
    '8px -8px 0 var(--border)',
    '-8px -8px 0 var(--border)',
    '-8px 8px 0 var(--border)',
    '8px 8px 0 var(--border)'
  ]
)
```

**Visual Characteristics:**

- Card tilts vào 3D space (rotateX: 8deg, rotateY: -5deg)
- Radial gradient spotlight orbits smoothly
- Shadow direction rotates theo spotlight (4 cardinal transitions)
- 6 particle dots trail behind spotlight với stagger
- Layered effects: Glow + spotlight + particles

**Performance:** ⭐⭐⭐

- Requires careful optimization
- Particles = 6 additional DOM elements
- May drop frames on low-end devices
- Need to use `will-change` aggressively
- Radial gradient animation can be expensive

**Wow Factor:** ⭐⭐⭐⭐⭐

- Maximum impact, festival vibes
- Unforgettable, cinematic
- Complex choreography

**Pros:**

- ✅ Most impressive visually
- ✅ Unique, không ai có animation giống
- ✅ Multiple layers create depth

**Cons:**

- ❌ Most complex implementation
- ❌ Performance concerns on older devices
- ❌ Particles add DOM overhead
- ❌ Radial gradient animation expensive
- ❌ Harder to maintain/debug

---

## Comparison Matrix

| Criterion                     | Approach 1 | Approach 2 | Approach 3 |
| ----------------------------- | ---------- | ---------- | ---------- |
| **Performance**               | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐   | ⭐⭐⭐     |
| **Wow Factor**                | ⭐⭐⭐     | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Implementation Complexity** | Low        | Medium     | High       |
| **Maintenance**               | Easy       | Medium     | Complex    |
| **Neubrutalism Authentic**    | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐   | ⭐⭐⭐     |
| **Accessibility**             | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐   | ⭐⭐⭐     |
| **Scalability**               | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐   | ⭐⭐⭐     |

## My Recommendation: Approach 2 - "3D Flip Carnival" 🎡

**Reasoning:**

1. **Sweet spot:** Perfect balance giữa wow factor (⭐⭐⭐⭐⭐) và performance (⭐⭐⭐⭐)
2. **Neubrutalism DNA:** Shadow choreography embodies "solid, physical blocks" philosophy
3. **No mouse tracking:** Simpler than Approach 3, không cần pointer events
4. **Spring physics:** Organic, tactile feel — not robotic
5. **Clear visual beats:**
   - Lift (0-0.4s)
   - Flip with shadow flip (0.4-1.4s)
   - Glow rays (1.4-2.0s)
   - Settle (2.0-2.2s)
6. **Scalable:** Có thể tăng/giảm intensity bằng cách tweak spring stiffness/damping
7. **Memorable:** Users will remember "the card that flipped" — không generic

**When to choose alternatives:**

- **Approach 1** nếu: có 100+ rooms, prioritize absolute performance, hoặc accessibility is critical concern
- **Approach 3** nếu: willing to accept performance trade-offs, want maximum uniqueness, có resources để optimize/maintain complex code

## Next Steps

1. ✅ Get user approval on selected approach
2. Create interactive demo/prototype for final validation
3. Write detailed design document
4. Implement chosen approach
5. Performance test on various devices
6. Accessibility audit (reduced motion, keyboard nav)

## Open Questions

- [ ] Có muốn thêm sound effects không? (subtle "whoosh" khi flip)
- [ ] Có muốn animation khác nhau cho create vs edit return? (subtle variation)
- [ ] Fallback strategy cho reduced motion users? (Just highlight, no 3D?)

---

**Status:** Awaiting user selection → Will create demo preview next
