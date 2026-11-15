import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { readStay, siteLink, stayHref, writeStay } from '../stay-state';
import { useStayState } from '../use-stay-state';

const TODAY = '2026-11-02';
const search = (query: string) => new URLSearchParams(query);

describe('readStay', () => {
  it('readStay_AddressWithAStay_ReadsDatesAdultsChildrenAndPets', () => {
    const { stay, problems } = readStay(
      search('checkin=2026-11-10&checkout=2026-11-13&guests=4&children=1&pets=1'),
      { today: TODAY, maxGuests: 6, petsAllowed: true },
    );

    expect(stay).toEqual({ checkIn: '2026-11-10', checkOut: '2026-11-13', adults: 3, children: 1, pets: true });
    expect(problems).toEqual([]);
  });

  it('readStay_ArrivalInThePast_DropsTheDatesAndSaysSo', () => {
    const { stay, problems } = readStay(search('checkin=2026-10-01&checkout=2026-10-05'), { today: TODAY });

    expect(stay).toMatchObject({ checkIn: '', checkOut: '' });
    expect(problems).toContain('checkInPast');
  });

  it('readStay_DepartureNotAfterTheArrival_DropsTheDeparture', () => {
    const { stay, problems } = readStay(search('checkin=2026-11-10&checkout=2026-11-10'), { today: TODAY });

    expect(stay).toMatchObject({ checkIn: '2026-11-10', checkOut: '' });
    expect(problems).toContain('checkOutNotAfterCheckIn');
  });

  it('readStay_MorePeopleThanTheHomeTakesAndAPetItDoesNot_AreReportedAndKept', () => {
    const { stay, problems } = readStay(search('guests=7&pets=true'), { today: TODAY, maxGuests: 4, petsAllowed: false });

    // The pet is not dropped: a guest who said it travels with one must be told the home takes none, not booked in without it.
    expect(stay).toMatchObject({ adults: 7, pets: true });
    expect(problems).toEqual(['overCapacity', 'petsNotAllowed']);
  });

  it('readStay_APetAndAHomeThatDoesNotSayIfItTakesThem_IsNotAProblem', () => {
    const { stay, problems } = readStay(search('pets=1'), { today: TODAY });

    expect(stay.pets).toBe(true);
    expect(problems).toEqual([]);
  });
});

describe('writeStay', () => {
  it('writeStay_ChangesTheStay_KeepsTheOtherParameters', () => {
    const next = writeStay(search('lang=en&dove=salento&checkin=2026-11-10'), { checkOut: '2026-11-13', adults: 2, children: 1, pets: true });

    expect(Object.fromEntries(next)).toEqual({
      lang: 'en',
      dove: 'salento',
      checkin: '2026-11-10',
      checkout: '2026-11-13',
      guests: '3',
      children: '1',
      pets: '1',
    });
  });

  it('writeStay_EmptyDatesAndNoPet_RemoveThemFromTheAddress', () => {
    const next = writeStay(search('checkin=2026-11-10&checkout=2026-11-13&guests=2&pets=1'), { checkIn: '', checkOut: '', pets: false });

    expect(Object.fromEntries(next)).toEqual({ guests: '2' });
  });

  it('stayHref_Path_CarriesTheStayToThePage', () => {
    expect(stayHref('/book/demo/property/casa', { checkIn: '2026-11-10', checkOut: '2026-11-13', adults: 2, children: 0, pets: false })).toBe(
      '/book/demo/property/casa?checkin=2026-11-10&checkout=2026-11-13&guests=2',
    );
  });
});

