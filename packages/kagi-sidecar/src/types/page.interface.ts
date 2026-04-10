/**
 * Minimal interface for element handles returned by waitForSelector.
 * Allows clicking elements after they're found.
 */
export interface ElementHandleLike {
  /**
   * Click this element.
   * @throws Error if element not clickable
   */
  click(): Promise<void>
}

export interface PageLike {
  // ═══════════════════════════════════════════════════════════
  // EXISTING METHODS
  // ═══════════════════════════════════════════════════════════

  goto(url: string, options?: unknown): Promise<unknown>

  /**
   * Wait for selector to appear in DOM.
   * UPDATED: Returns ElementHandleLike to support .click()
   */
  waitForSelector(selector: string, options?: unknown): Promise<ElementHandleLike | null>

  evaluate<T>(fn: (...args: unknown[]) => T, ...args: unknown[]): Promise<T>

  $eval<T>(selector: string, fn: (element: Element) => T): Promise<T>

  // ═══════════════════════════════════════════════════════════
  // NEW METHODS FOR UI INTERACTION
  // ═══════════════════════════════════════════════════════════

  /**
   * Wait for a function to return truthy value.
   * Used for polling URL changes, slider values, content stability.
   *
   * @param fn - Function to evaluate in browser context
   * @param options - Timeout and polling interval
   * @param args - Arguments to pass to fn (must be serializable)
   */
  waitForFunction(
    fn: (...args: unknown[]) => unknown,
    options?: { timeout?: number; polling?: number | 'raf' | 'mutation' },
    ...args: unknown[]
  ): Promise<void>

  /**
   * Click element matching selector.
   * @throws Error if element not found or not clickable
   */
  click(selector: string): Promise<void>

  /**
   * Focus element matching selector.
   * @throws Error if element not found
   */
  focus(selector: string): Promise<void>

  /**
   * Get current page URL (address bar).
   * Used for verification after UI interactions.
   */
  url(): string
}
