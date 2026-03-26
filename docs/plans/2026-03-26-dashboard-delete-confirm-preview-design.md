# Dashboard Delete Confirm Preview Design

## Goal

Replace the browser-native `window.confirm` delete prompt with a neubrutalism 3D destructive-confirm flow that feels native to the dashboard. Before implementation in the app, build a standalone preview pack in `.superpowers/brainstorm` with 10 modal directions so the user can review and choose the best one.

## Current Problem

The delete flow in `packages/dashboard/src/pages/room-list.tsx` still uses `window.confirm(...)`. That browser dialog:

- ignores the dashboard visual language
- breaks typography, color, and motion consistency
- feels generic instead of tactile
- lowers perceived product quality at the most high-risk action

## Confirm Pattern Constraints

- No room-name re-entry
- No generic browser dialog
- Clear destructive friction, but not frustrating
- Must feel tactile, custom, and slightly theatrical
- Must stay legible and fast for dashboard use

The user explicitly liked the idea of a lever/slider-style confirmation. That becomes the center of gravity for the preview pack.

## Recommended Direction

Build a `Delete Confirm Modal Pack` with 10 standalone HTML previews in `.superpowers/brainstorm`, similar to the previous motion preview pack.

### Modal Families

#### Lever Family

Recommended primary family because it matches the current dashboard best:

- tactile
- obvious state change
- feels more premium than “Are you sure?”
- visually pairs well with neubrutal 3D buttons and thick shadows

#### Hold Family

Good secondary family:

- simple to understand
- great on desktop and mobile
- lower implementation risk

#### Stamp / Crush Family

Experimental family:

- strongest visual theater
- highest novelty
- higher risk of feeling excessive

## Preview Pack Structure

Create a new brainstorm folder with:

- `index.html` as the catalog
- `shared.css`
- `shared.js`
- `option-01` through `option-10` standalone pages

Each option should show:

- room card context
- click on `Delete`
- the custom confirmation modal
- the full interaction affordance
- cancel and destructive outcomes

## 10 Proposed Options

1. `Safety Slider`
   - simple horizontal lever drag
   - safest option

2. `Sticker Lever`
   - lever sits inside a chunky sticker control
   - best blend of tactile and cute

3. `Dual Lock Lever`
   - cancel side and delete side feel like mechanical lock zones
   - clearer “commit” threshold

4. `Hold To Melt`
   - hold a destructive button until it fills and melts
   - lower engineering risk

5. `Trash Gate`
   - drag a room chip through a destructive gate
   - more theatrical than standard slider

6. `Fuse Pull`
   - pull a bright fuse handle until the modal “arms”
   - strong cartoon tension

7. `Stamp Crush`
   - pull down a rubber stamp that marks the room as deleted
   - high character, medium-high risk

8. `Card Shred`
   - drag a destructive tab across the card and preview a shred seam
   - visually bold

9. `Warning Dial`
   - rotate a chunky dial from safe to delete
   - unusual, memorable, but less obvious than slider

10. `Slam Confirm`
    - large destructive block drops into place when released
    - loudest option, highest theatricality

## Recommendation

For actual shipping, the most likely winners are:

- `Sticker Lever`
- `Safety Slider`
- `Dual Lock Lever`

These are the options most likely to feel premium, distinct, and still practical inside the dashboard.

## References

- Dribbble destructive modal inspiration: https://dribbble.com/search/destructive%20modal
- CodePen delete confirmation reference: https://codepen.io/jtarragah/pen/MQqpJx

## Testing / Validation

This phase is preview-only, not app integration. Validation should confirm:

- 10 option files exist
- catalog links open correctly
- shared assets load
- the interaction script runs without syntax errors
- the previews remain standalone and easy to review locally
