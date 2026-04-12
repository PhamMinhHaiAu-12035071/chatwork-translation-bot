/**
 * Human-like interaction implementation using ghost-cursor and @forad/puppeteer-humanize.
 *
 * All methods degrade gracefully when ghost-cursor fails (e.g., Docker/Xvfb with
 * bounding rect width=0). Fallback path uses standard Puppeteer APIs and logs a warning.
 */

import type { Page } from 'puppeteer-core'
import type { IHumanInteraction } from '~/services/interfaces/human-interaction.interface'

// eslint-disable-next-line @typescript-eslint/no-require-imports -- ghost-cursor has incomplete types for puppeteer-core Page
const { createCursor } = require('ghost-cursor') as {
  createCursor: (page: unknown) => {
    move: (sel: string) => Promise<void>
    click: (sel: string) => Promise<void>
  }
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- scoped package, runtime require matches plan
const { typeInto } = require('@forad/puppeteer-humanize') as {
  typeInto: (el: unknown, text: string, opts?: Record<string, unknown>) => Promise<void>
}

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

      const cursor = createCursor(page as unknown)
      await cursor.move(selector)
      await cursor.click(selector)
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
        (sel: string, targetText: string, idx: number) => {
          const spans = Array.from(document.querySelectorAll<HTMLElement>(sel))
          const matches = spans.filter((el) => el.textContent?.trim() === targetText)
          const el = matches[idx]
          if (!el) return { width: 0, height: 0, top: -1, left: -1 }
          const btn = el.closest('button')
          if (!btn) return { width: 0, height: 0, top: -1, left: -1 }
          const r = btn.getBoundingClientRect()
          return { width: r.width, height: r.height, top: r.top, left: r.left }
        },
        spanSelector,
        text,
        matchIndex,
      )

      if (!isValidRect(rect)) {
        await page.evaluate(
          (sel: string, targetText: string, idx: number) => {
            const spans = Array.from(document.querySelectorAll<HTMLElement>(sel))
            const matches = spans.filter((el) => el.textContent?.trim() === targetText)
            const el = matches[idx]
            const btn = el?.closest('button')
            btn?.click()
          },
          spanSelector,
          text,
          matchIndex,
        )
        console.warn(`⚠️ Degraded to evaluate click: "${text}" at index ${matchIndex}`)
        return
      }

      const centerX = rect.left + rect.width / 2 + randInt(-3, 3)
      const centerY = rect.top + rect.height / 2 + randInt(-3, 3)
      await page.mouse.move(centerX, centerY)
      await page.mouse.down()
      await sleep(randInt(40, 120))
      await page.mouse.up()
    } catch {
      console.warn(`⚠️ Degraded to evaluate click: "${text}"`)
      await page.evaluate(
        (sel: string, targetText: string, idx: number) => {
          const spans = Array.from(document.querySelectorAll<HTMLElement>(sel))
          const matches = spans.filter((el) => el.textContent?.trim() === targetText)
          const el = matches[idx]
          el?.closest('button')?.click()
        },
        spanSelector,
        text,
        matchIndex,
      )
    }
  }

  async typeIntoTextarea(page: Page, selector: string, text: string): Promise<void> {
    try {
      const handle = await page.$(selector)
      if (!handle) throw new Error(`Element not found: ${selector}`)
      await typeInto(handle, text, { mistakes: { chance: 3, delay: { min: 50, max: 150 } } })
    } catch {
      console.warn(`⚠️ Degraded to page.type() for textarea: ${selector}`)
      await page.type(selector, text, { delay: 80 })
    }
  }

  async typeIntoContentEditable(page: Page, selector: string, text: string): Promise<void> {
    try {
      const PUNCTUATION = new Set(['.', ',', '!', '?', ';', ':'])
      for (const char of text) {
        const delay = randInt(50, 150)
        await page.type(selector, char, { delay })
        if (PUNCTUATION.has(char)) {
          await sleep(randInt(100, 300))
        }
      }
    } catch {
      console.warn(`⚠️ Degraded to execCommand insertText: ${selector}`)
      await page.evaluate(
        (sel: string, value: string) => {
          const el = document.querySelector(sel) as HTMLElement | null
          if (!el) return
          el.focus()
          /* eslint-disable-next-line @typescript-eslint/no-deprecated */
          document.execCommand('insertText', false, value)
        },
        selector,
        text,
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
      const rect = await page.evaluate((sel: string) => {
        const slider = document.querySelector<HTMLInputElement>(sel)
        if (!slider) return { width: 0, height: 0, left: 0, top: 0 }
        const r = slider.getBoundingClientRect()
        return { width: r.width, height: r.height, left: r.left, top: r.top }
      }, sliderSelector)

      if (!isValidRect(rect) || rect.width === 0) {
        await page.evaluate(
          (sel: string, nextValue: number) => {
            const slider = document.querySelector<HTMLInputElement>(sel)
            if (!slider) return
            slider.focus()
            slider.value = String(nextValue)
            slider.style.setProperty('--slider-position', String(nextValue))
            slider.dispatchEvent(new Event('input', { bubbles: true }))
            slider.dispatchEvent(new Event('change', { bubbles: true }))
          },
          sliderSelector,
          toStep,
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
        (sel: string, nextValue: number) => {
          const slider = document.querySelector<HTMLInputElement>(sel)
          if (!slider) return
          slider.focus()
          slider.value = String(nextValue)
          slider.dispatchEvent(new Event('input', { bubbles: true }))
          slider.dispatchEvent(new Event('change', { bubbles: true }))
        },
        sliderSelector,
        toStep,
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

    // Verify element is focused before clipboard operations
    await page.waitForFunction(
      (sel: string) => document.activeElement?.matches(sel) ?? false,
      { timeout: 3000 },
      selector,
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
