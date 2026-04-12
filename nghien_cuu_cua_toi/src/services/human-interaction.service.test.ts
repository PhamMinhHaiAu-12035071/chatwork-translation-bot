import { describe, it, expect, mock } from 'bun:test'
import { HumanInteractionService } from '~/services/human-interaction.service'

// Minimal mock page — only methods used by HumanInteractionService
function createMockPage(overrides: Record<string, unknown> = {}) {
  return {
    click: mock(async (_selector?: string) => {}),
    focus: mock(async () => {}),
    type: mock(async (_selector: string, _text: string, _opts?: unknown) => {}),
    evaluate: mock(async (_fn: unknown, ..._args: unknown[]) => undefined as unknown),
    waitForSelector: mock(async (_selector: string, _opts?: unknown) => null),
    $: mock(async (_selector: string) => null),
    keyboard: {
      down: mock(async (_key: string) => {}),
      press: mock(async (_key: string) => {}),
      up: mock(async (_key: string) => {}),
    },
    mouse: {
      move: mock(async (_x: number, _y: number) => {}),
      down: mock(async () => {}),
      up: mock(async () => {}),
    },
    ...overrides,
  }
}

describe('HumanInteractionService', () => {
  describe('click()', () => {
    it('should fallback to page.click() when bounding rect width is 0 (Docker)', async () => {
      const service = new HumanInteractionService()
      const page = createMockPage({
        evaluate: mock(async () => ({ width: 0, height: 0, top: 0, left: 0 })),
      })

      await service.click(page as never, 'button[aria-label="Translation Settings"]')

      expect(page.click).toHaveBeenCalledWith('button[aria-label="Translation Settings"]')
    })

    it('should fallback to page.click() when evaluate throws (ghost-cursor error)', async () => {
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
    it('should call page.type() per character with delay option', async () => {
      const service = new HumanInteractionService()
      const page = createMockPage()

      await service.typeIntoContentEditable(
        page as never,
        '[aria-label="Source text input"]',
        'hello',
      )

      expect(page.type).toHaveBeenCalledTimes(5)
      expect(page.type).toHaveBeenNthCalledWith(
        1,
        '[aria-label="Source text input"]',
        'h',
        expect.objectContaining({ delay: expect.any(Number) }),
      )
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

      await service.chunkPaste(page as never, '[aria-label="Source text input"]', 'Hi')

      expect(page.type).toHaveBeenCalled()
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
