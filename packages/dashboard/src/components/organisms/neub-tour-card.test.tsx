import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { CardComponentProps } from 'nextstepjs'

import { NeubTourCard } from '~/components/organisms/neub-tour-card'

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
})
