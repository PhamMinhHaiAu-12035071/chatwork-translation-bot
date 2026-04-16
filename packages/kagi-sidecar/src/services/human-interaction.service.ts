/**
 * Human-like interaction implementation for Playwright (patchright) Page.
 *
 * Behavior uses patchright locators, keyboard, and mouse with the same fallback patterns as before.
 */

import type { Page } from 'patchright'
import type { IHumanInteraction } from '~/types/human-interaction.interface'
import { HUMANIZER_CONFIG } from '~/constants/humanizer-config'
import {
  calculateCharDelay,
  getMistakeChar,
  getPauseAfterPunctuation,
  shouldAddHesitation,
  shouldMakeMistake,
} from '~/utils/humanizer-config'
import { type Point, generateNaturalBezierPath } from '~/utils/bezier'

/** Checks if bounding rect is valid (non-zero size, non-negative coords). Docker-safe guard. */
function isValidRect(rect: { width: number; height: number; top: number; left: number }): boolean {
  return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.left >= 0
}

/** Random integer in [min, max] inclusive */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/** Delay helper */
async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms))
}

const PUNCTUATION_CHARS = new Set(['.', ',', '!', '?', ';', ':'])

function getMouseApproachPoint(targetX: number, targetY: number): Point {
  const xOffset = randInt(
    HUMANIZER_CONFIG.MOUSE_PATH_OFFSET_MIN,
    HUMANIZER_CONFIG.MOUSE_PATH_OFFSET_MAX,
  )
  const yOffset = randInt(
    HUMANIZER_CONFIG.MOUSE_PATH_OFFSET_MIN,
    HUMANIZER_CONFIG.MOUSE_PATH_OFFSET_MAX,
  )
  const directionX = Math.random() < 0.5 ? -1 : 1
  const directionY = Math.random() < 0.5 ? -1 : 1

  return {
    x: targetX + xOffset * directionX,
    y: targetY + yOffset * directionY,
  }
}

async function moveMouseAlongBezierPath(
  page: Page,
  targetX: number,
  targetY: number,
): Promise<void> {
  const start = getMouseApproachPoint(targetX, targetY)
  const destination: Point = {
    x: targetX + randInt(-2, 2),
    y: targetY + randInt(-2, 2),
  }
  const path: Point[] = generateNaturalBezierPath(
    start,
    destination,
    shouldAddHesitation(HUMANIZER_CONFIG.MOUSE_OVERSHOOT_CHANCE),
  )
  for (const point of path) {
    await page.mouse.move(point.x, point.y)
    if (shouldAddHesitation(HUMANIZER_CONFIG.HESITATION_PROBABILITY)) {
      await sleep(
        randInt(
          HUMANIZER_CONFIG.MOUSE_STEP_DELAY_MS.minMs,
          HUMANIZER_CONFIG.MOUSE_STEP_DELAY_MS.maxMs,
        ),
      )
    }
  }
}

/** Detects modifier key for paste shortcut */
const PASTE_MODIFIER = process.platform === 'darwin' ? 'Meta' : 'Control'

export class HumanInteractionService implements IHumanInteraction {
  async click(page: Page, selector: string): Promise<void> {
    try {
      const rect = await page.evaluate((sel: string) => {
        const el = document.querySelector(sel)
        if (!el) return { width: 0, height: 0, top: -1, left: -1 }
        const r = el.getBoundingClientRect()
        return { width: r.width, height: r.height, top: r.top, left: r.left }
      }, selector)

      if (!isValidRect(rect)) {
        await page.click(selector)
        return
      }

      const centerX = rect.left + rect.width / 2 + randInt(-3, 3)
      const centerY = rect.top + rect.height / 2 + randInt(-3, 3)
      await moveMouseAlongBezierPath(page, centerX, centerY)
      await page.mouse.click(centerX, centerY)
    } catch {
      console.warn(`⚠️ Degraded to standard click: ${selector}`)
      await page.click(selector)
    }
  }

