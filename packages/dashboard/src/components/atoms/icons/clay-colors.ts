import type { ClayIconName } from './icon-paths'

export interface ClayColorDef {
  from: string
  to: string
}

export const CLAY_COLORS: Record<ClayIconName, ClayColorDef> = {
  plus: { from: '#ede8ff', to: '#bfb3f7' }, // violet/lilac → theme-button-violet
  pencil: { from: '#d5f0ff', to: '#7dc8ec' }, // sky blue    → room-card-action-btn--edit
  trash: { from: '#ffe0f0', to: '#f4a0c8' }, // pink coral  → room-card-action-btn--delete
  book: { from: '#fde7c0', to: '#f4a060' }, // warm amber  → theme-button-warm
  link: { from: '#e9fad8', to: '#7abf64' }, // matcha      → --matcha-accent
  webhook: { from: '#d5e8ff', to: '#6eaaec' }, // sky accent  → --sky-accent
  pause: { from: '#fef9d0', to: '#f9d44a' }, // butter      → --warning
  play: { from: '#c8f5e0', to: '#4dd8a0' }, // mint        → --success
}
