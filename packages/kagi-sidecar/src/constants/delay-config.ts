/**
 * Char count threshold for choosing input strategy.
 * ≤ 50: typeIntoContentEditable (simulates keystrokes for very short text).
 * > 50: chunkPaste (avoids per-char typing delay that dominates latency).
 */
export const HUMAN_INPUT_THRESHOLD = 50

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

/**
 * BROWSER_CONFIG: timing knobs for the patchright-driven flow.
 * Merged from nghien_cuu_cua_toi/src/config/translation.config.ts `BROWSER_CONFIG`.
 */
export const BROWSER_CONFIG = {
  HEADLESS: false,
  TIMEOUT: 30_000,
  WAIT_FOR_SELECTOR_TIMEOUT: 15_000,
  CLOUDFLARE_VERIFICATION_TIMEOUT_MS: 45_000,
  CLOUDFLARE_VERIFICATION_POLL_MS: 250,
  POST_RENDER_DELAY: 1_000,
  READING_LEVEL_SWEEP_DELAY_MS: 1_000,
  TRANSLATION_OUTPUT_STABLE_MS: 1_500,
  TRANSLATION_OUTPUT_POLL_MS: 400,
  TRANSLATION_OUTPUT_MAX_WAIT_MS: 90_000,
  POST_STABLE_EXTRA_MS: 250,
  CONTEXT_URL_SETTLE_MS: 1_500,
  OUTPUT_READY_PRE_SETTINGS_MS: 2_000,
  POST_DIALOG_SETTLE_MS: 400,
  STYLE_OPTION_CLICK_GAP_MS: 200,
  POST_DISMISS_SETTINGS_MS: 200,
  POST_FORMALITY_CASUAL_SETTLE_MS: 3_000,
  TRANSLATION_VISIBLE_AFTER_SETTINGS_MS: 45_000,
} as const