  async clickByTextContent(
    page: Page,
    spanSelector: string,
    text: string,
    matchIndex: number,
  ): Promise<void> {
    try {
      const rect = await page.evaluate(
        (box: { sel: string; targetText: string; idx: number }) => {
          const { sel, targetText, idx } = box
          const spans = Array.from(document.querySelectorAll<HTMLElement>(sel))
          const matches = spans.filter((el) => el.textContent?.trim() === targetText)
          const el = matches[idx]
          if (!el) return { width: 0, height: 0, top: -1, left: -1 }
          const btn = el.closest('button')
          if (!btn) return { width: 0, height: 0, top: -1, left: -1 }
          const r = btn.getBoundingClientRect()
          return { width: r.width, height: r.height, top: r.top, left: r.left }
        },
        { sel: spanSelector, targetText: text, idx: matchIndex },
      )

      if (!isValidRect(rect)) {
        await page.evaluate(
          (box: { sel: string; targetText: string; idx: number }) => {
            const { sel, targetText, idx } = box
            const spans = Array.from(document.querySelectorAll<HTMLElement>(sel))
            const matches = spans.filter((el) => el.textContent?.trim() === targetText)
            const el = matches[idx]
            const btn = el?.closest('button')
            btn?.click()
          },
          { sel: spanSelector, targetText: text, idx: matchIndex },
        )
        console.warn(`⚠️ Degraded to evaluate click: "${text}" at index ${matchIndex}`)
        return
      }

      const centerX = rect.left + rect.width / 2 + randInt(-3, 3)
      const centerY = rect.top + rect.height / 2 + randInt(-3, 3)
      await moveMouseAlongBezierPath(page, centerX, centerY)
      await page.mouse.down()
      await sleep(randInt(40, 120))
      await page.mouse.up()
    } catch {
      console.warn(`⚠️ Degraded to evaluate click: "${text}"`)
      await page.evaluate(
        (box: { sel: string; targetText: string; idx: number }) => {
          const { sel, targetText, idx } = box
          const spans = Array.from(document.querySelectorAll<HTMLElement>(sel))
          const matches = spans.filter((el) => el.textContent?.trim() === targetText)
          const el = matches[idx]
          el?.closest('button')?.click()
        },
        { sel: spanSelector, targetText: text, idx: matchIndex },
      )
    }
  }

  async typeIntoTextarea(page: Page, selector: string, text: string): Promise<void> {
    // Kagi may mount two identical context textareas (e.g. responsive duplicate); strict mode needs one target.
    const box = page.locator(selector).first()
    try {
      await box.pressSequentially(text, { delay: 80 })
    } catch {
      console.warn(`⚠️ Degraded to fill() for textarea: ${selector}`)
      await box.fill(text)
    }
  }

  async typeIntoContentEditable(page: Page, selector: string, text: string): Promise<void> {
    try {
      const editable = page.locator(selector).first()

      let offset = 0
      while (offset < text.length) {
        const remaining = text.length - offset
        const burstMin = Math.min(HUMANIZER_CONFIG.TYPING_BURST_MIN, remaining)
        const burstMax = Math.min(HUMANIZER_CONFIG.TYPING_BURST_MAX, remaining)
        const burstLength = randInt(burstMin, burstMax)
        const burst = text.slice(offset, offset + burstLength)
        const charDelay = calculateCharDelay()

        await editable.pressSequentially(burst, { delay: charDelay })

        if (shouldMakeMistake(HUMANIZER_CONFIG.MISTAKE_RATE) && burst.length > 0) {
          const targetChar = burst.at(-1)
          if (targetChar !== undefined) {
            const typoChar = getMistakeChar(targetChar)
            if (typoChar !== targetChar) {
              await editable.pressSequentially(typoChar, { delay: calculateCharDelay() })
              await sleep(
                randInt(
                  HUMANIZER_CONFIG.TYPING_MISTAKE_PAUSE_MS.minMs,
                  HUMANIZER_CONFIG.TYPING_MISTAKE_PAUSE_MS.maxMs,
                ),
              )
              await page.keyboard.press('Backspace')
              await editable.pressSequentially(targetChar, { delay: calculateCharDelay() })
            }
          }
        }

        for (const char of burst) {
          if (PUNCTUATION_CHARS.has(char)) {
            const pause = getPauseAfterPunctuation(char)
            if (pause > 0) {
              await sleep(pause)
            }
          }
        }

        if (shouldAddHesitation(HUMANIZER_CONFIG.TYPING_BURST_HESITATION_PROBABILITY)) {
          await sleep(
            randInt(
              HUMANIZER_CONFIG.TYPING_BURST_HESITATION_MS.minMs,
              HUMANIZER_CONFIG.TYPING_BURST_HESITATION_MS.maxMs,
            ),
          )
        }

        offset += burstLength
      }
    } catch {
      console.warn(`⚠️ Degraded to execCommand insertText: ${selector}`)
      await page.evaluate(
        (box: { sel: string; value: string }) => {
          const { sel, value } = box
          const el = document.querySelector(sel) as HTMLElement | null
          if (!el) return
          el.focus()
          /* eslint-disable-next-line @typescript-eslint/no-deprecated */
          document.execCommand('insertText', false, value)
        },
        { sel: selector, value: text },
      )
    }
  }

