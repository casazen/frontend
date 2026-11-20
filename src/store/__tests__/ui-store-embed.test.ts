import { afterEach, describe, expect, it, vi, type MockInstance } from 'vitest';

/**
 * The store of the interface preferences on a page of the embeddable widgets (E41/F01/US01, NF-144): a frame of another website keeps nothing in the
 * browser, and this store is created when the app starts, on EVERY page, with `persist`: it reads `localStorage` at once and writes it at every change.
 * What counts is when it is created, so the spies are in place BEFORE the store is imported, in a registry of modules that was emptied.
 */
const KEY = 'casazen:sidebar';
const KEPT = JSON.stringify({ state: { sidebarCollapsed: true }, version: 1 });

interface Spies {
  /** Every call of the storage of the browser, with its name. */
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

/** The store as the app creates it at start-up on `address`, with the spies already in place and a preference of the guest already kept on the device. */
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

      // The preference kept on the device is not read: the frame starts from the defaults.
      expect(useUiStore.getState().sidebarCollapsed).toBe(false);

      // Every kind of change, the ones that are kept elsewhere and the one that would be kept: nothing is written.
      useUiStore.getState().setSidebarCollapsed(true);
      useUiStore.getState().setBottomBarVisible(true);
      useUiStore.getState().wizardOpened();
      useUiStore.getState().wizardClosed();
      expect(useUiStore.getState().sidebarCollapsed).toBe(true);

      const calls = spies?.calls();
      spies?.restore();
      expect(calls).toEqual([]);
      // And what the guest kept on this device is still there, as it was.
      expect(window.localStorage.getItem(KEY)).toBe(KEPT);
    },
  );

  it('uiStore_TheToasterOfTheApp_ImportsItOnAWidgetPageWithoutTouchingTheStorageOfTheBrowser', async () => {
    // The toaster is mounted by the app on every page and subscribes to the store: the real module, not a stand-in.
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

    // Read when the store is created: the preference of the guest is the state.
    expect(spies?.calls()).toContain('Storage.getItem x1');
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);

    // And written at every change.
    useUiStore.getState().setSidebarCollapsed(false);
    expect(spies?.calls().some((call) => call.startsWith('Storage.setItem'))).toBe(true);
    spies?.restore();
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? '{}')).toEqual({ state: { sidebarCollapsed: false }, version: 1 });
  });
});
