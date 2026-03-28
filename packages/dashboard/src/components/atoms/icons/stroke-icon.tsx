import { STROKE_PATHS, type StrokeIconName } from './icon-paths'

interface StrokeIconProps {
  name: StrokeIconName
  size?: number
  className?: string
  'aria-hidden'?: boolean
  'aria-label'?: string
}

export function StrokeIcon({
  name,
  size = 20,
  className,
  'aria-hidden': ariaHidden,
  'aria-label': ariaLabel,
}: StrokeIconProps) {
  const def = STROKE_PATHS[name]

  return (
    <span
      className={['stroke-icon-wrap', def.animClass, className ?? ''].filter(Boolean).join(' ')}
    >
      <svg
        width={size}
        height={size}
        viewBox={def.viewBox}
        fill="none"
        aria-hidden={ariaHidden}
        aria-label={ariaLabel}
      >
        {/* Shadow path — duplicate at offset for 3D depth */}
        <path
          d={def.d}
          stroke="currentColor"
          strokeWidth={def.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.22"
          transform="translate(1.3,1.3)"
        />
        {/* Main icon path */}
        <path
          d={def.d}
          stroke="currentColor"
          strokeWidth={def.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
