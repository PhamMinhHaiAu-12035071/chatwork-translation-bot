# Dashboard Kawaii Clay Palette Refresh Design

**Date:** 2026-03-28

## Goal

Refresh the dashboard color system so the interface feels brighter, cuter, and more clearly aligned with Japanese Kawaii Neubrutalism 3D Claymorphism without weakening usability or semantic clarity.

## Current Behavior

- The dashboard already has a warm pastel base with strong black borders and offset shadows.
- Surface colors are semi-transparent and somewhat muted, especially the mint and yellow cards.
- The visual language reads as soft neubrutalism, but not fully as candy-bright claymorphism.
- Some status meanings are currently close to the surface palette, which risks semantic overlap if the surfaces get brighter without a clearer token strategy.

## Approved UX Direction

Approved principles:

- Make the dashboard noticeably brighter and cuter.
- Keep the current neubrutalist black border and dimensional offset shadow language.
- Push card surfaces toward a candy-like palette inspired by `clay-ui-kit.html`.
- Use `Mint #6EE7B7` and `Lemon #FDE68A` as key references for the refreshed surface system.
- Keep semantic colors separate from mood/surface colors.
- Preserve readability and hierarchy across forms, stats, room cards, and empty/error states.

## Scope

In scope:

- Dashboard design tokens in `packages/dashboard/src/styles/global.css`
- Surface palette for cards, shells, and supporting panels
- Background brightness tuning
- Light clay-style inner shine for card surfaces
- Relevant dashboard shell tests that encode palette expectations

Out of scope:

- Dashboard information architecture changes
- Typography changes
- Route/component logic changes unrelated to theme tokens
- Replacing the established black border neubrutalist style
- Full button redesign beyond token compatibility adjustments

## Design

### Palette Strategy

Use a layered palette rather than a full solid-color replacement.

The palette should have three roles:

1. `Surface mood colors`
   - used for cards, shells, stickers, and supportive panels
   - emotionally bright, cute, candy-like
   - examples: mint, lemon, lilac, peach, sky, blush, cream

2. `Semantic colors`
   - used for success, warning, error, and primary accents
   - must remain meaning-driven rather than decorative
   - should not be overloaded as the default surface palette

3. `Structural colors`
   - border, shadow, primary text, muted text
   - stay dark and stable to keep the interface readable and tactile

This separates “how the screen feels” from “what the state means.”

### Surface Palette

Refresh the main surface tokens toward brighter candy tones:

- `matcha/mint` should move closer to `#6EE7B7`
- `butter/lemon` should align with `#FDE68A`
- `lilac`, `peach`, `sky`, and `blush` should be brightened to stay in the same family
- `cream` should remain as the neutral rest surface so the eye has recovery space

The surfaces should stay slightly softened rather than fully opaque solids. A lightly milked finish keeps them readable against the already decorated page background.

### Background

The page background should be brightened slightly so the new surfaces feel luminous rather than heavy.

Recommended direction:

- keep the cream-milk base
- increase the sense of lightness in the gradient endpoints
- keep the organic circles, but retune them so they do not fight with the brighter cards

The background must support the cards, not compete with them.

### Claymorphism Layer

To move from “pastel neubrutalism” toward “neubrutalism 3D claymorphism,” add a restrained inner-shine layer to key surfaces:

- primary cards
- sidebar shell
- main content shell
- modal surfaces

This should look like a soft clay glaze, not a glossy glass UI. The black border and brutal offset shadow remain the dominant form language.

### Button and Status Treatment

Buttons should stay more saturated and darker than the card surfaces so action hierarchy remains obvious.

Status colors must stay semantic:

- success should still read as success, not as “the same mint as every card”
- warning should still read as warning, not as “the same lemon as every card”
- error should remain clearly distinct

This means the refreshed surface mint and lemon can be bright, but the semantic tokens may need separate tuned values.

### Component Application Rules

Apply the refresh in this order of emphasis:

1. stat cards
2. sidebar cards
3. main content shell
4. room list cards
5. empty/error/support panels
6. modal surfaces

This ensures the screen feels brighter immediately while preserving clear focal points.

### Testing Strategy

The change should be locked down with dashboard shell tests rather than purely visual memory.

Tests should validate:

- refreshed surface token values in `global.css`
- preserved typography roles
- preserved black border / shadow neubrutalist structure
- updated shell expectations where color tokens appear in rendered output

## Rationale

The recommended direction gives the dashboard a stronger kawaii identity without flattening meaning or over-decorating every surface. Bright pastel surfaces create the emotional tone, while semantic colors remain responsible for communicating state. That balance is the safest way to make the interface feel more playful and luminous without making it harder to scan or operate.