describe('siteLink (E27/F01/US02, NF-123)', () => {
  const stay = { checkIn: '2026-11-10', checkOut: '2026-11-13', adults: 2, children: 0, pets: false };

  it('siteLink_AddressWithTheSourceOfALink_CarriesItWithTheStayToTheCheckout', () => {
    const link = siteLink(
      '/book/demo/property/casa/checkout',
      stay,
      search('checkin=2026-11-10&checkout=2026-11-13&guests=2&utm_source=agency-site&utm_medium=link&utm_campaign=estate-2026&lang=en'),
    );

    // The stay first and the source after it; only the three values the booking keeps, not the language or anything else of the address.
    expect(link).toBe(
      '/book/demo/property/casa/checkout?checkin=2026-11-10&checkout=2026-11-13&guests=2&utm_source=agency-site&utm_medium=link&utm_campaign=estate-2026',
    );
  });

  it('siteLink_AddressWithNoSource_IsTheLinkOfTheStayAsItWas', () => {
    expect(siteLink('/book/demo/property/casa/checkout', stay, search('lang=en&where=salento'))).toBe(stayHref('/book/demo/property/casa/checkout', stay));
  });

  it('siteLink_SourceThatIsNotAValueTheBookingKeeps_IsNotCarried', () => {
    const link = siteLink('/book/demo/property/casa/checkout', stay, search('utm_source=agency%20site&utm_campaign=mario.rossi%40example.com&utm_medium=link'));

    expect(link).toBe('/book/demo/property/casa/checkout?checkin=2026-11-10&checkout=2026-11-13&guests=2&utm_medium=link');
    expect(link.toLowerCase()).not.toMatch(/mario|example|agency%20site/);
  });
});

describe('useStayState', () => {
  afterEach(() => cleanup());

  function renderStay(url: string) {
    const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>;
    return renderHook(() => ({ state: useStayState({ today: TODAY, maxGuests: 6, petsAllowed: true }), location: useLocation() }), { wrapper });
  }

  it('setStay_QuickEditsBeforeTheNextRender_AllLand', () => {
    const { result } = renderStay('/book/demo/property/p1');

    act(() => {
      result.current.state.setStay({ checkIn: '2026-11-10' });
      result.current.state.setStay({ checkOut: '2026-11-13' });
      result.current.state.setStay({ adults: 2, children: 1, pets: true });
    });

    expect(result.current.state.stay).toEqual({ checkIn: '2026-11-10', checkOut: '2026-11-13', adults: 2, children: 1, pets: true });
    expect(result.current.state.guests).toBe(3);
    expect(Object.fromEntries(new URLSearchParams(result.current.location.search))).toEqual({
      checkin: '2026-11-10',
      checkout: '2026-11-13',
      guests: '3',
      children: '1',
      pets: '1',
    });
  });

  it('clearDates_AStayOnTheAddress_KeepsTheGuests', () => {
    const { result } = renderStay('/x?checkin=2026-11-10&checkout=2026-11-13&guests=3');

    act(() => result.current.state.clearDates());

    expect(result.current.state.stay).toMatchObject({ checkIn: '', checkOut: '', adults: 3 });
  });

  it('linkTo_PageOfAHomeOpenedFromALinkOfTheAgency_CarriesTheSourceToTheCheckoutAndStoresNothing', () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    const { result } = renderStay('/book/demo/property/p1?checkin=2026-11-10&checkout=2026-11-13&guests=2&utm_source=agency-site&utm_medium=link&utm_campaign=estate-2026');

    expect(result.current.state.linkTo('/book/demo/property/p1/checkout')).toBe(
      '/book/demo/property/p1/checkout?checkin=2026-11-10&checkout=2026-11-13&guests=2&utm_source=agency-site&utm_medium=link&utm_campaign=estate-2026',
    );
    // It travels in the address and nowhere else: nothing of it on the device.
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('linkTo_StayChangedAfterTheLinkWasOpened_KeepsTheSourceAndTakesTheNewStay', () => {
    const { result } = renderStay('/x?utm_source=agency-site&utm_medium=link');

    act(() => result.current.state.setStay({ checkIn: '2026-11-10', checkOut: '2026-11-13' }));

    expect(result.current.state.linkTo('/x/checkout')).toBe('/x/checkout?checkin=2026-11-10&checkout=2026-11-13&guests=2&utm_source=agency-site&utm_medium=link');
  });
});
