import { motion } from 'framer-motion'
import { NavLink, Outlet, useLocation } from 'react-router'
import { AmbientOrbs } from '~/components/layout/ambient-orbs'
import { BrutalCard } from '~/components/molecules/brutal-card'
import { StickerLabel } from '~/components/atoms/sticker-label'

const navItems = [
  {
    to: '/',
    label: 'Dashboard',
    surfaceClassName: 'theme-card-matcha',
  },
  {
    to: '/rooms/new',
    label: '+ New Room',
    surfaceClassName: 'theme-card-blush',
  },
  {
    to: '/guide',
    label: 'Webhook Guide',
    surfaceClassName: 'theme-card-sky',
  },
] as const

export function AppLayout() {
  const location = useLocation()

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-5 md:px-6 lg:px-8">
      <AmbientOrbs />

      <div className="relative mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <BrutalCard className="theme-card-lilac">
            <StickerLabel tone="accent" tilt="flat">
              Multi-Room Setup
            </StickerLabel>
            <div className="mt-4">
              <h1 className="font-heading text-3xl font-extrabold">Translation Bot</h1>
            </div>
          </BrutalCard>

          <nav className="space-y-5">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className="block">
                {({ isActive }) => (
                  <div className="relative">
                    {isActive ? (
                      <motion.div
                        className="absolute -left-4 top-1/2 h-[70%] w-[5px] rounded-full bg-[var(--accent)]"
                        layoutId="nav-indicator"
                        style={{ y: '-50%' }}
                        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                      />
                    ) : null}
                    <motion.div
                      animate={{
                        x: isActive ? 4 : 0,
                        y: isActive ? -3 : 0,
                        scale: isActive ? 1.02 : 1,
                      }}
                      whileHover={{ x: -2, y: -2 }}
                      whileTap={{ x: 2, y: 2 }}
                      transition={{ duration: 0.16, ease: 'easeOut' }}
                      className={[
                        'brutal-surface p-4 transition-[opacity,box-shadow]',
                        item.surfaceClassName,
                        isActive
                          ? 'shadow-[5px_5px_0_var(--accent)] border-[var(--accent)]'
                          : 'opacity-65 hover:opacity-90',
                      ].join(' ')}
                    >
                      <div className="font-heading text-lg font-bold">{item.label}</div>
                    </motion.div>
                  </div>
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
          <div className="brutal-surface theme-card-cream relative min-h-full overflow-hidden p-6 md:p-8">
            <Outlet />
          </div>
        </motion.main>
      </div>
    </div>
  )
}
