import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UiStoreState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void

  tourSeenVersion: number | null
  setTourSeen: (version: number) => void
  resetTour: () => void

  freeRoomEnabled: boolean
  toggleFreeRoomEnabled: () => void
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

      freeRoomEnabled: false,

      toggleFreeRoomEnabled: () => {
        set((state) => ({ freeRoomEnabled: !state.freeRoomEnabled }))
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
export const selectFreeRoomEnabled = (state: UiStoreState) => state.freeRoomEnabled
export const selectToggleFreeRoomEnabled = (state: UiStoreState) => state.toggleFreeRoomEnabled
