import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface BrutalCardProps {
  children: ReactNode
  className?: string
  tilt?: 'left' | 'right' | 'flat'
}

const rotateByTilt: Record<NonNullable<BrutalCardProps['tilt']>, number> = {
  left: -0.9,
  right: 0.9,
  flat: 0,
}

export function BrutalCard({ children, className, tilt = 'flat' }: BrutalCardProps) {
  const rotate = rotateByTilt[tilt]

  return (
    <motion.section
      initial={{ opacity: 0, y: 16, rotate }}
      animate={{ opacity: 1, y: 0, rotate }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={{
        transformOrigin: rotate < 0 ? 'top left' : rotate > 0 ? 'top right' : 'center top',
      }}
      className={['brutal-surface p-5 md:p-6', className ?? ''].join(' ').trim()}
    >
      {children}
    </motion.section>
  )
}
