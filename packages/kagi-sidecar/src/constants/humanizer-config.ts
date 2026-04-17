/**
 * Human-like interaction settings used by HumanInteractionService and helper utilities.
 * Ported verbatim from nghien_cuu_cua_toi/src/config/humanizer.config.ts.
 */

export interface NumberRangeMs {
  readonly minMs: number
  readonly maxMs: number
}

export type HumanizerPunctuationPauseMap = Record<string, NumberRangeMs>

export const HUMANIZER_CONFIG = {
  WORDS_PER_MINUTE: 400,
  CHAR_DELAY_JITTER: 0.35,
  MIN_CHAR_DELAY_MS: 28,
  MAX_CHAR_DELAY_MS: 260,
  AVERAGE_CHARS_PER_WORD: 5,
  MISTAKE_RATE: 0.03,
  TYPING_MISTAKE_PAUSE_MS: { minMs: 90, maxMs: 220 },
  HESITATION_PROBABILITY: 0.16,
  TYPING_BURST_MIN: 2,
  TYPING_BURST_MAX: 7,
  TYPING_BURST_HESITATION_PROBABILITY: 0.22,
  TYPING_BURST_HESITATION_MS: { minMs: 55, maxMs: 140 },
  PUNCTUATION_PAUSE_MS: {
    '.': { minMs: 180, maxMs: 320 },
    ',': { minMs: 120, maxMs: 220 },
    '!': { minMs: 190, maxMs: 310 },
    '?': { minMs: 190, maxMs: 320 },
    ';': { minMs: 150, maxMs: 280 },
    ':': { minMs: 140, maxMs: 270 },
  } satisfies HumanizerPunctuationPauseMap,
  MOUSE_PATH_OFFSET_MIN: 14,
  MOUSE_PATH_OFFSET_MAX: 58,
  MOUSE_STEP_DELAY_MS: { minMs: 3, maxMs: 12 },
  MOUSE_OVERSHOOT_CHANCE: 0.28,
} as const
