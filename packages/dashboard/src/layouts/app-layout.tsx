import { motion, AnimatePresence } from 'framer-motion'
import { NextStepReact, useNextStep } from 'nextstepjs'
import { useReactRouterAdapter } from 'nextstepjs/adapters/react-router'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { Icon } from '~/components/atoms/icons'
import type { ClayIconName } from '~/components/atoms/icons'
import { AmbientOrbs } from '~/components/layout/ambient-orbs'
import { NeubTourCard } from '~/components/organisms/neub-tour-card'
// TODO: Re-enable tour replay float button when tour/overlay issues are fully resolved.
// import { TourFloatButton } from '~/components/organisms/tour-float-button'
import { TOUR_NAME, TOUR_VERSION, tours } from '~/lib/tour-steps'
import { BrutalCard } from '~/components/molecules/brutal-card'
import { StickerLabel } from '~/components/atoms/sticker-label'
import { useUiStore, selectSidebarCollapsed, selectToggleSidebar } from '~/stores/ui-store'
import { useRoomStore, selectRooms } from '~/stores/room-store'

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
    to: '/free-rooms',
    label: 'Free Rooms',
    surfaceClassName: 'theme-card-cream',
    icon: 'dashboard',
  },
  {
    to: '/free-rooms/new',
    label: 'New Free Room',
    surfaceClassName: 'theme-card-peach',
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
  const { startNextStep, setCurrentStep, currentTour, closeNextStep } = useNextStep()
  const rooms = useRoomStore(selectRooms)
  const navigate = useNavigate()
  const tourSeenVersion = useUiStore((state) => state.tourSeenVersion)
  const [persistHasHydrated, setPersistHasHydrated] = useState(() =>
    useUiStore.persist.hasHydrated(),
  )

  useEffect(() => {
    const unsub = useUiStore.persist.onFinishHydration(() => {
      setPersistHasHydrated(true)
    })
    return unsub
  }, [])

  // After successful standard room create we navigate here with spotlightRoomId; clear any stale NextStep overlay (e.g. step 17 stuck open).
  useEffect(() => {
    const spotlightId = (location.state as { spotlightRoomId?: string } | null)?.spotlightRoomId
    if (location.pathname === '/' && spotlightId != null) {
      closeNextStep()
    }
  }, [location.pathname, location.state, closeNextStep])

  useEffect(() => {
    // Before rehydration, tourSeenVersion is default null — do not schedule auto-start (race with localStorage).
    if (!persistHasHydrated) return
    // Use hook state instead of getState() to ensure reactivity to Zustand persistence
    if (tourSeenVersion !== null) return
    if (location.pathname !== '/') return
    // startNextStep() always resets to step 0 (nextstepjs NextStepContext). If we schedule it
    // again when the user returns to "/" mid-tour (e.g. after /rooms/new), the tour jumps back
    // to "Chào mừng" instead of continuing at the room-card steps.
    if (currentTour === TOUR_NAME) return

    const id = window.setTimeout(() => {
      startNextStep(TOUR_NAME)
    }, 800)

    return () => {
      window.clearTimeout(id)
    }
  }, [
    startNextStep,
    location.pathname,
    currentTour,
    closeNextStep,
    tourSeenVersion,
    persistHasHydrated,
  ])

  return (
    <NextStepReact
      steps={tours}
      cardComponent={NeubTourCard}
      navigationAdapter={useReactRouterAdapter}
      onStepChange={(step) => {
        // Steps 17–20 (0-based) cover room card interactions and require at least one room.
        if (rooms.length === 0) {
          // Forward: skip room steps → jump to completion
          if (step === 17) {
            setTimeout(() => {
              setCurrentStep(21)
            }, 0)
            return
          }
          // Backward: skip back over room steps → return to "Lưu phòng" on /rooms/new
          if (step >= 18 && step <= 20) {
            void navigate('/rooms/new')
            setTimeout(() => {
              setCurrentStep(16)
              setTimeout(() => window.dispatchEvent(new Event('resize')), 100)
            }, 200)
            return
          }
        }
        // Auto-expand Translation Context when landing on its interior step (13).
        // Handles keyboard navigation (ArrowRight/ArrowLeft) which bypasses card button handlers.
        if (step === 13) {
          if (document.querySelector('#tour-context-templates') === null) {
            const triggerButton = document.querySelector<HTMLButtonElement>(
              '#tour-field-context button',
            )
            if (triggerButton) {
              triggerButton.click()
              setTimeout(() => window.dispatchEvent(new Event('resize')), 550)
              return
            }
          }
          setTimeout(() => window.dispatchEvent(new Event('resize')), 100)
          return
        }
        // Auto-expand Keyword Protection when landing on its interior step (15).
        // Handles keyboard navigation (ArrowRight/ArrowLeft) which bypasses card button handlers.
        if (step === 15) {
          if (document.querySelector('#tour-keyword-addform') === null) {
            const triggerButton = document.querySelector<HTMLButtonElement>(
              '#tour-field-keywords button',
            )
            if (triggerButton) {
              triggerButton.click()
              setTimeout(() => window.dispatchEvent(new Event('resize')), 550)
              return
            }
          }
          setTimeout(() => window.dispatchEvent(new Event('resize')), 100)
          return
        }
      }}
      onComplete={() => {
        // Set seen immediately (synchronous Zustand state update triggers re-render)
        useUiStore.getState().setTourSeen(TOUR_VERSION)
        // Force close immediately (nextstepjs also calls this, but double-call is safe)
        closeNextStep()
      }}
      onSkip={() => {
        // Set seen immediately (synchronous Zustand state update triggers re-render)
        useUiStore.getState().setTourSeen(TOUR_VERSION)
        // Force close immediately (nextstepjs also calls this, but double-call is safe)
        closeNextStep()
      }}
    >
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
              className="absolute -left-6 top-4 z-50 brutal-button theme-button-violet size-10 rounded-full p-0 flex items-center justify-center shadow-[4px_4px_0_rgba(0,0,0,0.25)] hover:shadow-[6px_6px_0_rgba(0,0,0,0.25)] hover:scale-110 transition-all"
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

            <motion.div
              layout
              className="brutal-surface theme-card-lilac overflow-hidden"
              style={{
                borderRadius: '24px',
              }}
              animate={{
                padding: sidebarCollapsed ? '8px' : '1.5rem',
              }}
              transition={{
                padding: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
              }}
            >
              {/* Single sticker element that morphs between text and icon */}
              <motion.div
                layout
                className="sticker-label bg-[var(--accent)] text-white sticker-tilt-flat relative overflow-hidden"
                animate={{
                  width: sidebarCollapsed ? '48px' : 'auto',
                  height: sidebarCollapsed ? '48px' : 'auto',
                  borderRadius: sidebarCollapsed ? '14px' : '999px',
                  paddingLeft: sidebarCollapsed ? '0px' : '16px',
                  paddingRight: sidebarCollapsed ? '0px' : '16px',
                  paddingTop: sidebarCollapsed ? '0px' : '4px',
                  paddingBottom: sidebarCollapsed ? '0px' : '4px',
                  marginLeft: sidebarCollapsed ? '10px' : '12px',
                }}
                transition={{
                  layout: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
                  width: { duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: 0.15 },
                  height: { duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: 0.15 },
                  borderRadius: { duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: 0.15 },
                  padding: { duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: 0.15 },
                  marginLeft: { duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: 0.15 },
                }}
              >
                {/* Text content - fades out first */}
                <motion.span
                  animate={{
                    opacity: sidebarCollapsed ? 0 : 1,
                    scale: sidebarCollapsed ? 0.8 : 1,
                  }}
                  transition={{
                    duration: 0.15,
                    ease: 'easeOut',
                  }}
                  style={{
                    display: sidebarCollapsed ? 'none' : 'inline',
                  }}
                >
                  Multi-Room Setup
                </motion.span>

                {/* Grid icon - fades in mid-transition */}
                <motion.span
                  animate={{
                    opacity: sidebarCollapsed ? 1 : 0,
                    scale: sidebarCollapsed ? 1 : 0.8,
                  }}
                  transition={{
                    duration: 0.15,
                    ease: 'easeIn',
                    delay: 0.15,
                  }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: sidebarCollapsed ? 'flex' : 'none',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="grid" variant="clay" size={28} aria-hidden />
                </motion.span>
              </motion.div>

              {/* Translation Bot Title - only visible when expanded */}
              <AnimatePresence>
                {!sidebarCollapsed ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.2, delay: 0.2 }}
                    className="mt-4"
                  >
                    <h1 className="font-heading text-3xl font-extrabold">Translation Bot</h1>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>

            <nav
              id="tour-sidebar-nav"
              className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:space-y-2 lg:overflow-visible lg:pb-0"
            >
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end
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
                <NavLink key={item.to} to={item.to} end className="block shrink-0 min-w-[8.5rem]">
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

        {/* TODO: Re-enable — see import above */}
        {/* <TourFloatButton /> */}
      </div>
    </NextStepReact>
  )
}
