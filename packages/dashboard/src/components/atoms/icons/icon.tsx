import { ClayIcon } from './clay-icon'
import { StrokeIcon } from './stroke-icon'
import type { ClayIconName, IconName, IconVariant, StrokeIconName } from './icon-paths'

interface IconProps {
  name: IconName
  variant: IconVariant
  size?: number
  className?: string
  'aria-hidden'?: boolean
  'aria-label'?: string
}

export function Icon({ name, variant, ...rest }: IconProps) {
  if (variant === 'clay') {
    return <ClayIcon name={name as ClayIconName} {...rest} />
  }
  return <StrokeIcon name={name as StrokeIconName} {...rest} />
}
