import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'

export type SlideStackDirection = -1 | 0 | 1

interface SlideStackMotionState {
  enterY: string
  exitY: string
  enterRotateX: number
  exitRotateX: number
  enterScale: number
  exitScale: number
}

interface SlideStackNumberProps {
  value: number
  minimumDigits?: number
  className?: string
}

const wheelMaskImage =
  'linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.62) 18%, #000 34%, #000 66%, rgba(0, 0, 0, 0.62) 82%, transparent 100%)'
const wheelMaskStyle: CSSProperties = {
  maskImage: wheelMaskImage,
  WebkitMaskImage: wheelMaskImage,
}
const slideStackVariants: Variants = {
  enter: (currentDirection: SlideStackDirection) => ({
    y: getSlideStackMotionState(currentDirection).enterY,
    rotateX: getSlideStackMotionState(currentDirection).enterRotateX,
    scale: getSlideStackMotionState(currentDirection).enterScale,
    opacity: currentDirection === 0 ? 1 : 0.16,
  }),
  center: {
    y: '0%',
    opacity: 1,
    scale: 1,
    rotateX: 0,
  },
  exit: (currentDirection: SlideStackDirection) => ({
    y: getSlideStackMotionState(currentDirection).exitY,
    rotateX: getSlideStackMotionState(currentDirection).exitRotateX,
    scale: getSlideStackMotionState(currentDirection).exitScale,
    opacity: currentDirection === 0 ? 1 : 0.16,
  }),
}

export function getSlideStackDirection(previous: number, next: number): SlideStackDirection {
  if (next > previous) {
    return 1
  }

  if (next < previous) {
    return -1
  }

  return 0
}

export function getSlideStackFootprint(value: number, minimumDigits = 1): string {
  const digitCount = String(Math.abs(value)).length
  const footprintDigits = Math.max(digitCount, minimumDigits)

  return '0'.repeat(footprintDigits)
}

export function getSlideStackMotionState(direction: SlideStackDirection): SlideStackMotionState {
  if (direction === 0) {
    return {
      enterY: '0%',
      exitY: '0%',
      enterRotateX: 0,
      exitRotateX: 0,
      enterScale: 1,
      exitScale: 1,
    }
  }

  if (direction === 1) {
    return {
      enterY: '118%',
      exitY: '-118%',
      enterRotateX: -72,
      exitRotateX: 72,
      enterScale: 0.82,
      exitScale: 0.82,
    }
  }

  return {
    enterY: '-118%',
    exitY: '118%',
    enterRotateX: 72,
    exitRotateX: -72,
    enterScale: 0.82,
    exitScale: 0.82,
  }
}

export function SlideStackNumber({ value, minimumDigits = 1, className }: SlideStackNumberProps) {
  const reducedMotion = useReducedMotion()
  const [displayValue, setDisplayValue] = useState(value)
  const [direction, setDirection] = useState<SlideStackDirection>(0)
  const previousValueRef = useRef(value)
  const footprintDigitsRef = useRef(Math.max(String(Math.abs(value)).length, minimumDigits))

  useEffect(() => {
    footprintDigitsRef.current = Math.max(
      footprintDigitsRef.current,
      String(Math.abs(value)).length,
      minimumDigits,
    )

    if (previousValueRef.current === value) {
      return
    }

    setDirection(getSlideStackDirection(previousValueRef.current, value))
    previousValueRef.current = value
    setDisplayValue(value)
  }, [minimumDigits, value])

  return (
    <span
      data-motion="slide-stack"
      data-direction={String(direction)}
      className={[
        'relative inline-grid place-items-center align-middle tabular-nums',
        className ?? '',
      ].join(' ')}
    >
      <span aria-hidden="true" className="col-start-1 row-start-1 select-none opacity-0">
        {getSlideStackFootprint(displayValue, footprintDigitsRef.current)}
      </span>

      {reducedMotion ? (
        <span className="col-start-1 row-start-1 inline-flex items-center justify-center">
          {displayValue}
        </span>
      ) : (
        <span
          data-wheel-mask="soft"
          data-wheel-viewport="true"
          style={wheelMaskStyle}
          className="col-start-1 row-start-1 relative inline-flex h-[1.45em] min-w-full items-center justify-center overflow-hidden px-[0.08em]"
        >
          <AnimatePresence custom={direction} initial={false} mode="sync">
            <motion.span
              key={displayValue}
              custom={direction}
              variants={slideStackVariants}
              style={{ transformPerspective: 560 }}
              className="absolute inset-0 inline-flex items-center justify-center"
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                type: 'spring',
                stiffness: 320,
                damping: 28,
                mass: 0.84,
              }}
            >
              {displayValue}
            </motion.span>
          </AnimatePresence>
        </span>
      )}
    </span>
  )
}
