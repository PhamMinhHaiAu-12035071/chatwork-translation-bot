import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UiStoreState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void

  tourSeenVersion: number | null
  setTourSeen: (version: number) => void
  resetTour: () => void
}

export const useUiStore = create<UiStoreState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,

      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
      },

      setSidebarCollapsed: (collapsed: boolean) => {
        set({ sidebarCollapsed: collapsed })
      },

      tourSeenVersion: null,

      setTourSeen: (version: number) => {
        set({ tourSeenVersion: version })
      },

      resetTour: () => {
        set({ tourSeenVersion: null })
      },
    }),
    {
      name: 'chatwork-bot-ui-store',
    },
  ),
)

export const selectSidebarCollapsed = (state: UiStoreState) => state.sidebarCollapsed
export const selectToggleSidebar = (state: UiStoreState) => state.toggleSidebar
export const selectTourSeenVersion = (state: UiStoreState) => state.tourSeenVersion
export const selectSetTourSeen = (state: UiStoreState) => state.setTourSeen
export const selectResetTour = (state: UiStoreState) => state.resetTour
