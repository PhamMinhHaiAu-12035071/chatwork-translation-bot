/**
 * Human-like DOM interaction surface used by KagiBrowserService.
 * Mirrors nghien_cuu_cua_toi/src/services/interfaces/human-interaction.interface.ts.
 */

import type { Page } from 'patchright'

export interface IHumanInteraction {
  click(page: Page, selector: string): Promise<void>

  clickByTextContent(
    page: Page,
    spanSelector: string,
    text: string,
    matchIndex: number,
  ): Promise<void>

  typeIntoTextarea(page: Page, selector: string, text: string): Promise<void>

  typeIntoContentEditable(page: Page, selector: string, text: string): Promise<void>

  dragSlider(page: Page, sliderSelector: string, fromStep: number, toStep: number): Promise<void>

  chunkPaste(page: Page, selector: string, text: string): Promise<void>
}
