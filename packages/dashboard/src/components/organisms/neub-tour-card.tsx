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

  return (
    <div
      style={{
        position: 'relative',
        width: 300,
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
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontFamily: "'Shantell Sans', cursive",
              fontSize: '0.62rem',
              fontWeight: 800,
              color: textColor,
              opacity: 0.65,
              letterSpacing: '0.08em',
            }}
          >
            Bước {currentStep + 1} / {totalSteps}
          </span>

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
            marginBottom: 8,
            lineHeight: 1.3,
            margin: '0 0 8px',
          }}
        >
          {step.title}
        </h3>

        <p
          style={{
            fontFamily: "'Be Vietnam Pro', sans-serif",
            fontSize: '0.8rem',
            fontWeight: 400,
            color: bodyTextColor,
            lineHeight: 1.65,
            margin: '0 0 14px',
          }}
        >
          {step.content as string}
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {!isFirst && !isLast && (
            <button
              type="button"
              onClick={prevStep}
              style={{
                fontFamily: "'Shantell Sans', cursive",
                fontSize: '0.7rem',
                fontWeight: 800,
                padding: '6px 12px',
                border: '2.5px solid #1a1a2e',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.55)',
                boxShadow: '2px 2px 0 #1a1a2e',
                cursor: 'pointer',
                color: '#1a1a2e',
              }}
            >
              ← Trước
            </button>
          )}

          <button
            type="button"
            onClick={nextStep}
            style={{
              fontFamily: "'Shantell Sans', cursive",
              fontSize: '0.7rem',
              fontWeight: 800,
              padding: '6px 14px',
              border: '2.5px solid #1a1a2e',
              borderRadius: 8,
              background: '#1a1a2e',
              boxShadow: '2px 2px 0 rgba(0,0,0,0.35)',
              cursor: 'pointer',
              color: coloredStep.color,
            }}
          >
            {isLast ? 'Hoàn thành' : 'Tiếp →'}
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
