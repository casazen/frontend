import { afterEach, describe, expect, it, vi, type MockInstance } from 'vitest';

const KEY = 'casazen:sidebar';
const KEPT = JSON.stringify({ state: { sidebarCollapsed: true }, version: 1 });

interface Spies {
  calls: () => string[];
  restore: () => void;
}

function spyOnTheStorage(): Spies {
  const spies: [string, MockInstance][] = [
    ...(['getItem', 'setItem', 'removeItem', 'clear', 'key'] as const).map((name): [string, MockInstance] => [`Storage.${name}`, vi.spyOn(Storage.prototype, name)]),
    ['Storage.length', vi.spyOn(Storage.prototype, 'length', 'get')],
  ];
  return {
    calls: () => spies.filter(([, spy]) => spy.mock.calls.length > 0).map(([name, spy]) => `${name} x${spy.mock.calls.length}`),
    restore: () => {
      for (const [, spy] of spies) spy.mockRestore();
    },
  };
}

let spies: Spies | null = null;

async function createdAt(address: string) {
  vi.resetModules();
  window.localStorage.setItem(KEY, KEPT);
  window.history.replaceState({}, '', address);
  spies = spyOnTheStorage();
  const { useUiStore } = await import('../ui-store');
  return useUiStore;
}

afterEach(() => {
  spies?.restore();
  spies = null;
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
});

describe('the store of the interface on a page of the widgets (AC5: no storage)', () => {
  it.each(['/embed/booking?v=1', '/embed/villa-rossi/property/casa-mare?v=1', '/embed/villa-rossi/booking/extra', '/EMBED/booking', '/embed'])(
    'uiStore_OnTheWidgetPage_%s_IsCreatedAndChangedWithoutTouchingTheStorageOfTheBrowser',
    async (address) => {
      const useUiStore = await createdAt(address);

      expect(useUiStore.getState().sidebarCollapsed).toBe(false);

      useUiStore.getState().setSidebarCollapsed(true);
      useUiStore.getState().setBottomBarVisible(true);
      useUiStore.getState().wizardOpened();
      useUiStore.getState().wizardClosed();
      expect(useUiStore.getState().sidebarCollapsed).toBe(true);

      const calls = spies?.calls();
      spies?.restore();
      expect(calls).toEqual([]);
      expect(window.localStorage.getItem(KEY)).toBe(KEPT);
    },
  );

  it('uiStore_TheToasterOfTheApp_ImportsItOnAWidgetPageWithoutTouchingTheStorageOfTheBrowser', async () => {
    vi.resetModules();
    window.localStorage.setItem(KEY, KEPT);
    window.history.replaceState({}, '', '/embed/villa-rossi/booking?v=1');
    spies = spyOnTheStorage();

    await import('@/components/shared/app-toaster');

    expect(spies.calls()).toEqual([]);
  });
});

describe('the store of the interface on every other page (the control)', () => {
  it.each(['/', '/book/villa-rossi', '/app/short-rent/bookings', '/embedded'])('uiStore_OnThePage_%s_StillKeepsTheSidebarOnTheDevice', async (address) => {
    const useUiStore = await createdAt(address);

    expect(spies?.calls()).toContain('Storage.getItem x1');
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);

    useUiStore.getState().setSidebarCollapsed(false);
    expect(spies?.calls().some((call) => call.startsWith('Storage.setItem'))).toBe(true);
    spies?.restore();
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? '{}')).toEqual({ state: { sidebarCollapsed: false }, version: 1 });
  });
});
