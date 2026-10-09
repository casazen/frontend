import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Where the interface preferences of the user are kept between visits (only `sidebarCollapsed` today). */
export const UI_STORE_STORAGE_KEY = 'casazen:sidebar';

interface UiState {
  /** On mobile (< md), semantically "mobile nav drawer open". */
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  /** The sidebar of the desktop shows only the icons (UI-04a). Kept between visits. */
  sidebarCollapsed: boolean;
  toggleSidebarCollapsed: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarOpen: false,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      sidebarCollapsed: false,
      toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    }),
    {
      name: UI_STORE_STORAGE_KEY,
      version: 1,
      // The drawer of the phone starts closed on every visit: only the preference is kept.
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    },
  ),
);
