/**
 * Translation configuration constants
 *
 * Extracted from index.ts as part of SOLID refactoring (SRP)
 * All configuration values centralized here for easy modification
 */

import type {
  ReadingLevel,
  SpeakerGender,
  AddresseeGender,
  TranslationStyle,
  Formality,
  TranslationOptions,
} from '~/types'
import { READING_LEVELS } from '~/types'

/**
 * Default translation configuration
 * @remarks Uses strict defaults (no extra params sent to Kagi)
 */
export const DEFAULT_TRANSLATION_CONFIG = {
  INPUT_TEXT: `動画を一定時間（例：10秒ごと）のチャンクに分割し、複数のGPUインスタンスで並列処理することで、1時間の動画でも数分で解析を終えることが可能です。（コストどすですか？）

2. 圧縮技術による最適化
「AIが物体を検出できる最低限の画質」まで落として転送するエンコード処理

プロキシ動画の生成:
4KやフルHDで撮影しても、AI検出用には 640x360（nHD） 程度まで解像度を落とした軽量なプロキシ動画に変換し、クラウドへ送る

フレームサンプリング:
すべてを送る必要はない。ヘアカットやカラーの動きであれば、10 fps 程度に間引いても検出精度への影響は軽微です。割り戻す処理（複雑か・・・）`,
  SOURCE_LANG: 'auto',
  TARGET_LANG: 'vi',
  READING_LEVEL: 'c2' as ReadingLevel,
  SPEAKER_GENDER: 'unknown' as SpeakerGender,
  ADDRESSEE_GENDER: 'unknown' as AddresseeGender,
  STYLE: 'natural' as TranslationStyle,
  FORMALITY: 'vietnamese_casual' as Formality,
  TRANSLATION_CONTEXT: 'hello',
} as const

/**
 * Sample context used only by `src/index.ts` local entry (`bun run start:local`).
 * Default context is intentionally set to "hello" so the context textarea path is exercised.
 * Override with env `TRANSLATION_CONTEXT` (set to empty to skip and keep URL/UI without context).
 */
export const INDEX_ENTRY_SAMPLE_TRANSLATION_CONTEXT = 'hello'

/** Kagi "Brief context for translation" textarea max length (UI enforces; we clamp to match). */
export const MAX_TRANSLATION_CONTEXT_LENGTH = 100

/**
 * Truncates optional translation context to {@link MAX_TRANSLATION_CONTEXT_LENGTH} characters.
 */
export function clampTranslationContext(raw: string | undefined): string {
  if (raw === undefined || raw === '') {
    return ''
  }
  return raw.length <= MAX_TRANSLATION_CONTEXT_LENGTH
    ? raw
    : raw.slice(0, MAX_TRANSLATION_CONTEXT_LENGTH)
}

/** Maximum character length accepted for source text input. Kagi API slows significantly above this. */
export const MAX_INPUT_TEXT_LENGTH = 20_000

/**
 * Truncates source text to {@link MAX_INPUT_TEXT_LENGTH} characters.
 * Primary call: index.ts (logs warning). Defensive call: fillSourceTextInput (silent).
 */
export function clampInputText(raw: string): string {
  if (raw.length <= MAX_INPUT_TEXT_LENGTH) return raw
  const charsRemoved = raw.length - MAX_INPUT_TEXT_LENGTH
  console.warn(
    `[clampInputText] Input truncated: ${raw.length} → ${MAX_INPUT_TEXT_LENGTH} chars (${charsRemoved} chars removed)`,
  )
  return raw.slice(0, MAX_INPUT_TEXT_LENGTH)
}

/**
 * Browser runtime settings
 */
export const BROWSER_CONFIG = {
  HEADLESS: false, // false = show browser (debug), true = hide (production)
  TIMEOUT: 30000, // Timeout in milliseconds
  WAIT_FOR_SELECTOR_TIMEOUT: 15000, // Wait for translation content timeout
  /** Wait for Cloudflare verification / challenge to complete before interacting. */
  CLOUDFLARE_VERIFICATION_TIMEOUT_MS: 45000,
  /** How often the Cloudflare readiness gate re-checks the DOM (ms). */
  CLOUDFLARE_VERIFICATION_POLL_MS: 250,
  POST_RENDER_DELAY: 1000, // Fallback delay when stability wait fails or legacy paths
  READING_LEVEL_SWEEP_DELAY_MS: 1000, // Pause between sequential reading-level runs
  /**
   * After `.translation-content` exists, wait until `textContent` length stops growing for this long.
   * Kagi can stream long translations; a fixed delay is insufficient.
   */
  TRANSLATION_OUTPUT_STABLE_MS: 1500,
  /** How often Puppeteer re-checks the stability predicate (ms). */
  TRANSLATION_OUTPUT_POLL_MS: 400,
  /** Max time to wait for streaming output to stabilize (ms). */
  TRANSLATION_OUTPUT_MAX_WAIT_MS: 90000,
  /** Short buffer after stability before scrape (DOM / overlay scrollbars). */
  POST_STABLE_EXTRA_MS: 250,
  /** Small settle delay after context is filled before URL verification (ms). */
  CONTEXT_URL_SETTLE_MS: 1500,
  /** After initial translation output appears before continuing to settings. */
  OUTPUT_READY_PRE_SETTINGS_MS: 2000,
  /** After Translation Settings dialog opens, before style option clicks */
  POST_DIALOG_SETTLE_MS: 400,
  /** Between Literal → Natural style clicks (order in automation) */
  STYLE_OPTION_CLICK_GAP_MS: 200,
  /** After Escape-dismiss of Translation Settings (panel close animation / focus) */
  POST_DISMISS_SETTINGS_MS: 200,
  /** After selecting Formality → Vietnamese Casual; lets Kagi UI settle before waiting on output */
  POST_FORMALITY_CASUAL_SETTLE_MS: 3000,
  /**
   * After closing Translation Settings (and URL param sync), output may stay empty while Kagi
   * re-translates; allow longer than {@link WAIT_FOR_SELECTOR_TIMEOUT} for `.translation-content`.
   */
  TRANSLATION_VISIBLE_AFTER_SETTINGS_MS: 45000,
} as const

