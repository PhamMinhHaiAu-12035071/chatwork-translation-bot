/**
 * Human-like interaction settings used by service and helper utilities.
 */

export type NumberRangeMs = {
  readonly minMs: number
  readonly maxMs: number
}

export type HumanizerPunctuationPauseMap = Record<string, NumberRangeMs>

export const HUMANIZER_CONFIG = {
  /** Average typing speed in words per minute */
  WORDS_PER_MINUTE: 200,
  /** Jitter range around average char delay (e.g. 0.35 => ±35%) */
  CHAR_DELAY_JITTER: 0.35,
  MIN_CHAR_DELAY_MS: 28,
  MAX_CHAR_DELAY_MS: 260,
  /** Average chars per English word used in delay conversion (WPM → CPM assumption) */
  AVERAGE_CHARS_PER_WORD: 5,

  /** Chance of a typo per typing burst */
  MISTAKE_RATE: 0.03,
  /** Pause range used when simulating typo correction */
  TYPING_MISTAKE_PAUSE_MS: { minMs: 90, maxMs: 220 },

  /** Probability of brief hesitation (used by movement + typing pauses) */
  HESITATION_PROBABILITY: 0.16,

  /** Random grouping size for burst typing */
  TYPING_BURST_MIN: 2,
  TYPING_BURST_MAX: 7,
  /** Pause inserted between random burst boundaries */
  TYPING_BURST_HESITATION_PROBABILITY: 0.22,
  TYPING_BURST_HESITATION_MS: { minMs: 55, maxMs: 140 },
  /** Per-punctuation pauses during typing */
  PUNCTUATION_PAUSE_MS: {
    '.': { minMs: 180, maxMs: 320 },
    ',': { minMs: 120, maxMs: 220 },
    '!': { minMs: 190, maxMs: 310 },
    '?': { minMs: 190, maxMs: 320 },
    ';': { minMs: 150, maxMs: 280 },
    ':': { minMs: 140, maxMs: 270 },
  } satisfies HumanizerPunctuationPauseMap,

  /** Natural mouse path offset before moving into target */
  MOUSE_PATH_OFFSET_MIN: 14,
  MOUSE_PATH_OFFSET_MAX: 58,
  MOUSE_STEP_DELAY_MS: { minMs: 3, maxMs: 12 },
  /** Chance to append slight overshoot before correcting into target */
  MOUSE_OVERSHOOT_CHANCE: 0.28,
} as const
