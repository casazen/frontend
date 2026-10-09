import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Where the interface preferences of the user are kept between visits (only `sidebarCollapsed` today). */
export const UI_STORE_STORAGE_KEY = 'casazen:sidebar';

interface UiState {
  /**
   * On a phone (< md): the sheet "Altro" of the bottom bar is open (`MoreSheet`, UI-04b). The bar and the menu button of the
   * header opened it too until UI-05, which took the menu button out. The name is the one the drawer that slid in from the
   * left had.
   */
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  /** The sidebar of the desktop shows only the icons (UI-04a). Kept between visits. */
  sidebarCollapsed: boolean;
  toggleSidebarCollapsed: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  /**
   * The bottom bar of the phone is on the page (`BottomNav`, UI-04b). The toasts read it (`AppToaster`): with a bar they come
   * up above it; on a page without one (the public pages, the login) they stay where they were, at the top.
   */
  bottomBarVisible: boolean;
  setBottomBarVisible: (visible: boolean) => void;
  /**
   * The page has its primary action fixed at the bottom of the phone (`PageHeader` with `mobilePrimary`, UI-05). The
   * content makes room for it (`AppShellLayout`) and the toasts come up above it (`AppToaster`). Not persisted.
   */
  mobilePrimaryVisible: boolean;
  setMobilePrimaryVisible: (visible: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      sidebarCollapsed: false,
      toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      bottomBarVisible: false,
      setBottomBarVisible: (visible) => set({ bottomBarVisible: visible }),
      mobilePrimaryVisible: false,
      setMobilePrimaryVisible: (visible) => set({ mobilePrimaryVisible: visible }),
    }),
    {
      name: UI_STORE_STORAGE_KEY,
      version: 1,
      // The sheet of the phone starts closed on every visit and the bar says by itself that it is there: only the
      // preference is kept.
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    },
  ),
);
