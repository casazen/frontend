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

  it('UiStore_SetSidebarOpen_OpensAndClosesThePhoneSheet', () => {
    useUiStore.getState().setSidebarOpen(true);
    expect(useUiStore.getState().sidebarOpen).toBe(true);
    useUiStore.getState().setSidebarOpen(false);
    expect(useUiStore.getState().sidebarOpen).toBe(false);
  });

  it('UiStore_MobilePrimaryVisible_StartsOffAndIsNeverKept', () => {
    expect(useUiStore.getState().mobilePrimaryVisible).toBe(false);

    useUiStore.getState().setMobilePrimaryVisible(true);
    useUiStore.getState().setSidebarCollapsed(true);

    expect(useUiStore.getState().mobilePrimaryVisible).toBe(true);
    expect(stored()?.state).toEqual({ sidebarCollapsed: true });
    useUiStore.getState().setMobilePrimaryVisible(false);
  });

  it('UiStore_OpenWizards_CountsTheWizardsOnScreenSoThatOneLeavingDoesNotHideAnother', () => {
    const before = useUiStore.getState().openWizards;

    useUiStore.getState().wizardOpened();
    useUiStore.getState().wizardOpened();
    useUiStore.getState().wizardClosed();
    expect(useUiStore.getState().openWizards).toBe(before + 1);

    useUiStore.getState().wizardClosed();
    expect(useUiStore.getState().openWizards).toBe(before);
  });

  it('UiStore_OpenWizards_NeverGoesBelowZeroAndIsNeverKept', () => {
    useUiStore.setState({ openWizards: 0 });

    useUiStore.getState().wizardClosed();
    expect(useUiStore.getState().openWizards).toBe(0);

    useUiStore.getState().wizardOpened();
    expect(stored()?.state).not.toHaveProperty('openWizards');
    useUiStore.getState().wizardClosed();
  });
  it('keeps independent preferences for each profile, organization and area, including after a reset', () => {
    const one = JSON.stringify(['host', 'agency-a', 'short-rent']);
    const two = JSON.stringify(['host', 'agency-b', 'short-rent']);
    const { updateWorkspaceView } = useUiStore.getState();
    updateWorkspaceView(one, view => ({ ...view, compact: true }));
    updateWorkspaceView(two, view => ({ ...view, secondaryPaths: ['/app/short-rent/marketplace'] }));
    expect(useUiStore.getState().workspaceViews[two].compact).toBe(false);
    updateWorkspaceView(one, () => ({ compact: false, secondaryPaths: [] }));
    expect(useUiStore.getState().workspaceViews[one]).toBeUndefined();
    expect(useUiStore.getState().workspaceViews[two].secondaryPaths).toHaveLength(1);
    updateWorkspaceView(two, () => ({ compact: false, secondaryPaths: [] }));
  });

});
