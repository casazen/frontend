import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIST_RETURN_STORAGE_KEY, recallList, rememberList, withListReturn } from '../list-return';

const BOOKINGS = '/app/short-rent/bookings';

describe('list return (UI-05)', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('rememberList_Filters_AreGivenBackForThatListOnly', () => {
    rememberList(BOOKINGS, '?status=Confirmed&q=rossi');

    expect(recallList(BOOKINGS)).toBe('?status=Confirmed&q=rossi');
    expect(recallList('/app/short-rent/guests')).toBe('');
  });

  it('rememberList_NoFilters_ForgetsWhatWasThere', () => {
    rememberList(BOOKINGS, '?status=Confirmed');

    rememberList(BOOKINGS, '');

    expect(recallList(BOOKINGS)).toBe('');
  });

  it('rememberList_TwoLists_KeepEachItsOwn', () => {
    rememberList(BOOKINGS, '?status=Pending');
    rememberList('/app/short-rent/guests', '?page=2');

    expect(recallList(BOOKINGS)).toBe('?status=Pending');
    expect(recallList('/app/short-rent/guests')).toBe('?page=2');
  });

  it('withListReturn_ListLeftWithFilters_AddsThemToTheAddress', () => {
    rememberList(BOOKINGS, '?status=Confirmed&q=rossi');

    expect(withListReturn(BOOKINGS)).toBe(`${BOOKINGS}?status=Confirmed&q=rossi`);
  });

  it('withListReturn_PageThatIsNotARememberedList_IsLeftAsItIs', () => {
    rememberList(BOOKINGS, '?status=Confirmed');

    expect(withListReturn('/app/short-rent/properties')).toBe('/app/short-rent/properties');
  });

  it('withListReturn_AddressWithItsOwnQueryOrFragment_IsTheCallersChoice', () => {
    rememberList(BOOKINGS, '?status=Confirmed');

    expect(withListReturn(`${BOOKINGS}?propertyId=p-1`)).toBe(`${BOOKINGS}?propertyId=p-1`);
    expect(withListReturn(`${BOOKINGS}#top`)).toBe(`${BOOKINGS}#top`);
  });

  it('recallList_StorageHoldsSomethingElse_IsAsIfNothingWasRemembered', () => {
    sessionStorage.setItem(LIST_RETURN_STORAGE_KEY, '{not json');
    expect(recallList(BOOKINGS)).toBe('');

    sessionStorage.setItem(LIST_RETURN_STORAGE_KEY, JSON.stringify(['?a=1']));
    expect(recallList(BOOKINGS)).toBe('');

    sessionStorage.setItem(LIST_RETURN_STORAGE_KEY, JSON.stringify({ [BOOKINGS]: 'javascript:alert(1)' }));
    expect(recallList(BOOKINGS)).toBe('');
    expect(withListReturn(BOOKINGS)).toBe(BOOKINGS);
  });

  it('rememberList_StorageRefusesToWrite_DoesNotBreakThePage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    expect(() => rememberList(BOOKINGS, '?status=Confirmed')).not.toThrow();
    expect(withListReturn(BOOKINGS)).toBe(BOOKINGS);
  });
});
