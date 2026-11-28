import { create } from 'zustand';

interface CookiePreferencesState {
  open: boolean;
  /** What had the focus when it opened, so that the focus goes back there when it closes. */
  opener: HTMLElement | null;
  openPreferences: (opener?: HTMLElement | null) => void;
  closePreferences: () => HTMLElement | null;
}

export const useCookiePreferencesStore = create<CookiePreferencesState>()((set, get) => ({
  open: false,
  opener: null,
  openPreferences: (opener = null) => set({ open: true, opener }),
  closePreferences: () => {
    const { opener } = get();
    set({ open: false, opener: null });
    return opener;
  },
}));
