import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSENT_STORAGE_KEY } from '@/lib/cookie-consent';
import { MAX_REMEMBERED_PURCHASES, PURCHASES_STORAGE_KEY, forgetSentPurchases, purchaseOnce } from '../purchase-once';

const stored = () => JSON.parse(window.localStorage.getItem(PURCHASES_STORAGE_KEY) ?? 'null') as string[] | null;

function accept() {
  window.localStorage.setItem(CONSENT_STORAGE_KEY, 'accepted');
}

describe('purchaseOnce', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('purchaseOnce_secondCall_pushesNothing', () => {
    accept();
    const push = vi.fn();

    expect(purchaseOnce('booking-1', push)).toBe(true);
    expect(purchaseOnce('booking-1', push)).toBe(false);
    expect(purchaseOnce('booking-1', push)).toBe(false);

    expect(push).toHaveBeenCalledTimes(1);
    expect(stored()).toEqual(['booking-1']);
  });

  it('purchaseOnce_anotherBooking_pushes', () => {
    accept();
    const push = vi.fn();

    purchaseOnce('booking-1', push);
    purchaseOnce('booking-2', push);

    expect(push).toHaveBeenCalledTimes(2);
    expect(stored()).toEqual(['booking-1', 'booking-2']);
  });

  it.each([
    ['no choice yet', null],
    ['a refusal', 'rejected'],
  ])('purchaseOnce_withoutConsent_pushesNothingAndStoresNothing (%s)', (_label, choice) => {
    if (choice) window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
    const push = vi.fn();

    expect(purchaseOnce('booking-1', push)).toBe(false);

    expect(push).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(PURCHASES_STORAGE_KEY)).toBeNull();
  });

  it('purchaseOnce_aBookingWithoutAnId_pushesNothing', () => {
    accept();
    const push = vi.fn();

    expect(purchaseOnce('', push)).toBe(false);

    expect(push).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(PURCHASES_STORAGE_KEY)).toBeNull();
  });

  it('purchaseOnce_keepsTheFiftyMostRecentBookingsAndNoMore', () => {
    accept();
    const push = vi.fn();

    for (let position = 0; position < MAX_REMEMBERED_PURCHASES + 10; position += 1) purchaseOnce(`booking-${position}`, push);

    expect(stored()).toHaveLength(MAX_REMEMBERED_PURCHASES);
    expect(stored()?.[0]).toBe('booking-10');
    expect(stored()?.at(-1)).toBe(`booking-${MAX_REMEMBERED_PURCHASES + 9}`);

    expect(purchaseOnce(`booking-${MAX_REMEMBERED_PURCHASES + 9}`, push)).toBe(false);
    expect(purchaseOnce('booking-0', push)).toBe(true);
    expect(stored()).toHaveLength(MAX_REMEMBERED_PURCHASES);
  });

  it.each([
    ['not JSON', 'not json'],
    ['not a list', '{"booking-1":true}'],
    ['a list with things that are not ids', '[1,null,{"id":"x"},"",true]'],
  ])('purchaseOnce_withAListThatIsUnreadable_%s_IsReplacedAndPushes', (_label, value) => {
    accept();
    window.localStorage.setItem(PURCHASES_STORAGE_KEY, value);
    const push = vi.fn();

    expect(purchaseOnce('booking-1', push)).toBe(true);

    expect(push).toHaveBeenCalledTimes(1);
    expect(stored()).toEqual(['booking-1']);
  });

  it('purchaseOnce_aBrowserThatCannotWriteTheList_pushesNothing', () => {
    accept();
    const push = vi.fn();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    });

    expect(purchaseOnce('booking-1', push)).toBe(false);

    expect(push).not.toHaveBeenCalled();
  });

  it('purchaseOnce_remembersTheBookingBeforeItPushes', () => {
    accept();
    let seenByThePush: string[] | null = null;

    purchaseOnce('booking-1', () => {
      seenByThePush = stored();
    });

    expect(seenByThePush).toEqual(['booking-1']);
  });

  it('forgetSentPurchases_RemovesTheListAndLeavesTheChoiceOfTheVisitor', () => {
    accept();
    purchaseOnce('booking-1', vi.fn());
    expect(stored()).toEqual(['booking-1']);

    forgetSentPurchases();

    expect(window.localStorage.getItem(PURCHASES_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toBe('accepted');
    expect(() => forgetSentPurchases()).not.toThrow();
    expect(purchaseOnce('booking-1', vi.fn())).toBe(true);
  });

  it('forgetSentPurchases_AStorageThatCannotBeReached_ThrowsNothing', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('Access is denied for this document.', 'SecurityError');
    });

    expect(() => forgetSentPurchases()).not.toThrow();
  });
});
