/**
 * Kagi UI automation constants - ported from nghien_cuu_cua_toi research.
 * All values empirically verified for correct UI interaction behavior.
 */

// ═══════════════════════════════════════════════════════════
// ENVIRONMENT AND SESSION CONSTANTS
// ═══════════════════════════════════════════════════════════

/** Kagi origin for the first-hop navigation before translate.kagi.com. */
export const KAGI_ORIGIN_URL = 'https://kagi.com/'

/** Env-var name that overrides automatic session-file lookup. */
export const KAGI_SESSION_FILE_ENV = 'KAGI_SESSION_FILE' as const

/** Default session-cookie filename looked up in ./secrets and /app/secrets. */
export const KAGI_SESSION_FILE_NAME = 'kagi.com_16-04-2026.json' as const

/** Kagi "Brief context for translation" textarea max length. */
export const MAX_TRANSLATION_CONTEXT_LENGTH = 100

export function clampTranslationContext(raw: string | undefined): string {
  if (raw === undefined || raw === '') return ''
  return raw.length <= MAX_TRANSLATION_CONTEXT_LENGTH
    ? raw
    : raw.slice(0, MAX_TRANSLATION_CONTEXT_LENGTH)
}

export const READING_LEVELS = ['standard', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'] as const
export type ReadingLevel = (typeof READING_LEVELS)[number]

export function getReadingLevelSliderValue(level: ReadingLevel): number {
  return READING_LEVELS.indexOf(level)
}

// ═══════════════════════════════════════════════════════════
// CSS SELECTORS - Verified selectors for Kagi UI elements
// ═══════════════════════════════════════════════════════════

export const KAGI_SELECTORS = {
  /** Translation Settings button on toolbar */
  TRANSLATION_SETTINGS_BUTTON: 'button[aria-label="Translation Settings"]',

  /** Source text input contenteditable area */
  SOURCE_TEXT_INPUT: '[aria-label="Source text input"]',

  /** Context textarea in Translation Settings dialog */
  CONTEXT_TEXTAREA: 'textarea[placeholder*="Brief context for translation"]',
  TRANSLATION_CONTEXT_TEXTAREA: 'textarea[placeholder*="Brief context for translation"]',

  /** Reading level slider input */
  READING_LEVEL_SLIDER: 'input[type="range"][aria-valuemin="0"][aria-valuemax="6"][step="1"]',

  /** Gender option label spans (disambiguate by matchIndex: 0=speaker, 1=addressee) */
  GENDER_LABEL: 'span.flex-grow.text-start',

  /** Translation style option label spans (contains "Natural" or "Literal") */
  STYLE_LABEL: 'span.flex-grow.text-start',
  TRANSLATION_STYLE_OPTION_LABEL_SPAN: 'span.flex-grow.text-start',

  /** Formality label spans. Kagi may use either `flex-grow` or `grow`. */
  FORMALITY_LABEL: 'span.flex-grow.text-start, span.grow.text-start',
  FORMALITY_OPTION_LABEL_SPAN: 'span.flex-grow.text-start, span.grow.text-start',

  /** Speaker gender option label spans */
  SPEAKER_GENDER_OPTION_LABEL_SPAN: 'span.flex-grow.text-start',

  /** Addressee gender option label spans */
  ADDRESSEE_GENDER_OPTION_LABEL_SPAN: 'span.flex-grow.text-start',

  /** Translation content output container */
  TRANSLATION_CONTENT: '.translation-content',

  /** Nested text span variants inside the translation output container */
  TEXT_SPAN: '.font-universal, .text-direction-auto, span[dir]',

  /** Fallback textarea selectors observed in Kagi output UIs */
  OUTPUT_TEXTAREA: 'textarea[placeholder*="translation"], textarea[placeholder*="Translation"]',
  TEXTAREA_PLACEHOLDER:
    'textarea[placeholder*="translation"], textarea[placeholder*="Translation"]',

  /** Login verification selectors */
  LOGGED_IN_INDICATOR: 'a[href="/logout"]',
  SIGNIN_EMAIL_INPUT: '#signInEmailBox',
  SIGNIN_QR_AUTH: '#qr-code-auth',
} as const

// ═══════════════════════════════════════════════════════════
// TIMING CONSTANTS - Empirically verified delays (milliseconds)
// ═══════════════════════════════════════════════════════════

export const KAGI_TIMING = {
  /**
   * Wait after navigating to Kagi translate page for Cloudflare Turnstile
   * verification and app bootstrap to complete. Matches the PoC
   * (nghien_cuu_cua_toi) which uses a 5s settle wait.
   */
  POST_NAV_CLOUDFLARE_SETTLE_MS: 3000,

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

export const TRANSLATION_STYLE_UI_LABELS = {
  NATURAL: 'Natural',
  LITERAL: 'Literal',
} as const

export const FORMALITY_UI_LABELS = {
  VIETNAMESE_CASUAL: 'Vietnamese Casual',
  VIETNAMESE_FORMAL: 'Vietnamese Formal',
  STANDARD: 'Standard',
} as const

export const GENDER_PREFERENCE_UI_LABELS = {
  UNKNOWN: 'Unknown',
  NEUTRAL: 'Neutral',
  FEMININE: 'Feminine',
  MASCULINE: 'Masculine',
} as const

export const SPEAKER_GENDER_UI_LABELS = GENDER_PREFERENCE_UI_LABELS
export const ADDRESSEE_GENDER_UI_LABELS = GENDER_PREFERENCE_UI_LABELS

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
