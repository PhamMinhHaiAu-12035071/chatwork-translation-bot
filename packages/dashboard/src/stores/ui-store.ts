import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UiStoreState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
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
    }),
    {
      name: 'chatwork-bot-ui-store',
    },
  ),
)

export const selectSidebarCollapsed = (state: UiStoreState) => state.sidebarCollapsed
export const selectToggleSidebar = (state: UiStoreState) => state.toggleSidebar
