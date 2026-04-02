import type { CardComponentProps } from 'nextstepjs'

import type { NeubStep } from '~/lib/tour-steps'

export function NeubTourCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  skipTour,
  arrow: _arrow,
}: CardComponentProps) {
  const coloredStep = step as NeubStep
  const isFirst = currentStep === 0
  const isLast = currentStep === totalSteps - 1
  const isCompletionStep = isLast
  const textColor = isCompletionStep ? '#fff' : '#1a1a2e'
  const bodyTextColor = isCompletionStep ? 'rgba(255,255,255,0.92)' : '#2a2a3e'
  const primaryButtonColor = isCompletionStep ? '#86e8c0' : coloredStep.color

  return (
    <div
      data-tour-completion={isCompletionStep || undefined}
      style={{
        position: 'relative',
        width: 280,
        border: '3px solid #1a1a2e',
        borderRadius: 18,
        boxShadow: '5px 5px 0 #1a1a2e',
        backgroundColor: coloredStep.color,
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
              {Array.from({ length: totalSteps }, (_, index) => {
                const isActive = index === currentStep
                const isDone = index < currentStep

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
              Bước {currentStep + 1} / {totalSteps}
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
              onClick={prevStep}
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
            onClick={nextStep}
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

      <div
        aria-hidden
        data-tour-tail-outer
        style={{
          position: 'absolute',
          bottom: -17,
          left: 28,
          width: 0,
          height: 0,
          borderLeft: '11px solid transparent',
          borderRight: '11px solid transparent',
          borderTop: '15px solid #1a1a2e',
        }}
      />
      <div
        aria-hidden
        data-tour-tail-inner
        style={{
          position: 'absolute',
          bottom: -11,
          left: 31,
          width: 0,
          height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: `13px solid ${coloredStep.color}`,
          zIndex: 1,
        }}
      />
    </div>
  )
}
