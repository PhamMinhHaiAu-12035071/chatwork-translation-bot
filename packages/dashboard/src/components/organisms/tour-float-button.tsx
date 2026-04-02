import { useNextStep } from 'nextstepjs'

import { TOUR_NAME } from '~/lib/tour-steps'
import { selectTourSeenVersion, useUiStore } from '~/stores/ui-store'

export function TourFloatButton() {
  const { startNextStep } = useNextStep()
  const tourSeenVersion = useUiStore(selectTourSeenVersion)
  const showBadge = tourSeenVersion === null

  return (
    <button
      type="button"
      onClick={() => {
        startNextStep(TOUR_NAME)
      }}
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 50,
        width: 52,
        height: 52,
        borderRadius: '50%',
        background: '#6e77e5',
        border: '3px solid #1a1a2e',
        boxShadow: '4px 4px 0 #1a1a2e',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Shantell Sans', cursive",
        fontSize: '1.3rem',
        fontWeight: 800,
        color: '#fff',
        transition: 'transform 0.12s ease, box-shadow 0.12s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'rotate(-5deg) translate(-2px, -2px)'
        e.currentTarget.style.boxShadow = '6px 6px 0 #1a1a2e'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = '4px 4px 0 #1a1a2e'
      }}
      aria-label="Xem lại tour hướng dẫn"
    >
      ?
      {showBadge && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#ff6b6b',
            border: '2px solid #1a1a2e',
            boxShadow: '1px 1px 0 #1a1a2e',
          }}
        />
      )}
    </button>
  )
}
