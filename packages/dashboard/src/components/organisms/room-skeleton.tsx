import { motion } from 'framer-motion'

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <motion.div
      animate={{ opacity: [0.4, 0.7, 0.4] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      className={[
        'rounded-lg border-[3px] border-[var(--border)] bg-[var(--card-glass)]',
        className ?? '',
      ].join(' ')}
    />
  )
}

export function RoomSkeletonCard() {
  return (
    <div className="brutal-surface theme-card-cream space-y-4 p-5 md:p-6">
      <SkeletonBlock className="h-5 w-1/3" />
      <SkeletonBlock className="h-4 w-2/3" />
      <div className="flex gap-3">
        <SkeletonBlock className="h-8 w-20" />
        <SkeletonBlock className="h-8 w-20" />
      </div>
    </div>
  )
}

export function RoomSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <RoomSkeletonCard key={index} />
      ))}
    </div>
  )
}
