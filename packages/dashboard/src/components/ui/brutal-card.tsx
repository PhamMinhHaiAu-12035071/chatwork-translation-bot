import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface BrutalCardProps {
  children: ReactNode
  className?: string
}

export function BrutalCard({ children, className }: BrutalCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className={['brutal-surface p-5 md:p-6', className ?? ''].join(' ').trim()}
    >
      {children}
    </motion.section>
  )
}
