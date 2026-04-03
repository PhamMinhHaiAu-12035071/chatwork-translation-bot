import { useLayoutEffect, useState } from 'react'
import type { CardComponentProps } from 'nextstepjs'

import type { NeubStep } from '~/lib/tour-steps'
import { useRoomStore, selectRooms } from '~/stores/room-store'

type TourArrowPosition = 'top' | 'bottom' | 'left' | 'right'

interface RectLike {
  top: number
  right: number
  bottom: number
  left: number
}

function getFallbackArrowPosition(side: NeubStep['side']): TourArrowPosition {
  switch (side) {
    case 'bottom':
      return 'top'
    case 'right':
      return 'left'
    case 'left':
      return 'right'
    case 'top':
      return 'bottom'
    default:
      return 'bottom'
  }
}

export function resolveTourArrowPosition(
  cardRect: RectLike,
  targetRect: RectLike,
  fallback: TourArrowPosition,
): TourArrowPosition {
  const cardCenterX = (cardRect.left + cardRect.right) / 2
  const cardCenterY = (cardRect.top + cardRect.bottom) / 2
  const targetCenterX = (targetRect.left + targetRect.right) / 2
  const targetCenterY = (targetRect.top + targetRect.bottom) / 2
  const deltaX = targetCenterX - cardCenterX
  const deltaY = targetCenterY - cardCenterY

  if (deltaX === 0 && deltaY === 0) {
    return fallback
  }

  if (Math.abs(deltaY) >= Math.abs(deltaX)) {
    return deltaY >= 0 ? 'bottom' : 'top'
  }

  return deltaX >= 0 ? 'right' : 'left'
}

// Replicates nextstepjs's checkSideCutOff to determine where the card actually lands
// after nextstepjs flips the side when the target is too close to a viewport edge.
function resolveActualSide(side: NeubStep['side'], targetElement: Element): NeubStep['side'] {
  if (!side) return side
  const rect = targetElement.getBoundingClientRect()
  const bodyRect = document.body.getBoundingClientRect()
  const relY = rect.top - bodyRect.top + document.body.scrollTop
  const relX = rect.left - bodyRect.left + document.body.scrollLeft
  const sh = document.body.scrollHeight
  const sw = document.body.scrollWidth
  let tempSide: NeubStep['side'] = side
  let removeSide = false
  if (side.startsWith('right') && sw < relX + rect.width + 256) {
    removeSide = true
  } else if (side.startsWith('left') && relX < 256) {
    removeSide = true
  }
  if (side.includes('top') && relY < 256) {
    tempSide = removeSide ? 'bottom' : (side.replace('top', 'bottom') as NeubStep['side'])
  } else if (side.includes('bottom') && relY + rect.height + 256 > sh) {
    tempSide = removeSide ? 'top' : (side.replace('bottom', 'top') as NeubStep['side'])
  } else if (removeSide) {
    tempSide = relY < 256 ? 'bottom' : 'top'
  }
  return tempSide
}

