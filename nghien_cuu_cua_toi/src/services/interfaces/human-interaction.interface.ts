import type { Page } from 'puppeteer-core'

/**
 * Human-like interaction abstraction (Dependency Inversion Principle).
 *
 * KagiBrowserService depends on this interface, not on ghost-cursor or @forad/puppeteer-humanize directly.
 * All methods must degrade gracefully in Docker (bounding rect may be 0).
 */
export interface IHumanInteraction {
  /**
   * Ghost-cursor Bezier move to element → click at random point within element.
   * Fallback: page.click(selector) if bounding rect invalid or ghost-cursor throws.
   */
  click(page: Page, selector: string): Promise<void>

  /**
   * Find span element by text content + matchIndex → ghost-cursor move to rect center ± jitter → click parent button.
   * Fallback: page.evaluate(() => btn.click()) if bounding rect invalid or ghost-cursor throws.
   */
  clickByTextContent(
    page: Page,
    spanSelector: string,
    text: string,
    matchIndex: number,
  ): Promise<void>

  /**
   * @forad/puppeteer-humanize typeInto() for standard <textarea> elements.
   * Fallback: page.type() with fixed delay if humanize throws.
   */
  typeIntoTextarea(page: Page, selector: string, text: string): Promise<void>

  /**
   * page.type() with variable keystroke delay (50–150ms) + pause after punctuation.
   * For CodeMirror contenteditable — puppeteer-humanize is NOT compatible.
   * Fallback: page.evaluate(() => execCommand('insertText', ...)).
   */
  typeIntoContentEditable(page: Page, selector: string, text: string): Promise<void>

  /**
   * Ghost-cursor drag from slider's fromStep pixel position to toStep pixel position.
   * Fallback: page.evaluate(() => { slider.value = toStep; slider.dispatchEvent(new Event('input', {bubbles: true})) })
   * if bounding rect.width === 0 (Docker scenario).
   */
  dragSlider(page: Page, sliderSelector: string, fromStep: number, toStep: number): Promise<void>

  /**
   * Divide text into random chunks (500–2000 chars), paste each via Clipboard API + Ctrl/Cmd+V.
   * Type last 3–5 chars via typeIntoContentEditable for natural finish.
   * Used for sourceText > HUMAN_INPUT_THRESHOLD chars.
   */
  chunkPaste(page: Page, selector: string, text: string): Promise<void>
}
