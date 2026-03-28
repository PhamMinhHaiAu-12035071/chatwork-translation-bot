import { useId } from 'react'
import { CLAY_COLORS, type ClayColorDef } from './clay-colors'
import { CLAY_SYMBOLS } from './clay-symbols'
import type { ClayIconName } from './icon-paths'

interface ClayIconProps {
  name: ClayIconName
  size?: number
  className?: string
  'aria-hidden'?: boolean
  'aria-label'?: string
}

export function ClayIcon({
  name,
  size = 20,
  className,
  'aria-hidden': ariaHidden,
  'aria-label': ariaLabel,
}: ClayIconProps) {
  const id = useId()
  const gradId = `clay-grad-${id}`
  const { from, to }: ClayColorDef = CLAY_COLORS[name]
  const Symbol = CLAY_SYMBOLS[name]

  return (
    <span className={['clay-icon-wrap', className ?? ''].filter(Boolean).join(' ')}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden={ariaHidden}
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id={gradId} x1="3" y1="3" x2="41" y2="41" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>

        {/* Layer 1: 3D hard shadow offset */}
        <rect x="5" y="5" width="36" height="36" rx="13" fill="#1a1a2e" opacity="0.2" />

        {/* Layer 2: Main clay body with gradient */}
        <rect
          x="3"
          y="3"
          width="36"
          height="36"
          rx="13"
          fill={`url(#${gradId})`}
          stroke="#1a1a2e"
          strokeWidth="2.5"
        />

        {/* Layer 3: Inner shine (top-left ellipse) */}
        <ellipse
          cx="13"
          cy="11"
          rx="9"
          ry="6"
          fill="white"
          opacity="0.42"
          transform="rotate(-18 13 11)"
        />

        {/* Layer 4: Icon symbol */}
        <Symbol />
      </svg>
    </span>
  )
}
