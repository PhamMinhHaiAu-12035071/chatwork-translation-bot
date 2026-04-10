/**
 * Kagi UI automation constants - ported from nghien_cuu_cua_toi research.
 * All values empirically verified for correct UI interaction behavior.
 */

// ═══════════════════════════════════════════════════════════
// CSS SELECTORS - Verified selectors for Kagi UI elements
// ═══════════════════════════════════════════════════════════

export const KAGI_SELECTORS = {
  /** Translation Settings button on toolbar */
  TRANSLATION_SETTINGS_BUTTON: '[aria-label="Translation Settings"]',

  /** Context textarea in Translation Settings dialog */
  CONTEXT_TEXTAREA: 'textarea[placeholder*="context"]',

  /** Reading level slider input */
  READING_LEVEL_SLIDER: 'input[type="range"][aria-label*="reading level"]',

  /** Gender label spans (disambiguate by matchIndex: 0=speaker, 1=addressee) */
  GENDER_LABEL: 'label span',

  /** Translation style label spans (contains "Natural" or "Literal") */
  STYLE_LABEL: 'label span',

  /** Formality label spans (contains "Standard", "Vietnamese Casual", etc.) */
  FORMALITY_LABEL: 'label span',

  /** Translation content output container */
  TRANSLATION_CONTENT: '.translation-content, [class*="translation"]',
} as const

// ═══════════════════════════════════════════════════════════
// TIMING CONSTANTS - Empirically verified delays (milliseconds)
// ═══════════════════════════════════════════════════════════

export const KAGI_TIMING = {
  /** Wait after opening Translation Settings dialog for UI to settle */
  POST_DIALOG_SETTLE_MS: 400,

  /** Gap between consecutive UI option clicks (allows UI to update) */
  STYLE_OPTION_CLICK_GAP_MS: 200,

  /** Wait after clicking Vietnamese Casual formality (chim mồi technique) */
  POST_FORMALITY_CASUAL_SETTLE_MS: 3000,

  /** Duration text must remain unchanged to be considered stable */
  TRANSLATION_OUTPUT_STABLE_MS: 1500,

  /** Poll interval for checking translation output stability */
  TRANSLATION_OUTPUT_POLL_MS: 400,

  /** Maximum time to wait for translation output (prevents infinite loop) */
  TRANSLATION_OUTPUT_MAX_WAIT_MS: 90000,

  /** Extra buffer after output detected as stable (safety margin) */
  POST_STABLE_EXTRA_MS: 250,
} as const

// ═══════════════════════════════════════════════════════════
// UI LABELS - Exact text labels in Kagi UI
// ═══════════════════════════════════════════════════════════

export const KAGI_UI_LABELS = {
  TRANSLATION_STYLE: {
    NATURAL: 'Natural',
    LITERAL: 'Literal',
  },
  FORMALITY: {
    STANDARD: 'Standard',
    VIETNAMESE_CASUAL: 'Vietnamese Casual',
    VIETNAMESE_FORMAL: 'Vietnamese Formal',
  },
  GENDER: {
    UNKNOWN: 'Unknown',
    NEUTRAL: 'Neutral',
    FEMININE: 'Feminine',
    MASCULINE: 'Masculine',
  },
} as const

// ═══════════════════════════════════════════════════════════
// MAPPING CONSTANTS - Convert preset values to UI values
// ═══════════════════════════════════════════════════════════

/**
 * Map reading level preset value to slider step number.
 * Slider has 7 steps (0-6) corresponding to language complexity levels.
 */
export const READING_LEVEL_TO_STEP: Record<string, number> = {
  standard: 0,
  a1: 1,
  a2: 2,
  b1: 3,
  b2: 4,
  c1: 5,
  c2: 6,
}

/**
 * Map formality preset value to expected URL parameter value.
 * Used for URL verification after formality click.
 */
export const FORMALITY_TO_URL_PARAM: Record<string, string> = {
  standard: '', // No param for default
  vietnamese_casual: 'vi_casual',
  vietnamese_formal: 'vi_formal',
}

/**
 * Map formality preset value to UI label text.
 * Used to find correct formality option to click.
 */
export const FORMALITY_LABELS: Record<string, string> = {
  standard: 'Standard',
  vietnamese_casual: 'Vietnamese Casual',
  vietnamese_formal: 'Vietnamese Formal',
}
