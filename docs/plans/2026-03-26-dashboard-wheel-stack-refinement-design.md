# Dashboard Wheel Stack Refinement Design

## Goal

Refine the stat number animation so it no longer looks hard-clipped at the top and bottom. The target feel is closer to `CupertinoWheelPicker`: soft fade at the edges, clear center lane, smooth directional travel.

## Root Cause

The current `SlideStackNumber` uses a short `overflow-hidden` viewport plus `blur` on entering and exiting values. That combination makes the number look like it is being cut off by hard horizontal bars when the glyph crosses the viewport edge.

## Approved Fix

Replace the current stat-number transition with a wheel-style viewport:

- keep the existing fixed footprint
- remove blur from enter and exit states
- add a soft vertical mask so values fade out instead of being clipped abruptly
- use spring motion and light `rotateX`/scale changes so increment and decrement feel like a wheel rolling forward or backward

## Constraints

- keep `increment = forward` and `decrement = reverse`
- do not change `Pixel Scatter`
- respect reduced motion
- avoid introducing new dependencies