  async dragSlider(
    page: Page,
    sliderSelector: string,
    fromStep: number,
    toStep: number,
  ): Promise<void> {
    try {
      // Modal + small Xvfb viewports often leave the range below the fold; hit-testing then fails in Docker.
      await page.locator(sliderSelector).first().scrollIntoViewIfNeeded()
      await sleep(300)

      const rect: {
        width: number
        height: number
        left: number
        top: number
      } = await page.evaluate((sel: string) => {
        for (const slider of Array.from(document.querySelectorAll<HTMLInputElement>(sel))) {
          const r = slider.getBoundingClientRect()
          if (r.width > 0 && r.height > 0) {
            return { width: r.width, height: r.height, left: r.left, top: r.top }
          }
        }
        return { width: 0, height: 0, left: 0, top: 0 }
      }, sliderSelector)

      if (!isValidRect(rect) || rect.width === 0) {
        await page.evaluate(
          (box: { sel: string; nextValue: number }) => {
            const { sel, nextValue } = box
            let slider: HTMLInputElement | null = null
            for (const el of Array.from(document.querySelectorAll<HTMLInputElement>(sel))) {
              const r = el.getBoundingClientRect()
              if (r.width > 0 && r.height > 0) {
                slider = el
                break
              }
            }
            if (!slider) return
            slider.focus()
            slider.value = String(nextValue)
            slider.style.setProperty('--slider-position', String(nextValue))
            slider.dispatchEvent(new Event('input', { bubbles: true }))
            slider.dispatchEvent(new Event('change', { bubbles: true }))
          },
          { sel: sliderSelector, nextValue: toStep },
        )
        console.warn(`⚠️ Degraded to evaluate set value for slider: step ${toStep}`)
        return
      }

      const maxSteps = 6
      const fromX = rect.left + (fromStep / maxSteps) * rect.width
      const toX = rect.left + (toStep / maxSteps) * rect.width
      const y = rect.top + rect.height / 2

      await page.mouse.move(fromX, y)
      await page.mouse.down()
      await sleep(randInt(50, 150))
      const steps = 10
      for (let i = 1; i <= steps; i++) {
        const x = fromX + ((toX - fromX) * i) / steps
        await page.mouse.move(x, y + randInt(-2, 2))
        await sleep(randInt(10, 30))
      }
      await page.mouse.up()
    } catch {
      console.warn(`⚠️ Degraded to evaluate set value for slider: step ${toStep}`)
      await page.evaluate(
        (box: { sel: string; nextValue: number }) => {
          const { sel, nextValue } = box
          let slider: HTMLInputElement | null = null
          for (const el of Array.from(document.querySelectorAll<HTMLInputElement>(sel))) {
            const r = el.getBoundingClientRect()
            if (r.width > 0 && r.height > 0) {
              slider = el
              break
            }
          }
          if (!slider) return
          slider.focus()
          slider.value = String(nextValue)
          slider.dispatchEvent(new Event('input', { bubbles: true }))
          slider.dispatchEvent(new Event('change', { bubbles: true }))
        },
        { sel: sliderSelector, nextValue: toStep },
      )
    }
  }

  async chunkPaste(page: Page, selector: string, text: string): Promise<void> {
    if (text.length <= 10) {
      await this.typeIntoContentEditable(page, selector, text)
      return
    }

    const CHUNK_MIN = 500
    const CHUNK_MAX = 2_000
    const TAIL_CHARS = randInt(3, 5)

    const body = text.slice(0, text.length - TAIL_CHARS)
    const tail = text.slice(text.length - TAIL_CHARS)

    await page.click(selector)
    await page.focus(selector)

    await page.waitForFunction(
      (sel: string) => document.activeElement?.matches(sel) ?? false,
      selector,
      { timeout: 3000 },
    )

    let offset = 0
    while (offset < body.length) {
      const chunkSize = Math.min(randInt(CHUNK_MIN, CHUNK_MAX), body.length - offset)
      const chunk = body.slice(offset, offset + chunkSize)
      offset += chunkSize

      await page.evaluate((t: string) => {
        return navigator.clipboard.writeText(t)
      }, chunk)

      await page.keyboard.down(PASTE_MODIFIER)
      await page.keyboard.press('v')
      await page.keyboard.up(PASTE_MODIFIER)

      await sleep(randInt(200, 800))
    }

    await this.typeIntoContentEditable(page, selector, tail)
  }
}
