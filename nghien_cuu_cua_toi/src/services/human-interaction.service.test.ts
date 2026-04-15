import { describe, it, expect, mock } from 'bun:test'
import { HumanInteractionService } from '~/services/human-interaction.service'

interface LocatorStub {
  pressSequentially: ReturnType<typeof mock>
  fill: ReturnType<typeof mock>
  scrollIntoViewIfNeeded: ReturnType<typeof mock>
  first: () => LocatorStub
}

/** Playwright-style locator stub (chain: locator().first().pressSequentially / fill). */
function createLocatorStub(): LocatorStub {
  const stub: LocatorStub = {
    pressSequentially: mock(async () => {}),
    fill: mock(async () => {}),
    scrollIntoViewIfNeeded: mock(async () => {}),
    first() {
      return stub
    },
  }
  return stub
}

// Minimal mock page — only methods used by HumanInteractionService
function createMockPage(overrides: Record<string, unknown> = {}) {
  return {
    click: mock(async (_selector?: string) => {}),
    focus: mock(async () => {}),
    locator: mock((_selector: string) => createLocatorStub()),
    type: mock(async (_selector: string, _text: string, _opts?: unknown) => {}),
    evaluate: mock(async (_fn: unknown, ..._args: unknown[]) => undefined as unknown),
    waitForSelector: mock(async (_selector: string, _opts?: unknown) => null),
    waitForFunction: mock(async (_fn: unknown, ..._args: unknown[]) => null),
    $: mock(async (_selector: string) => null),
    keyboard: {
      down: mock(async (_key: string) => {}),
      press: mock(async (_key: string) => {}),
      up: mock(async (_key: string) => {}),
    },
    mouse: {
      move: mock(async (_x: number, _y: number) => {}),
      click: mock(async (_x: number, _y: number) => {}),
      down: mock(async () => {}),
      up: mock(async () => {}),
    },
    ...overrides,
  }
}

function withMockRandom<T>(values: number[], action: () => Promise<T>): Promise<T> {
  const originalRandom = Math.random
  let index = 0
  Math.random = () => {
    const value = values[index % values.length]
    index += 1
    return value
  }

  return action().finally(() => {
    Math.random = originalRandom
  })
}

