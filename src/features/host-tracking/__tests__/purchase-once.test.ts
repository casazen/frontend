import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSENT_STORAGE_KEY } from '@/lib/cookie-consent';
import { MAX_REMEMBERED_PURCHASES, PURCHASES_STORAGE_KEY, purchaseOnce } from '../purchase-once';

/**
 * A booking is one `purchase` of the agency's analytics, never two (E41/F04/US01/T01, NF-149). Money data: a second push of the same booking counts its
 * value twice in the agency's reports. What remembers it is the own `localStorage` of the agency's domain, written only after the consent.
 */
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

    // The first view of the confirmation pushes; a reload, a second tab and the link of the e-mail opened a week later are all the same call again.
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

    // The most recent one is still remembered; the one that fell off the list is not.
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

    // "Once" could not be kept, so the purchase is not counted.
    expect(purchaseOnce('booking-1', push)).toBe(false);

    expect(push).not.toHaveBeenCalled();
  });

  it('purchaseOnce_remembersTheBookingBeforeItPushes', () => {
    accept();
    let seenByThePush: string[] | null = null;

    purchaseOnce('booking-1', () => {
      seenByThePush = stored();
    });

    // A crash between the two loses one purchase and never counts one twice.
    expect(seenByThePush).toEqual(['booking-1']);
  });
});
