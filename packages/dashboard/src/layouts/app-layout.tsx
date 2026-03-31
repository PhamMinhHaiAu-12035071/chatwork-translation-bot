import { motion, AnimatePresence } from 'framer-motion'
import { NavLink, Outlet, useLocation } from 'react-router'
import { Icon } from '~/components/atoms/icons'
import type { ClayIconName } from '~/components/atoms/icons'
import { AmbientOrbs } from '~/components/layout/ambient-orbs'
import { BrutalCard } from '~/components/molecules/brutal-card'
import { StickerLabel } from '~/components/atoms/sticker-label'
import { useUiStore, selectSidebarCollapsed, selectToggleSidebar } from '~/stores/ui-store'

const navItems: readonly {
  to: string
  label: string
  surfaceClassName: string
  icon: ClayIconName | null
}[] = [
  {
    to: '/',
    label: 'Dashboard',
    surfaceClassName: 'theme-card-matcha',
    icon: 'dashboard',
  },
  {
    to: '/rooms/new',
    label: 'New Room',
    surfaceClassName: 'theme-card-blush',
    icon: 'plus',
  },
  {
    to: '/guide',
    label: 'Webhook Guide',
    surfaceClassName: 'theme-card-sky',
    icon: 'book',
  },
]

export function AppLayout() {
  const location = useLocation()
  const sidebarCollapsed = useUiStore(selectSidebarCollapsed)
  const toggleSidebar = useUiStore(selectToggleSidebar)

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-5 md:px-6 lg:px-8">
      <AmbientOrbs />

      <div
        className={[
          'relative mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl gap-6 transition-all duration-300',
          sidebarCollapsed
            ? 'lg:grid-cols-[80px_minmax(0,1fr)]'
            : 'lg:grid-cols-[320px_minmax(0,1fr)]',
        ].join(' ')}
      >
        <motion.aside
          animate={{
            width: sidebarCollapsed ? '80px' : '320px',
          }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-5 hidden lg:block relative"
        >
          {/* Floating toggle button */}
          <motion.button
            type="button"
            onClick={toggleSidebar}
            className="absolute -left-3 top-4 z-50 brutal-button theme-button-violet size-10 rounded-full p-0 flex items-center justify-center shadow-[4px_4px_0_rgba(0,0,0,0.25)] hover:shadow-[6px_6px_0_rgba(0,0,0,0.25)] hover:scale-110 transition-all"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            whileHover={{ x: -2, y: -2 }}
            whileTap={{ x: 1, y: 1, scale: 0.95 }}
          >
            <motion.div
              animate={{ rotate: sidebarCollapsed ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <Icon name="arrow-right" variant="stroke" size={16} aria-hidden />
            </motion.div>
          </motion.button>

          <BrutalCard className="theme-card-lilac overflow-hidden">
            <AnimatePresence mode="wait">
              {!sidebarCollapsed ? (
                <motion.div
                  key="expanded"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, delay: 0.1 }}
                >
                  <StickerLabel tone="accent" tilt="flat">
                    Multi-Room Setup
                  </StickerLabel>
                  <div className="mt-4">
                    <h1 className="font-heading text-3xl font-extrabold">Translation Bot</h1>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="collapsed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, delay: 0.1 }}
                  className="flex items-center justify-center py-3"
                >
                  <Icon name="dashboard" variant="clay" size={32} aria-hidden />
                </motion.div>
              )}
            </AnimatePresence>
          </BrutalCard>

          <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:space-y-2 lg:overflow-visible lg:pb-0">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className="block shrink-0 min-w-[8.5rem] lg:min-w-0"
              >
                {({ isActive }) => (
                  <div className="relative">
                    {isActive && !sidebarCollapsed ? (
                      <motion.div
                        className="nav-candy-thumb absolute -left-[22px] top-1/2 h-[86%] hidden lg:block"
                        layoutId="nav-indicator"
                        style={{ y: '-50%' }}
                        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                      />
                    ) : null}
                    <motion.div
                      animate={{
                        x: isActive && !sidebarCollapsed ? 4 : 0,
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
                      {sidebarCollapsed ? (
                        <div className="flex items-center justify-center">
                          <span className="flex size-6 items-center justify-center" aria-hidden>
                            {item.icon ? (
                              <Icon name={item.icon} variant="clay" size={24} aria-hidden />
                            ) : null}
                          </span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-[2.5rem_1fr] items-center gap-x-2 text-left font-heading text-lg font-bold">
                          <span
                            className="flex size-6 items-center justify-center justify-self-center"
                            aria-hidden
                          >
                            {item.icon ? (
                              <Icon name={item.icon} variant="clay" size={24} aria-hidden />
                            ) : null}
                          </span>
                          <AnimatePresence>
                            <motion.span
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.2, delay: 0.1 }}
                            >
                              {item.label}
                            </motion.span>
                          </AnimatePresence>
                        </div>
                      )}
                    </motion.div>
                  </div>
                )}
              </NavLink>
            ))}
          </nav>
        </motion.aside>

        {/* Mobile sidebar - unchanged */}
        <aside className="space-y-5 lg:hidden">
          <BrutalCard className="theme-card-lilac">
            <StickerLabel tone="accent" tilt="flat">
              Multi-Room Setup
            </StickerLabel>
            <div className="mt-4">
              <h1 className="font-heading text-3xl font-extrabold">Translation Bot</h1>
            </div>
          </BrutalCard>

          <nav className="flex gap-2 overflow-x-auto pb-1">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className="block shrink-0 min-w-[8.5rem]">
                {({ isActive }) => (
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
                    <div className="grid grid-cols-[2.5rem_1fr] items-center gap-x-2 text-left font-heading text-lg font-bold">
                      <span
                        className="flex size-6 items-center justify-center justify-self-center"
                        aria-hidden
                      >
                        {item.icon ? (
                          <Icon name={item.icon} variant="clay" size={24} aria-hidden />
                        ) : null}
                      </span>
                      <span>{item.label}</span>
                    </div>
                  </motion.div>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>

        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 10, scale: 0.99, rotate: -0.4 }}
          animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
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