describe('HumanInteractionService', () => {
  describe('click()', () => {
    it('should move mouse along path before clicking', async () => {
      const service = new HumanInteractionService()
      const actionLog: string[] = []
      const page = createMockPage({
        evaluate: mock(async () => ({ width: 24, height: 24, top: 10, left: 12 })),
        mouse: {
          move: mock(async () => {
            actionLog.push('move')
          }),
          click: mock(async () => {
            actionLog.push('click')
          }),
          down: mock(async () => {
            actionLog.push('down')
          }),
          up: mock(async () => {
            actionLog.push('up')
          }),
        },
      })

      await service.click(page as never, 'button[aria-label="Translation Settings"]')

      expect(actionLog).toContain('move')
      expect(actionLog).toContain('click')
      expect(actionLog.indexOf('move')).toBeLessThan(actionLog.indexOf('click'))
    })

    it('should move mouse along curved path in clickByTextContent', async () => {
      const service = new HumanInteractionService()
      const actionLog: string[] = []
      const page = createMockPage({
        evaluate: mock(async (_selector: string) => ({ width: 24, height: 24, top: 10, left: 12 })),
        mouse: {
          move: mock(async () => {
            actionLog.push('move')
          }),
          click: mock(async () => {}),
          down: mock(async () => {
            actionLog.push('down')
          }),
          up: mock(async () => {
            actionLog.push('up')
          }),
        },
      })

      await service.clickByTextContent(page as never, 'span.option', 'Natural', 0)

      expect(actionLog).toContain('move')
      expect(actionLog.indexOf('move')).toBeLessThan(actionLog.indexOf('down'))
      expect(actionLog).toContain('down')
      expect(actionLog).toContain('up')
    })

    it('should fallback to page.click() when bounding rect width is 0 (Docker)', async () => {
      const service = new HumanInteractionService()
      const page = createMockPage({
        evaluate: mock(async () => ({ width: 0, height: 0, top: 0, left: 0 })),
      })

      await service.click(page as never, 'button[aria-label="Translation Settings"]')

      expect(page.click).toHaveBeenCalledWith('button[aria-label="Translation Settings"]')
    })

    it('should fallback to page.click() when evaluate throws', async () => {
      const service = new HumanInteractionService()
      const page = createMockPage({
        evaluate: mock(async () => {
          throw new Error('evaluate failed')
        }),
      })

      await expect(service.click(page as never, '.some-button')).resolves.toBeUndefined()
      expect(page.click).toHaveBeenCalledWith('.some-button')
    })
  })

  describe('typeIntoContentEditable()', () => {
    it('should type in random bursts via locator.pressSequentially with varied delays', async () => {
      const service = new HumanInteractionService()
      const page = createMockPage()
      const stub = createLocatorStub()
      ;(page.locator as ReturnType<typeof mock>).mockImplementation(() => stub)

      await withMockRandom(
        [0.2, 0.55, 0.25, 0.75, 0.4, 0.65, 0.35, 0.85, 0.45, 0.15, 0.6, 0.9, 0.35],
        () =>
          service.typeIntoContentEditable(
            page as never,
            '[aria-label="Source text input"]',
            'Quick typed burst behavior check',
          ),
      )

      const calls = stub.pressSequentially.mock.calls
      const delays = calls
        .map((entry) => entry[1])
        .filter((entry) => entry && typeof entry === 'object' && 'delay' in entry)
        .map((entry) => (entry as { delay: number }).delay)
      expect(calls.length).toBeGreaterThan(1)
      expect(stub.pressSequentially).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        expect.objectContaining({ delay: expect.any(Number) }),
      )
      expect(new Set(delays).size).toBeGreaterThan(1)
      expect(calls.some((entry) => typeof entry[0] === 'string' && entry[0].length > 1)).toBe(true)
    })

    it('should occasionally execute typo recovery via Backspace', async () => {
      const service = new HumanInteractionService()
      const page = createMockPage()
      const stub = createLocatorStub()
      ;(page.locator as ReturnType<typeof mock>).mockImplementation(() => stub)

      await expect(
        withMockRandom([0, 0.7, 0.7, 0.7, 0.7], () =>
          service.typeIntoContentEditable(
            page as never,
            '[aria-label="Source text input"]',
            'typo check',
          ),
        ),
      ).resolves.toBeUndefined()

      expect(page.keyboard.press).toHaveBeenCalledWith('Backspace')
    })
  })

  describe('chunkPaste()', () => {
    it('should call Clipboard API via evaluate and keyboard shortcuts', async () => {
      const service = new HumanInteractionService()
      const evaluateCalls: unknown[] = []
      const page = createMockPage({
        evaluate: mock(async (fn: unknown, ...args: unknown[]) => {
          evaluateCalls.push({ fn: fn?.toString().slice(0, 50), args })
          return undefined
        }),
        type: mock(async () => {}),
      })

      await service.chunkPaste(page as never, '[aria-label="Source text input"]', 'Hello World')

      expect(page.keyboard.down).toHaveBeenCalled()
      expect(page.keyboard.press).toHaveBeenCalledWith('v')
      expect(page.keyboard.up).toHaveBeenCalled()
    })

    it('should type last 3-5 chars via typeIntoContentEditable for small text', async () => {
      const service = new HumanInteractionService()
      const page = createMockPage()
      const stub = createLocatorStub()
      ;(page.locator as ReturnType<typeof mock>).mockImplementation(() => stub)

      await service.chunkPaste(page as never, '[aria-label="Source text input"]', 'Hi')

      expect(stub.pressSequentially).toHaveBeenCalled()
    })
  })

  describe('dragSlider()', () => {
    it('should fallback to evaluate set value when slider rect width is 0 (Docker)', async () => {
      const service = new HumanInteractionService()
      let evaluateCallCount = 0
      const page = createMockPage({
        evaluate: mock(async () => {
          evaluateCallCount++
          if (evaluateCallCount === 1) {
            return { width: 0, height: 0, left: 0, top: 0 }
          }
          return true
        }),
      })

      await service.dragSlider(page as never, 'input[type="range"]', 0, 3)

      expect(evaluateCallCount).toBe(2)
    })
  })
})
