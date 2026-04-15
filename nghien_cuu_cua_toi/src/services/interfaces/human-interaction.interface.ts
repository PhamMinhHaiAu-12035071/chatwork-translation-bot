import type { Page } from 'patchright'

/**
 * Human-like interaction abstraction (Dependency Inversion Principle).
 *
 * KagiBrowserService depends on this interface, not on a specific interaction helper implementation.
 * All methods must degrade gracefully in Docker (bounding rect may be 0).
 */
export interface IHumanInteraction {
  /**
   * Moves to a computed point within element bounds and clicks.
   * Fallback: page.click(selector) if bounding rect is invalid.
   */
  click(page: Page, selector: string): Promise<void>

  /**
   * Find span element by text content + matchIndex and click its parent button.
   * Fallback: page.evaluate(() => btn.click()) if bounding rect is invalid.
   */
  clickByTextContent(
    page: Page,
    spanSelector: string,
    text: string,
    matchIndex: number,
  ): Promise<void>

  /**
   * Types text for standard <textarea> elements with per-character sequencing.
   * Fallback: page.fill() with fixed delay semantics if direct typing is unavailable.
   */
  typeIntoTextarea(page: Page, selector: string, text: string): Promise<void>

  /**
   * Uses variable keystroke delay (50–150ms) + pause after punctuation.
   * For CodeMirror contenteditable, per-character typing is used instead of bulk fills.
   * Fallback: page.evaluate(() => execCommand('insertText', ...)).
   */
  typeIntoContentEditable(page: Page, selector: string, text: string): Promise<void>

  /**
   * Drags the slider from fromStep to toStep.
   * Fallback: page.evaluate(() => { slider.value = toStep; slider.dispatchEvent(new Event('input', {bubbles: true})) })
   * when bounding rect width is not usable (Docker scenario).
   */
  dragSlider(page: Page, sliderSelector: string, fromStep: number, toStep: number): Promise<void>

  /**
   * Divide text into random chunks (500–2000 chars), paste each via Clipboard API + Ctrl/Cmd+V.
   * Type last 3–5 chars via typeIntoContentEditable for natural finish.
   * Used for sourceText > HUMAN_INPUT_THRESHOLD chars.
   */
  chunkPaste(page: Page, selector: string, text: string): Promise<void>
}
