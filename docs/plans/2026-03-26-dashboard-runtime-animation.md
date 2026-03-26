# Dashboard Runtime Animation Implementation Plan

1. Add reusable motion primitives in `packages/dashboard/src/components/ui/`.
   - create a `Pixel Scatter` text swap component
   - create a directional `Slide Stack` number component

2. Write failing co-located tests before implementation.
   - verify increment/decrement direction helpers
   - verify deterministic scatter descriptors
   - verify room list and room detail use the new animated primitives

3. Apply the motion primitives to the room dashboard.
   - animate `Live` / `Paused`
   - animate `Pause` / `Enable`
   - animate `Total Rooms`, `Active`, and `Awaiting Webhook`

4. Apply low-risk matching animation to room detail.
   - animate the changing status pill
   - animate the changing webhook state label if it reuses the same primitive cleanly

5. Verify before claiming completion.
   - `bun test packages/dashboard/src`
   - `bun run --cwd packages/dashboard typecheck`
   - `bun run --cwd packages/dashboard lint`
