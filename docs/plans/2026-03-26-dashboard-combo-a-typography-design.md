# Dashboard Combo A Typography Design

## Goal

Upgrade the dashboard typography so it feels more intentional, more explosive visually, and more consistent without losing the handwritten charm the user explicitly likes from `Shantell Sans`.

## Approved Font System

- `Shantell Sans`: signature display voice
- `Fredoka`: numeric impact voice
- `Zen Maru Gothic`: readable system voice

## Role Mapping

### Shantell Sans

Use for high-personality control and identity surfaces:

- page titles
- room titles
- nav labels
- status pill text
- sticker labels
- button labels
- short step titles and short callouts

### Fredoka

Use only where a compact, rounded, high-energy number or short metric is needed:

- dashboard stat numbers
- future short numeric badges or counters

### Zen Maru Gothic

Use anywhere readability matters more than personality:

- room metadata such as `Room ID`, `Provider`, `Style`
- descriptions and helper text
- form labels, hints, and errors
- nav blurbs
- utility/status body text such as `Webhook not configured`
- inputs and selects

## UI/UX Rationale

The current dashboard has strong personality in titles and buttons, but the supporting text system is too inconsistent. `Combo A` keeps the recognizable handwritten signature while introducing a clean readable layer and a dedicated metric font. That creates clearer hierarchy:

- identity and interaction feel expressive
- data and helper copy feel trustworthy
- large numbers feel more premium and energetic

## Constraints

- preserve `Shantell Sans` as the dominant emotional signature
- do not let `Fredoka` spread into body copy or long labels
- keep small text readable on room cards and forms
- keep existing color language and motion system intact

## Testing Strategy

Because the dashboard package relies mostly on source and static markup tests:

- verify the new Google Fonts import includes `Fredoka` and `Zen Maru Gothic`
- verify `global.css` maps body, display, and metric roles to the new families
- verify key dashboard files wire the correct classes to titles, numbers, meta text, and controls
