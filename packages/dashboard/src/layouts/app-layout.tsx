import { motion } from 'framer-motion'
import { NavLink, Outlet, useLocation } from 'react-router'
import { AmbientOrbs } from '~/components/ui/ambient-orbs'
import { BrutalCard } from '~/components/ui/brutal-card'
import { StickerLabel } from '~/components/ui/sticker-label'

const navItems = [
  { to: '/', label: 'Dashboard', blurb: 'overview + empty state' },
  { to: '/rooms/new', label: '+ New Room', blurb: 'future creation flow' },
  { to: '/guide', label: 'Webhook Guide', blurb: 'manual setup steps' },
] as const

export function AppLayout() {
  const location = useLocation()

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-5 md:px-6 lg:px-8">
      <AmbientOrbs />

      <div className="relative mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <BrutalCard className="space-y-4">
            <StickerLabel tone="accent">Elegant Brutal</StickerLabel>
            <div className="space-y-3">
              <h1 className="font-heading text-3xl font-extrabold">Translation Bot</h1>
              <p className="text-sm leading-7 text-[var(--text-secondary)]">
                Multi-room dashboard shell for setup, guidance, and future activation flows.
              </p>
            </div>
          </BrutalCard>

          <nav className="space-y-3">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to}>
                {({ isActive }) => (
                  <motion.div
                    whileHover={{ x: -2, y: -2 }}
                    whileTap={{ x: 2, y: 2 }}
                    className={[
                      'brutal-surface p-4 transition-colors',
                      isActive ? 'bg-white' : 'bg-white/65',
                    ].join(' ')}
                  >
                    <div className="font-heading text-lg font-bold">{item.label}</div>
                    <div className="mt-1 text-sm text-[var(--text-secondary)]">{item.blurb}</div>
                  </motion.div>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>

        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative"
        >
          <div className="brutal-surface relative min-h-full overflow-hidden p-6 md:p-8">
            <Outlet />
          </div>
        </motion.main>
      </div>
    </div>
  )
}
