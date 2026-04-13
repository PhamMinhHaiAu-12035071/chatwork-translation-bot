/**
 * Minimal interface for element handles returned by waitForSelector or $().
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
  // NAVIGATION & WAITING
  // ═══════════════════════════════════════════════════════════

  goto(url: string, options?: unknown): Promise<unknown>

  /** Wait for selector to appear in DOM. */
  waitForSelector(selector: string, options?: unknown): Promise<ElementHandleLike | null>

  /**
   * Wait for a function to return truthy value.
   * Used for polling URL changes, slider values, content stability.
   */
  waitForFunction(
    fn: (...args: unknown[]) => unknown,
    options?: { timeout?: number; polling?: number | 'raf' | 'mutation' },
    ...args: unknown[]
  ): Promise<void>

  /** Get current page URL (address bar). */
  url(): string

  // ═══════════════════════════════════════════════════════════
  // EVALUATE — Overloads for typed call sites
  // ═══════════════════════════════════════════════════════════

  /** Single-arg evaluate — matches existing browser-service.ts patterns. */
  evaluate<TArg, TResult>(fn: (arg: TArg) => TResult, arg: TArg): Promise<TResult>

  /**
   * Two-arg evaluate — used by HumanInteractionService.dragSlider and
   * typeIntoContentEditable fallback paths.
   */
  evaluate<TArg1, TArg2, TResult>(
    fn: (arg1: TArg1, arg2: TArg2) => TResult,
    arg1: TArg1,
    arg2: TArg2,
  ): Promise<TResult>

  /** Three-arg evaluate — used by HumanInteractionService.clickByTextContent. */
  evaluate<TArg1, TArg2, TArg3, TResult>(
    fn: (arg1: TArg1, arg2: TArg2, arg3: TArg3) => TResult,
    arg1: TArg1,
    arg2: TArg2,
    arg3: TArg3,
  ): Promise<TResult>

  /** Spread fallback — handles any remaining call patterns. */
  evaluate<T>(fn: (...args: unknown[]) => T, ...args: unknown[]): Promise<T>

  /** Evaluate function with selector and return result ($eval pattern). */
  $eval<T>(selector: string, fn: (element: Element) => T): Promise<T>

  // ═══════════════════════════════════════════════════════════
  // ELEMENT INTERACTION
  // ═══════════════════════════════════════════════════════════

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
   * Type text into element matching selector.
   * @param options.delay - Delay between keystrokes in ms
   */
  type(selector: string, text: string, options?: { delay?: number }): Promise<void>

  /**
   * Query single element matching selector.
   * Returns null if not found.
   */
  $(selector: string): Promise<ElementHandleLike | null>

  // ═══════════════════════════════════════════════════════════
  // LOW-LEVEL MOUSE & KEYBOARD — For HumanInteractionService
  // ═══════════════════════════════════════════════════════════

  /** Low-level mouse control for Bezier movement simulation. */
  mouse: {
    move(x: number, y: number): Promise<void>
    down(): Promise<void>
    up(): Promise<void>
  }

  /** Low-level keyboard control for modifier key simulation. */
  keyboard: {
    down(key: string): Promise<void>
    press(key: string): Promise<void>
    up(key: string): Promise<void>
  }
}
