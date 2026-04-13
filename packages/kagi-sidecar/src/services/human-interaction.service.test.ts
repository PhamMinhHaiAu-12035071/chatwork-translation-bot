import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import type { ElementHandleLike, PageLike } from '~/types/page.interface'
import { HumanInteractionService } from './human-interaction.service'

// Mock ghost-cursor — tests verify fallback paths, not ghost-cursor integration
void mock.module('ghost-cursor', () => ({
  createCursor: (_page: unknown) => ({
    move: mock(() => Promise.resolve()),
    click: mock(() => Promise.resolve()),
  }),
}))

// Mock @forad/puppeteer-humanize
void mock.module('@forad/puppeteer-humanize', () => ({
  typeInto: mock((_el: unknown, _text: string) => Promise.resolve()),
}))

const mockElementHandle: ElementHandleLike = {
  click: mock(() => Promise.resolve()),
}

function makePageLike(overrides: Partial<PageLike> = {}): PageLike {
  return {
    goto: mock(() => Promise.resolve(null)),
    waitForSelector: mock(() => Promise.resolve(mockElementHandle)),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    evaluate: mock((_fn: unknown, ..._args: unknown[]) => Promise.resolve(null)) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    $eval: mock(() => Promise.resolve(null)) as any,
    waitForFunction: mock(() => Promise.resolve()),
    click: mock(() => Promise.resolve()),
    focus: mock(() => Promise.resolve()),
    url: mock(() => 'https://translate.kagi.com/'),
    type: mock(() => Promise.resolve()),
    $: mock(() => Promise.resolve(null)),
    mouse: {
      move: mock(() => Promise.resolve()),
      down: mock(() => Promise.resolve()),
      up: mock(() => Promise.resolve()),
    },
    keyboard: {
      down: mock(() => Promise.resolve()),
      press: mock(() => Promise.resolve()),
      up: mock(() => Promise.resolve()),
    },
    ...overrides,
  }
}

describe('HumanInteractionService', () => {
  let service: HumanInteractionService

  beforeEach(() => {
    service = new HumanInteractionService()
  })

  describe('click', () => {
    it('falls back to page.click when bounding rect width is 0', async () => {
      const page = makePageLike({
        evaluate: mock(() => Promise.resolve({ width: 0, height: 0, top: 0, left: 0 })),
      })
      await service.click(page, '[aria-label="test"]')
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(page.click).toHaveBeenCalledWith('[aria-label="test"]')
    })

    it('falls back to page.click and logs warning on exception', async () => {
      const page = makePageLike({
        evaluate: mock(() => Promise.reject(new Error('evaluate failed'))),
      })
      const warnSpy = spyOn(console, 'warn')
      await service.click(page, '[aria-label="test"]')
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(page.click).toHaveBeenCalledWith('[aria-label="test"]')
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Degraded to standard click'))
      warnSpy.mockRestore()
    })
  })

  describe('clickByTextContent', () => {
    it('falls back to evaluate click when rect is invalid and logs warning', async () => {
      const page = makePageLike({
        evaluate: mock(() => Promise.resolve({ width: 0, height: 0, top: -1, left: -1 })),
      })
      const warnSpy = spyOn(console, 'warn')
      await service.clickByTextContent(page, 'span.flex-grow', 'Unknown', 0)
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Degraded to evaluate click'))
      warnSpy.mockRestore()
    })
  })

  describe('typeIntoTextarea', () => {
    it('falls back to page.type when element not found', async () => {
      const page = makePageLike({
        $: mock(() => Promise.resolve(null)),
      })
      const warnSpy = spyOn(console, 'warn')
      await service.typeIntoTextarea(page, 'textarea', 'hello')
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(page.type).toHaveBeenCalledWith('textarea', 'hello', { delay: 80 })
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Degraded to page.type'))
      warnSpy.mockRestore()
    })
  })

  describe('dragSlider', () => {
    it('falls back to evaluate set value when rect width is 0 and logs warning', async () => {
      const page = makePageLike({
        evaluate: mock(() => Promise.resolve({ width: 0, height: 0, left: 0, top: 0 })),
      })
      const warnSpy = spyOn(console, 'warn')
      await service.dragSlider(page, 'input[type="range"]', 0, 3)
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Degraded to evaluate set value for slider'),
      )
      warnSpy.mockRestore()
    })
  })

  describe('chunkPaste', () => {
    it('delegates to typeIntoContentEditable for short text (≤10 chars)', async () => {
      const page = makePageLike()
      const typeSpy = spyOn(service, 'typeIntoContentEditable').mockImplementation(() =>
        Promise.resolve(),
      )
      await service.chunkPaste(page, '[aria-label="Source"]', 'hi')
      expect(typeSpy).toHaveBeenCalledWith(page, '[aria-label="Source"]', 'hi')
      typeSpy.mockRestore()
    })

    it('uses keyboard.down for paste modifier on longer text', async () => {
      const page = makePageLike({
        evaluate: mock(() => Promise.resolve(undefined)),
        waitForFunction: mock(() => Promise.resolve()),
      })
      // Spy typeIntoContentEditable to avoid slow keystroke loop
      spyOn(service, 'typeIntoContentEditable').mockImplementation(() => Promise.resolve())
      const longText = 'a'.repeat(600)
      await service.chunkPaste(page, '[aria-label="Source"]', longText)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(page.keyboard.down).toHaveBeenCalled()
    })
  })
})
