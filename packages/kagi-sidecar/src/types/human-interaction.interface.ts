import type { PageLike } from './page.interface.js'

/** Contract for human-like browser interaction methods. */
export interface IHumanInteraction {
  /**
   * Bezier mouse movement → click at selector.
   * Fallback: page.click(selector) when rect invalid or ghost-cursor throws.
   */
  click(page: PageLike, selector: string): Promise<void>

  /**
   * Find span by textContent, click its closest button ancestor.
   * Fallback: evaluate click when rect invalid or exception occurs.
   *
   * @param matchIndex - Index in the list of matching spans (0-based)
   */
  clickByTextContent(
    page: PageLike,
    spanSelector: string,
    text: string,
    matchIndex: number,
  ): Promise<void>

  /**
   * Natural typing with mistake simulation into a textarea.
   * Fallback: page.type() with fixed 80ms delay.
   */
  typeIntoTextarea(page: PageLike, selector: string, text: string): Promise<void>

  /**
   * Per-character keystroke typing with variable speed into contenteditable.
   * Fallback: execCommand('insertText').
   */
  typeIntoContentEditable(page: PageLike, selector: string, text: string): Promise<void>

  /**
   * Drag slider from fromStep to toStep via Bezier mouse movement.
   * Steps are integer values matching slider min/max (0–6).
   * Fallback: evaluate set slider.value + dispatch events.
   */
  dragSlider(
    page: PageLike,
    sliderSelector: string,
    fromStep: number,
    toStep: number,
  ): Promise<void>

  /**
   * Paste text in chunks via Clipboard API + Ctrl/Cmd+V.
   * Types last 3–5 chars via keystrokes to simulate editing.
   * Short text (≤10 chars): delegates to typeIntoContentEditable.
   */
  chunkPaste(page: PageLike, selector: string, text: string): Promise<void>
}
