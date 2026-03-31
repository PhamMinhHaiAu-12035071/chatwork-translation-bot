import { motion } from 'framer-motion'
import type { CSSProperties, ReactNode } from 'react'
import type { MotionStyle } from 'framer-motion'

interface BrutalCardProps {
  children: ReactNode
  className?: string
  tilt?: 'left' | 'right' | 'flat'
  animated?: boolean
  style?: CSSProperties
}

const rotateByTilt: Record<NonNullable<BrutalCardProps['tilt']>, number> = {
  left: -0.9,
  right: 0.9,
  flat: 0,
}

export function BrutalCard({
  children,
  className,
  tilt = 'flat',
  animated = true,
  style,
}: BrutalCardProps) {
  const rotate = rotateByTilt[tilt]
  const baseStyle: CSSProperties = {
    transformOrigin: rotate < 0 ? 'top left' : rotate > 0 ? 'top right' : 'center top',
  }
  const mergedStyle: CSSProperties = style ? { ...baseStyle, ...style } : baseStyle
  const classNames = ['brutal-surface p-5 md:p-6', className ?? ''].join(' ').trim()

  if (!animated) {
    return (
      <section style={mergedStyle} className={classNames}>
        {children}
      </section>
    )
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 16, rotate }}
      animate={{ opacity: 1, y: 0, rotate }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={mergedStyle as MotionStyle}
      className={classNames}
    >
      {children}
    </motion.section>
  )
}
