import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

export interface PixelScatterDescriptor {
  exitX: number
  exitY: number
  exitRotate: number
  enterX: number
  enterY: number
  enterRotate: number
  delayMs: number
}

interface PixelScatterTextProps {
  value: string
  reserveText?: string
  className?: string
}

const pixelScatterEase = [0.22, 1, 0.36, 1] as const

export function splitPixelScatterText(value: string): string[] {
  return Array.from(value)
}

export function getPixelScatterDescriptor(
  index: number,
  totalCharacters: number,
): PixelScatterDescriptor {
  const centerShift = index - Math.max(totalCharacters - 1, 0) / 2
  const polarity = index % 2 === 0 ? -1 : 1
  const verticalBase = 12 + Math.abs(centerShift) * 4
  const horizontalBase = centerShift * 8

  return {
    exitX: Math.round(horizontalBase + polarity * 6),
    exitY: Math.round(polarity * verticalBase),
    exitRotate: Math.round(horizontalBase * 1.2),
    enterX: Math.round(-horizontalBase * 0.6),
    enterY: Math.round(-polarity * (8 + Math.abs(centerShift) * 3)),
    enterRotate: Math.round(-horizontalBase * 0.55),
    delayMs: index * 18,
  }
}

function renderScatterCharacter(character: string): string {
  return character === ' ' ? '\u00a0' : character
}

export function PixelScatterText({ value, reserveText, className }: PixelScatterTextProps) {
  const reducedMotion = useReducedMotion()
  const characters = splitPixelScatterText(value)
  const stableFootprint = reserveText ?? value

  return (
    <span
      aria-label={value}
      data-motion="pixel-scatter"
      className={[
        'relative inline-grid place-items-center whitespace-pre align-middle',
        className ?? '',
      ].join(' ')}
    >
      <span aria-hidden="true" className="col-start-1 row-start-1 select-none opacity-0">
        {stableFootprint}
      </span>

      {reducedMotion ? (
        <span
          aria-hidden="true"
          className="col-start-1 row-start-1 inline-flex items-center justify-center"
        >
          {value}
        </span>
      ) : (
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            aria-hidden="true"
            key={value}
            className="col-start-1 row-start-1 inline-flex items-center justify-center"
          >
            {characters.map((character, index) => {
              const descriptor = getPixelScatterDescriptor(index, characters.length)

              return (
                <motion.span
                  key={`${value}-${String(index)}-${character}`}
                  className="inline-block will-change-transform"
                  initial={{
                    opacity: 0,
                    filter: 'blur(8px)',
                    x: descriptor.enterX,
                    y: descriptor.enterY,
                    rotate: descriptor.enterRotate,
                    scale: 0.48,
                  }}
                  animate={{
                    opacity: 1,
                    filter: 'blur(0px)',
                    x: 0,
                    y: 0,
                    rotate: 0,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                    filter: 'blur(8px)',
                    x: descriptor.exitX,
                    y: descriptor.exitY,
                    rotate: descriptor.exitRotate,
                    scale: 0.28,
                  }}
                  transition={{
                    duration: 0.34,
                    delay: descriptor.delayMs / 1000,
                    ease: pixelScatterEase,
                  }}
                >
                  {renderScatterCharacter(character)}
                </motion.span>
              )
            })}
          </motion.span>
        </AnimatePresence>
      )}
    </span>
  )
}
