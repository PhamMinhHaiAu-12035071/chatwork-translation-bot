/**
 * Char count threshold for choosing input strategy.
 * ≤ 500: typeIntoContentEditable. > 500: chunkPaste.
 */
export const HUMAN_INPUT_THRESHOLD = 500

/** 4-tier delay multiplier configuration. Checked in order; first match wins. */
export const DELAY_TIERS = [
  { maxChars: 2_000, multiplier: 1.0 },
  { maxChars: 8_000, multiplier: 1.5 },
  { maxChars: 15_000, multiplier: 2.5 },
  { maxChars: 20_000, multiplier: 4.0 },
] as const

/**
 * Compute delay multiplier based on input text char count.
 *
 * | Range         | Multiplier |
 * |---------------|-----------|
 * | ≤ 2,000       | 1.0x      |
 * | 2,001–8,000   | 1.5x      |
 * | 8,001–15,000  | 2.5x      |
 * | 15,001–20,000 | 4.0x      |
 */
export function computeDelayMultiplier(charCount: number): number {
  for (const tier of DELAY_TIERS) {
    if (charCount <= tier.maxChars) return tier.multiplier
  }
  return 4.0
}

/**
 * Compute scaled delay with ±10% jitter.
 *
 * @param baseMs - Base delay in milliseconds
 * @param charCount - Input text char count (determines tier)
 * @param random - RNG function (default: Math.random, injectable for tests)
 */
export function computeScaledDelay(
  baseMs: number,
  charCount: number,
  random: () => number = Math.random,
): number {
  const multiplier = computeDelayMultiplier(charCount)
  const scaled = baseMs * multiplier
  const jitter = (random() * 0.2 - 0.1) * scaled
  return Math.round(scaled + jitter)
}