/**
 * Kagi Translate URL base
 */
export const KAGI_TRANSLATE_BASE_URL = 'https://translate.kagi.com/'

/**
 * CSS selectors for scraping Kagi Translate results
 */
export const KAGI_SELECTORS = {
  /** Toolbar control that opens the Translation Settings dialog (Kagi UI) */
  TRANSLATION_SETTINGS_BUTTON: 'button[aria-label="Translation Settings"]',
  /** Reading Level slider inside Translation Settings (0 = standard, 6 = c2) */
  READING_LEVEL_SLIDER: 'input[type="range"][aria-valuemin="0"][aria-valuemax="6"][step="1"]',
  /**
   * Label span inside Natural / Literal rows (matches Kagi settings dialog markup)
   */
  TRANSLATION_STYLE_OPTION_LABEL_SPAN: 'span.flex-grow.text-start',
  /**
   * Label span inside Standard / Vietnamese Formal / Vietnamese Casual rows.
   * Kagi may use `grow` or `flex-grow` (same as Translation Style / Gender rows); match both.
   */
  FORMALITY_OPTION_LABEL_SPAN: 'span.flex-grow.text-start, span.grow.text-start',
  /**
   * Speaker gender row labels (same `flex-grow` pattern as translation style rows)
   */
  SPEAKER_GENDER_OPTION_LABEL_SPAN: 'span.flex-grow.text-start',
  /**
   * Addressee gender: same span pattern as speaker; disambiguate via match index in automation (1 = second block)
   */
  ADDRESSEE_GENDER_OPTION_LABEL_SPAN: 'span.flex-grow.text-start',
  TRANSLATION_CONTENT: '.translation-content',
  TEXT_SPAN: '.font-universal, .text-direction-auto, span[dir]',
  TEXTAREA_PLACEHOLDER:
    'textarea[placeholder*="translation"], textarea[placeholder*="Translation"]',
  /** Brief context textarea inside Translation Settings (optional) */
  TRANSLATION_CONTEXT_TEXTAREA: 'textarea[placeholder*="Brief context for translation"]',
  /**
   * CodeMirror 6 source pane (see log.txt): contenteditable with stable aria-label.
   */
  SOURCE_TEXT_INPUT: '[aria-label="Source text input"]',
} as const

/** Visible labels for translation style toggles in the settings dialog */
export const TRANSLATION_STYLE_UI_LABELS = {
  NATURAL: 'Natural',
  LITERAL: 'Literal',
} as const

/** Formality row labels in Translation Settings (automation visits Standard → Formal, ends on Vietnamese Casual) */
export const FORMALITY_UI_LABELS = {
  VIETNAMESE_CASUAL: 'Vietnamese Casual',
  VIETNAMESE_FORMAL: 'Vietnamese Formal',
  STANDARD: 'Standard',
} as const

/** Shared labels for Speaker / Addressee gender rows (order: Masculine → … → Unknown) */
export const GENDER_PREFERENCE_UI_LABELS = {
  UNKNOWN: 'Unknown',
  NEUTRAL: 'Neutral',
  FEMININE: 'Feminine',
  MASCULINE: 'Masculine',
} as const

export const SPEAKER_GENDER_UI_LABELS = GENDER_PREFERENCE_UI_LABELS
export const ADDRESSEE_GENDER_UI_LABELS = GENDER_PREFERENCE_UI_LABELS

/**
 * Maps a ReadingLevel enum to the Kagi slider step.
 * Slider order follows the canonical READING_LEVELS tuple.
 */
export function getReadingLevelSliderValue(readingLevel: ReadingLevel): number {
  return READING_LEVELS.indexOf(readingLevel)
}

/**
 * Builds a complete TranslationOptions object from config constants
 * @returns TranslationOptions with default values
 */
export function getDefaultTranslationOptions(): TranslationOptions {
  return {
    sourceLang: DEFAULT_TRANSLATION_CONFIG.SOURCE_LANG,
    targetLang: DEFAULT_TRANSLATION_CONFIG.TARGET_LANG,
    readingLevel: DEFAULT_TRANSLATION_CONFIG.READING_LEVEL,
    speakerGender: DEFAULT_TRANSLATION_CONFIG.SPEAKER_GENDER,
    addresseeGender: DEFAULT_TRANSLATION_CONFIG.ADDRESSEE_GENDER,
    style: DEFAULT_TRANSLATION_CONFIG.STYLE,
    formality: DEFAULT_TRANSLATION_CONFIG.FORMALITY,
    translationContext: DEFAULT_TRANSLATION_CONFIG.TRANSLATION_CONTEXT,
  }
}
