import { create } from 'zustand';

interface CookiePreferencesState {
  /** The panel "Le tue scelte sui cookie" is on the page: opened by "Scegli tu" of the banner or by "Cookie" of the footer. */
  open: boolean;
  /** What had the focus when it opened, so that the focus goes back there when it closes. */
  opener: HTMLElement | null;
  openPreferences: (opener?: HTMLElement | null) => void;
  /** Closes the panel and gives back what opened it (the caller puts the focus there once the page has drawn again). */
  closePreferences: () => HTMLElement | null;
}

/**
 * The panel of the cookie choices is opened from two places (the banner and the footer of the site) and drawn in one: this is
 * the little they share (DB-02b). Not persisted: a page that is loaded starts with it closed.
 */
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
