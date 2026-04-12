/**
 * Delay tier configuration and scaling utilities
 *
 * Pure functions — stateless, side-effect free.
 * Used by KagiBrowserService to scale wait times based on source text length.
 */

interface DelayTier {
  readonly maxChars: number
  readonly multiplier: number
}

/**
 * Tier thresholds: the longer the source text, the more time Kagi needs to re-translate
 * after each settings change. Multipliers are applied to base delay values from BROWSER_CONFIG.
 */
export const DELAY_TIERS = [
  { maxChars: 2_000, multiplier: 1.0 },
  { maxChars: 8_000, multiplier: 1.5 },
  { maxChars: 15_000, multiplier: 2.5 },
  { maxChars: 20_000, multiplier: 4.0 },
] as const satisfies readonly DelayTier[]

/**
 * Source text length threshold (chars) that determines entry method:
 * ≤ threshold → typeIntoContentEditable (full keystroke)
 * > threshold → chunkPaste (Clipboard API chunks)
 */
export const HUMAN_INPUT_THRESHOLD = 500

/**
 * Returns the delay multiplier for the given character count.
 * Uses first-match scan through DELAY_TIERS (ascending maxChars).
 * Caps at max tier multiplier (4.0) for charCount > 20,000.
 */
export function computeDelayMultiplier(charCount: number): number {
  for (const tier of DELAY_TIERS) {
    if (charCount <= tier.maxChars) return tier.multiplier
  }
  return DELAY_TIERS[DELAY_TIERS.length - 1].multiplier
}

/**
 * Returns a scaled delay in milliseconds.
 * Formula: baseMs × multiplier(charCount) × jitter(±10%), rounded to integer.
 */
export function computeScaledDelay(baseMs: number, charCount: number): number {
  const multiplier = computeDelayMultiplier(charCount)
  const jitter = 0.9 + Math.random() * 0.2 // [0.9, 1.1]
  return Math.round(baseMs * multiplier * jitter)
}
