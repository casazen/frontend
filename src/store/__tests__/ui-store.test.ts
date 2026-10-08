import { beforeEach, describe, expect, it } from 'vitest';
import { UI_STORE_STORAGE_KEY, useUiStore } from '../ui-store';

function stored(): { state: Record<string, unknown>; version: number } | null {
  const raw = window.localStorage.getItem(UI_STORE_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

describe('ui store (UI-04a)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useUiStore.setState({ sidebarOpen: false, sidebarCollapsed: false });
  });

  it('UiStore_Initial_HasTheSidebarExpandedAndTheDrawerClosed', () => {
    expect(useUiStore.getState().sidebarCollapsed).toBe(false);
    expect(useUiStore.getState().sidebarOpen).toBe(false);
  });

  it('UiStore_ToggleSidebarCollapsed_FlipsTheStateBackAndForth', () => {
    useUiStore.getState().toggleSidebarCollapsed();
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
    useUiStore.getState().toggleSidebarCollapsed();
    expect(useUiStore.getState().sidebarCollapsed).toBe(false);

    useUiStore.getState().setSidebarCollapsed(true);
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
  });

  it('UiStore_Collapsed_IsKeptInLocalStorageForTheNextVisit', () => {
    useUiStore.getState().setSidebarCollapsed(true);

    expect(stored()?.state).toEqual({ sidebarCollapsed: true });
    expect(stored()?.version).toBe(1);
  });

  it('UiStore_NextVisit_StartsCollapsedWhenTheUserLeftItCollapsed', async () => {
    window.localStorage.setItem(UI_STORE_STORAGE_KEY, JSON.stringify({ state: { sidebarCollapsed: true }, version: 1 }));

    await useUiStore.persist.rehydrate();

    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
  });

  it('UiStore_PhoneDrawer_IsNeverKept', () => {
    useUiStore.getState().setSidebarOpen(true);
    useUiStore.getState().setSidebarCollapsed(true);

    expect(useUiStore.getState().sidebarOpen).toBe(true);
    expect(stored()?.state).not.toHaveProperty('sidebarOpen');
  });

  it('UiStore_ToggleSidebar_StillOpensAndClosesThePhoneDrawer', () => {
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarOpen).toBe(true);
    useUiStore.getState().setSidebarOpen(false);
    expect(useUiStore.getState().sidebarOpen).toBe(false);
  });
});