export function NeubTourCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  skipTour,
  arrow: _arrow,
}: CardComponentProps) {
  // nextstepjs can briefly pass an out-of-range index; step is then undefined at runtime.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- CardComponentProps.step is typed as required
  if (step == null) {
    return null
  }

  const coloredStep = step as NeubStep
  const stepColor = coloredStep.color
  const hasRooms = useRoomStore(selectRooms).length > 0
  // Steps at indices 17–20 (UI steps 18–21) require room cards to exist.
  // When the dashboard is empty these are skipped; compress the visible counter.
  const SKIPPABLE_STEP_COUNT = 4
  const ROOM_STEPS_START_INDEX = 17
  const visibleTotal =
    !hasRooms && totalSteps > SKIPPABLE_STEP_COUNT ? totalSteps - SKIPPABLE_STEP_COUNT : totalSteps
  const visibleCurrent =
    hasRooms || currentStep < ROOM_STEPS_START_INDEX
      ? currentStep + 1
      : currentStep + 1 - SKIPPABLE_STEP_COUNT
  const isFirst = currentStep === 0
  const isLast = currentStep === totalSteps - 1
  const isCompletionStep = isLast
  const textColor = isCompletionStep ? '#fff' : '#1a1a2e'
  const bodyTextColor = isCompletionStep ? 'rgba(255,255,255,0.92)' : '#2a2a3e'
  const primaryButtonColor = isCompletionStep ? '#86e8c0' : stepColor
  const [arrowPosition, setArrowPosition] = useState<TourArrowPosition>(
    getFallbackArrowPosition(coloredStep.side),
  )

  // Override nextStep to expand sections BEFORE navigation
  const handleNextStep = () => {
    // Last step: Complete tour instead of calling nextStep
    // (prevents wrapping around to step 0)
    if (isLast && skipTour) {
      skipTour()
      return
    }

    // Step 13 → 14: Expand Translation Context before showing step 14
    if (currentStep === 12) {
      const contextWrapper = document.querySelector('#tour-field-context')
      if (contextWrapper) {
        const triggerButton = contextWrapper.querySelector('button')
        const isAlreadyOpen = document.querySelector('#tour-context-templates') !== null
        if (triggerButton && !isAlreadyOpen) {
          triggerButton.click()
          // Wait for expand animation (300ms) + spring animations + buffer
          setTimeout(() => {
            // Trigger resize to force nextstepjs recalculate
            window.dispatchEvent(new Event('resize'))
            // Add buffer for recalculation before navigating
            setTimeout(() => {
              nextStep()
            }, 200)
          }, 550)
          return
        }
      }
    }

    // Step 14 → 15: Expand Keyword Protection before showing step 15
    if (currentStep === 14) {
      const keywordWrapper = document.querySelector('#tour-field-keywords')
      if (keywordWrapper) {
        const triggerButton = keywordWrapper.querySelector('button')
        const isAlreadyOpen = document.querySelector('#tour-keyword-addform') !== null
        if (triggerButton && !isAlreadyOpen) {
          triggerButton.click()
          // Wait for expand animation (300ms) + spring animations + buffer
          setTimeout(() => {
            // Trigger resize to force nextstepjs recalculate
            window.dispatchEvent(new Event('resize'))
            // Add buffer for recalculation before navigating
            setTimeout(() => {
              nextStep()
            }, 100)
          }, 500)
          return
        }
      }
    }

    // Default: navigate immediately
    nextStep()
  }

  // Override prevStep to expand collapsed sections BEFORE navigating backward
  const handlePrevStep = () => {
    // Step 17 → 16: Keyword Protection must be expanded for #tour-keyword-addform
    if (currentStep === 16) {
      const keywordWrapper = document.querySelector('#tour-field-keywords')
      if (keywordWrapper) {
        const triggerButton = keywordWrapper.querySelector('button')
        const isAlreadyOpen = document.querySelector('#tour-keyword-addform') !== null
        if (triggerButton && !isAlreadyOpen) {
          triggerButton.click()
          setTimeout(() => {
            window.dispatchEvent(new Event('resize'))
            setTimeout(() => {
              prevStep()
            }, 200)
          }, 550)
          return
        }
      }
    }

    // Step 15 → 14: Translation Context must be expanded for #tour-context-templates
    if (currentStep === 14) {
      const contextWrapper = document.querySelector('#tour-field-context')
      if (contextWrapper) {
        const triggerButton = contextWrapper.querySelector('button')
        const isAlreadyOpen = document.querySelector('#tour-context-templates') !== null
        if (triggerButton && !isAlreadyOpen) {
          triggerButton.click()
          setTimeout(() => {
            window.dispatchEvent(new Event('resize'))
            setTimeout(() => {
              prevStep()
            }, 200)
          }, 550)
          return
        }
      }
    }

    prevStep()
  }

  const shouldShowArrow = Boolean(step.selector)

  useLayoutEffect(() => {
    const computeArrowPosition = () => {
      const fallback = getFallbackArrowPosition(coloredStep.side)
      if (!step.selector) {
        setArrowPosition(fallback)
        return
      }
      const targetEl = document.querySelector(step.selector)
      if (!(targetEl instanceof HTMLElement)) {
        setArrowPosition(fallback)
        return
      }
      const actualSide = resolveActualSide(coloredStep.side, targetEl)
      setArrowPosition(getFallbackArrowPosition(actualSide))
    }

    computeArrowPosition()

    if (!shouldShowArrow) return

    window.addEventListener('resize', computeArrowPosition)
    return () => {
      window.removeEventListener('resize', computeArrowPosition)
    }
  }, [coloredStep.side, currentStep, shouldShowArrow, step.selector])

  return (
    <div
      data-tour-completion={isCompletionStep || undefined}
      style={{
        position: 'relative',
        width: 280,
        border: '3px solid #1a1a2e',
        borderRadius: 18,
        boxShadow: '5px 5px 0 #1a1a2e',
        backgroundColor: stepColor,
        overflow: 'visible',
      }}
    >
      <div style={{ padding: '16px 18px 14px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          {isFirst ? (
            <div
              aria-hidden
              data-tour-progress-dots
              style={{
                display: 'flex',
                gap: 4,
                alignItems: 'center',
              }}
            >
              {Array.from({ length: visibleTotal }, (_, index) => {
                const isActive = index === visibleCurrent - 1
                const isDone = index < visibleCurrent - 1

                return (
                  <span
                    key={'tour-dot-' + String(index)}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      border: isActive ? '1.5px solid #1a1a2e' : '1.5px solid rgba(0,0,0,0.25)',
                      background: isActive
                        ? '#1a1a2e'
                        : isDone
                          ? 'rgba(0,0,0,0.3)'
                          : 'rgba(0,0,0,0.12)',
                      flexShrink: 0,
                    }}
                  />
                )
              })}
            </div>
          ) : (
            <span
              data-tour-step-badge
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 9px',
                borderRadius: 999,
                background: isCompletionStep ? 'rgba(255,255,255,0.25)' : '#1a1a2e',
                color: isCompletionStep ? '#fff' : '#fff',
                fontFamily: "'Shantell Sans', cursive",
                fontSize: '0.58rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Bước {visibleCurrent} / {visibleTotal}
            </span>
          )}

          {step.showSkip && !isLast && skipTour && (
            <button
              type="button"
              onClick={skipTour}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'Shantell Sans', cursive",
                fontSize: '0.62rem',
                fontWeight: 800,
                color: textColor,
                opacity: 0.55,
                padding: '2px 4px',
                textDecoration: 'underline',
              }}
            >
              Bỏ qua
            </button>
          )}
        </div>

        <h3
          style={{
            fontFamily: "'Shantell Sans', cursive",
            fontSize: '1rem',
            fontWeight: 800,
            color: textColor,
            marginBottom: 7,
            lineHeight: 1.3,
            margin: '0 0 7px',
          }}
        >
          {step.title}
        </h3>

        <p
          style={{
            fontFamily: "'Be Vietnam Pro', sans-serif",
            fontSize: '0.76rem',
            fontWeight: 400,
            color: bodyTextColor,
            lineHeight: 1.65,
            margin: '0 0 12px',
          }}
        >
          {step.content as string}
        </p>

        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
        >
          {!isFirst ? (
            <button
              type="button"
              onClick={handlePrevStep}
              style={{
                fontFamily: "'Shantell Sans', cursive",
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '5px 12px',
                border: '2.5px solid #1a1a2e',
                borderRadius: 9,
                background: isCompletionStep ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.65)',
                boxShadow: '2px 2px 0 rgba(0,0,0,0.18)',
                cursor: 'pointer',
                color: isCompletionStep ? '#fff' : '#1a1a2e',
              }}
            >
              ← Quay lại
            </button>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={handleNextStep}
            style={{
              fontFamily: "'Shantell Sans', cursive",
              fontSize: '0.68rem',
              fontWeight: 800,
              padding: '5px 14px',
              border: '2.5px solid #1a1a2e',
              borderRadius: 9,
              background: '#1a1a2e',
              boxShadow: '2px 2px 0 rgba(0,0,0,0.35)',
              cursor: 'pointer',
              color: primaryButtonColor,
            }}
          >
            {isLast ? 'Hoàn thành ✓' : isFirst ? 'Bắt đầu →' : 'Tiếp theo →'}
          </button>
        </div>
      </div>

      {/* Arrow - only show when there's a spotlight (selector exists) */}
      {shouldShowArrow && (
        <>
          {/* Arrow outer (border) */}
          <div
            aria-hidden
            data-tour-tail-outer
            style={{
              position: 'absolute',
              width: 0,
              height: 0,
              ...(arrowPosition === 'bottom'
                ? {
                    bottom: -17,
                    left: 28,
                    borderLeft: '11px solid transparent',
                    borderRight: '11px solid transparent',
                    borderTop: '15px solid #1a1a2e',
                  }
                : arrowPosition === 'top'
                  ? {
                      top: -17,
                      left: 28,
                      borderLeft: '11px solid transparent',
                      borderRight: '11px solid transparent',
                      borderBottom: '15px solid #1a1a2e',
                    }
                  : arrowPosition === 'left'
                    ? {
                        left: -17,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        borderTop: '11px solid transparent',
                        borderBottom: '11px solid transparent',
                        borderRight: '15px solid #1a1a2e',
                      }
                    : {
                        right: -17,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        borderTop: '11px solid transparent',
                        borderBottom: '11px solid transparent',
                        borderLeft: '15px solid #1a1a2e',
                      }),
            }}
          />
          {/* Arrow inner (colored) */}
          <div
            aria-hidden
            data-tour-tail-inner
            style={{
              position: 'absolute',
              width: 0,
              height: 0,
              zIndex: 1,
              ...(arrowPosition === 'bottom'
                ? {
                    bottom: -11,
                    left: 31,
                    borderLeft: '8px solid transparent',
                    borderRight: '8px solid transparent',
                    borderTop: `13px solid ${stepColor}`,
                  }
                : arrowPosition === 'top'
                  ? {
                      top: -11,
                      left: 31,
                      borderLeft: '8px solid transparent',
                      borderRight: '8px solid transparent',
                      borderBottom: `13px solid ${stepColor}`,
                    }
                  : arrowPosition === 'left'
                    ? {
                        left: -11,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        borderTop: '8px solid transparent',
                        borderBottom: '8px solid transparent',
                        borderRight: `13px solid ${stepColor}`,
                      }
                    : {
                        right: -11,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        borderTop: '8px solid transparent',
                        borderBottom: '8px solid transparent',
                        borderLeft: `13px solid ${stepColor}`,
                      }),
            }}
          />
        </>
      )}
    </div>
  )
}
