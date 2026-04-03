import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { CardComponentProps } from 'nextstepjs'

import { NeubTourCard, resolveTourArrowPosition } from '~/components/organisms/neub-tour-card'

type TestStep = CardComponentProps['step'] & { color: string }

function renderCard(
  overrides: Partial<{
    currentStep: number
    totalSteps: number
    step: TestStep
  }> = {},
) {
  const props = {
    currentStep: 1,
    totalSteps: 3,
    step: {
      icon: null,
      selector: '#tour-target',
      title: 'Xin chao',
      content: 'Noi dung cua tour',
      showSkip: true,
      color: '#ffd166',
    },
    nextStep: () => undefined,
    prevStep: () => undefined,
    skipTour: () => undefined,
    arrow: null,
    ...overrides,
  } as unknown as CardComponentProps

  return renderToStaticMarkup(createElement(NeubTourCard, props))
}

describe('NeubTourCard', () => {
  it('places the tail on the bottom edge when the target sits below the card', () => {
    expect(
      resolveTourArrowPosition(
        { top: 40, right: 300, bottom: 220, left: 20 },
        { top: 340, right: 420, bottom: 460, left: 60 },
        'top',
      ),
    ).toBe('bottom')
  })

  it('renders the approved speech-bubble shell and badge text on middle steps', () => {
    const html = renderCard()

    expect(html).toContain('Xin chao')
    expect(html).toContain('background-color:#ffd166')
    expect(html).toContain('data-tour-tail-outer')
    expect(html).toContain('data-tour-step-badge')
    expect(html).toContain('Bước 2 / 3')
  })

  it('uses a dot progress row and a start button on the first step', () => {
    const html = renderCard({
      currentStep: 0,
      step: {
        icon: null,
        selector: '#tour-target',
        title: 'Xin chao',
        content: 'Noi dung cua tour',
        showSkip: true,
        color: '#ffd166',
      },
    })

    expect(html).not.toContain('data-tour-step-badge')
    expect(html).toContain('data-tour-progress-dots')
    expect(html).not.toContain('← Quay lại')
    expect(html).toContain('Bắt đầu →')
  })

  it('shows the compact badge plus previous and next buttons on a middle step', () => {
    const html = renderCard()

    expect(html).toContain('data-tour-step-badge')
    expect(html).toContain('← Quay lại')
    expect(html).toContain('Tiếp theo →')
    expect(html).not.toContain('data-tour-progress-dots')
  })

  it('renders the completion treatment on the last step', () => {
    const html = renderCard({
      currentStep: 2,
      step: {
        icon: null,
        selector: '#tour-target',
        title: 'Xin chao',
        content: 'Noi dung cua tour',
        showSkip: true,
        color: '#ffd166',
      },
    })

    expect(html).toContain('data-tour-completion')
    expect(html).not.toContain('Bỏ qua')
    expect(html).toContain('Hoàn thành ✓')
    expect(html).not.toContain('Tiếp theo →')
    expect(html).toContain('color:#86e8c0')
  })

  it('renders nothing when step is undefined (out-of-range tour index)', () => {
    const props = {
      currentStep: 0,
      totalSteps: 1,
      step: undefined,
      nextStep: () => undefined,
      prevStep: () => undefined,
      skipTour: () => undefined,
      arrow: null,
    } as unknown as CardComponentProps

    const html = renderToStaticMarkup(createElement(NeubTourCard, props))

    expect(html).toBe('')
  })

  it('does not maintain its own alternate backward-navigation state machine', async () => {
    const source = await Bun.file(new URL('./neub-tour-card.tsx', import.meta.url)).text()

    expect(source).not.toContain('tour:completion-back-to-rooms')
    expect(source).not.toContain('displayTotalSteps')
    expect(source).not.toContain('displayCurrentStep')
    expect(source).not.toContain('setHasRoom')
  })
})
