import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { isEmbedPath } from '@/lib/embed-path';

export const UI_STORE_STORAGE_KEY = 'casazen:sidebar';

const inMemory = new Map<string, string>();
const IN_MEMORY_STORAGE: StateStorage = {
  getItem: (name) => inMemory.get(name) ?? null,
  setItem: (name, value) => {
    inMemory.set(name, value);
  },
  removeItem: (name) => {
    inMemory.delete(name);
  },
};

/**
 * The storage of the store: the browser's `localStorage`, except on a page of the embeddable widgets. That page is a frame of another site and keeps
 * nothing in the browser, not even this preference (no widget shows a sidebar): without this, the store reads `localStorage` when it is created, which
 * is when the app starts, on every page, and writes it at every change. A frame is not a place for the browser to hold a person's preferences, and a
 * browser that blocks the storage must not even be asked. The address is the one of the document: the store is created once, at start-up.
 */
function uiStorage(): StateStorage {
  if (typeof window !== 'undefined' && isEmbedPath(window.location.pathname)) return IN_MEMORY_STORAGE;
  return window.localStorage;
}

export interface WorkspaceView {
  focusForms?: boolean;
  tasksFirst?: boolean;
  compact: boolean;
  secondaryPaths: string[];
}

export const DEFAULT_WORKSPACE_VIEW: WorkspaceView = { compact: false, secondaryPaths: [] };

interface UiState {
  workspaceViews: Record<string, WorkspaceView>;
  updateWorkspaceView: (key: string, change: (view: WorkspaceView) => WorkspaceView) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  toggleSidebarCollapsed: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  bottomBarVisible: boolean;
  setBottomBarVisible: (visible: boolean) => void;
  mobilePrimaryVisible: boolean;
  setMobilePrimaryVisible: (visible: boolean) => void;
  /**
   * How many wizards are mounted (in practice one, but a count: the one that leaves must not say "no wizard" while another is still
   * there). Each one raises it with `useWizardOpenFlag`: `WizardShell` does, and so do the flows that have a frame of their own. The
   * popup alerts read it: while it is above zero they wait in their queue and nothing is drawn (ADR-025-R7). A path test would miss
   * almost every wizard, which does not live under `/wizard/`. Not persisted.
   */
  openWizards: number;
  wizardOpened: () => void;
  wizardClosed: () => void;
  guideOpen: boolean;
  setGuideOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      workspaceViews: {},
      updateWorkspaceView: (key, change) => set(state => {
        const next = change(state.workspaceViews[key] ?? DEFAULT_WORKSPACE_VIEW);
        const workspaceViews = { ...state.workspaceViews };
        if (next.compact || next.focusForms || next.tasksFirst || next.secondaryPaths.length) workspaceViews[key] = next;
        else delete workspaceViews[key];
        return { workspaceViews };
      }),
      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      sidebarCollapsed: false,
      toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      bottomBarVisible: false,
      setBottomBarVisible: (visible) => set({ bottomBarVisible: visible }),
      mobilePrimaryVisible: false,
      setMobilePrimaryVisible: (visible) => set({ mobilePrimaryVisible: visible }),
      openWizards: 0,
      wizardOpened: () => set((state) => ({ openWizards: state.openWizards + 1 })),
      wizardClosed: () => set((state) => ({ openWizards: Math.max(0, state.openWizards - 1) })),
      guideOpen: false,
      setGuideOpen: (open) => set({ guideOpen: open }),
    }),
    {
      name: UI_STORE_STORAGE_KEY,
      storage: createJSONStorage(uiStorage),
      version: 1,
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed, ...(Object.keys(state.workspaceViews).length ? { workspaceViews: state.workspaceViews } : {}) }),
    },
  ),
);
