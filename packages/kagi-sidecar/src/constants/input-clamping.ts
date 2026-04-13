/** Maximum character count for source text input. */
export const MAX_INPUT_TEXT_LENGTH = 20_000

/**
 * Clamp text to MAX_INPUT_TEXT_LENGTH characters.
 * Returns text unchanged if within limit; truncates otherwise.
 */
export function clampInputText(text: string): string {
  if (text.length <= MAX_INPUT_TEXT_LENGTH) return text
  return text.slice(0, MAX_INPUT_TEXT_LENGTH)
}
