/**
 * Barrel export for all configuration
 */

export {
  DEFAULT_TRANSLATION_CONFIG,
  BROWSER_CONFIG,
  KAGI_TRANSLATE_BASE_URL,
  KAGI_SELECTORS,
  TRANSLATION_STYLE_UI_LABELS,
  FORMALITY_UI_LABELS,
  SPEAKER_GENDER_UI_LABELS,
  ADDRESSEE_GENDER_UI_LABELS,
  GENDER_PREFERENCE_UI_LABELS,
  MAX_TRANSLATION_CONTEXT_LENGTH,
  MAX_INPUT_TEXT_LENGTH,
  clampTranslationContext,
  clampInputText,
  INDEX_ENTRY_SAMPLE_TRANSLATION_CONTEXT,
  getReadingLevelSliderValue,
  getDefaultTranslationOptions,
} from './translation.config'

export {
  DELAY_TIERS,
  HUMAN_INPUT_THRESHOLD,
  computeDelayMultiplier,
  computeScaledDelay,
} from './delay.config'
