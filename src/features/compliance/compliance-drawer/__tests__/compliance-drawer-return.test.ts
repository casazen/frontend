import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RETURN_STORAGE_KEY,
  getArrival,
  markArrivalFocused,
  openDestination,
  readReturn,
  resetReturnForTests,
  saveReturn,
  takeArrival,
} from '../compliance-drawer-return';

const NOW = Date.parse('2026-11-13T10:00:00Z');
const IN_AN_HOUR = '2026-11-13T11:00:00Z';

const SAVED = {
  handoffId: 'hf_5b0e2c9a41d94c63a8d1',
  route: '/app/short-rent/bookings/b1',
  filters: '?tab=guest',
  origin: 'Alloggiati:p1:b1:',
  expiresAt: IN_AN_HOUR,
};

beforeEach(() => {
  window.sessionStorage.clear();
  resetReturnForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('saveReturn', () => {
  it('saveReturn_Handoff_KeepsOnlyTheRelativeRouteTheFiltersTheHandoffIdAndTheControl', () => {
    expect(saveReturn(SAVED, NOW)).toBe(true);

    const kept = JSON.parse(window.sessionStorage.getItem(RETURN_STORAGE_KEY) ?? 'null') as Record<string, unknown>;
    // No name, no outcome, no address of the connected area: where to come back to, and nothing else.
    expect(Object.keys(kept).sort()).toEqual(['expiresAt', 'filters', 'handoffId', 'origin', 'route']);
    expect(kept).toEqual({ ...SAVED, expiresAt: Date.parse(IN_AN_HOUR) });
  });

  it.each([
    ['an address with a scheme', { route: 'https://octorate.example/panel' }],
    ['a protocol-relative address', { route: '//octorate.example' }],
    ['a page outside the app', { route: '/login' }],
    ['filters that are an address', { filters: 'https://octorate.example' }],
    ['filters with a space', { filters: '?q=a b' }],
    ['no handoff id', { handoffId: '' }],
  ])('saveReturn_%s_IsNotKept', (_name, change) => {
    expect(saveReturn({ ...SAVED, ...change }, NOW)).toBe(false);
    expect(window.sessionStorage.getItem(RETURN_STORAGE_KEY)).toBeNull();
  });

  it('saveReturn_ExpiryTheServerDoesNotSay_IsAnHour', () => {
    expect(saveReturn({ ...SAVED, expiresAt: 'soon' }, NOW)).toBe(true);
    expect(readReturn(NOW)?.expiresAt).toBe(NOW + 60 * 60 * 1000);
  });

  it('saveReturn_StorageThatCannotBeWritten_IsFalseAndTheHostStillGoes', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(saveReturn(SAVED, NOW)).toBe(false);
    vi.restoreAllMocks();
  });
});

describe('readReturn', () => {
  it('readReturn_RecordOfTheTab_GivesItBack', () => {
    saveReturn(SAVED, NOW);
    expect(readReturn(NOW)).toEqual({ ...SAVED, expiresAt: Date.parse(IN_AN_HOUR) });
  });

  it('readReturn_ExpiredRecord_IsNothingAndIsForgotten', () => {
    saveReturn(SAVED, NOW);
    expect(readReturn(Date.parse(IN_AN_HOUR) + 1)).toBeNull();
    expect(window.sessionStorage.getItem(RETURN_STORAGE_KEY)).toBeNull();
  });

  it.each([
    ['not JSON', 'not json'],
    ['an address as the route', JSON.stringify({ ...SAVED, route: 'https://octorate.example', expiresAt: NOW + 1000 })],
    ['a route with its filters inside', JSON.stringify({ ...SAVED, route: '/app/short-rent/bookings/b1?tab=guest', expiresAt: NOW + 1000 })],
    ['an expiry that is not a number', JSON.stringify({ ...SAVED, expiresAt: 'tomorrow' })],
    ['a list', JSON.stringify([SAVED])],
  ])('readReturn_%s_IsNothingAndIsForgotten', (_name, raw) => {
    window.sessionStorage.setItem(RETURN_STORAGE_KEY, raw);
    expect(readReturn(NOW)).toBeNull();
    expect(window.sessionStorage.getItem(RETURN_STORAGE_KEY)).toBeNull();
  });

  it('readReturn_RecordWithMoreThanItShouldHold_CarriesOnlyItsFields', () => {
    window.sessionStorage.setItem(
      RETURN_STORAGE_KEY,
      JSON.stringify({ ...SAVED, expiresAt: NOW + 1000, guestName: 'Mario Rossi', outcome: 'sent' }),
    );
    expect(Object.keys(readReturn(NOW) ?? {}).sort()).toEqual(['expiresAt', 'filters', 'handoffId', 'origin', 'route']);
  });
});

describe('takeArrival', () => {
  it('takeArrival_RecordOfTheTab_IsTakenOnceAndForgotten', () => {
    saveReturn(SAVED, NOW);

    const arrival = takeArrival(NOW);

    expect(arrival).toEqual({ route: SAVED.route, filters: SAVED.filters, origin: SAVED.origin, focused: false });
    expect(window.sessionStorage.getItem(RETURN_STORAGE_KEY)).toBeNull();
    // A second reading (a render run twice, a second tab of the shell) finds nothing more and changes nothing.
    expect(takeArrival(NOW)).toBe(arrival);
    expect(getArrival()).toBe(arrival);
  });

  it('takeArrival_NothingInTheTab_IsNoReturn', () => {
    expect(takeArrival(NOW)).toBeNull();
    expect(getArrival()).toBeNull();
  });

  it('takeArrival_ExpiredRecord_IsNoReturn', () => {
    saveReturn(SAVED, NOW);
    expect(takeArrival(Date.parse(IN_AN_HOUR) + 1)).toBeNull();
  });

  it('markArrivalFocused_Return_AsksForTheFocusOnlyOnce', () => {
    saveReturn(SAVED, NOW);
    takeArrival(NOW);

    markArrivalFocused();

    expect(getArrival()?.focused).toBe(true);
  });
});

describe('openDestination', () => {
  it('openDestination_Https_GoesThereInTheSameTabAndAddsNothingToTheAddress', () => {
    const assign = vi.fn();
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.stubGlobal('location', { ...window.location, assign });

    expect(openDestination('https://panel.example.com/home')).toBe(true);

    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('https://panel.example.com/home');
    // Never a second window or tab.
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it.each([
    ['http', 'http://panel.example.com/home'],
    ['a script', 'javascript:alert(1)'],
    ['a relative address', '/app/short-rent'],
    ['nothing', ''],
  ])('openDestination_%s_IsNeverOpened', (_name, address) => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });

    expect(openDestination(address)).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });
});
