import { describe, expect, it } from 'vitest';
import { applyProfileFilters, looksLikeContact, readProfileFilters, toListParams } from '../profile-filter-state';

const read = (query: string) => readProfileFilters(new URLSearchParams(query));

describe('the state of the list of CRM profiles lives in the address (E07/F01/US04/T01)', () => {
  it('readProfileFilters_PlainAddress_IsThePlainList', () => {
    expect(read('')).toEqual({
      search: '',
      country: '',
      language: '',
      channel: '',
      tag: '',
      minStays: null,
      email: 'any',
      sort: 'lastStay',
      page: 1,
    });
  });

  it('readProfileFilters_EveryFilter_IsReadFromTheAddress', () => {
    expect(read('q=rossi&country=IT&language=de&channel=Airbnb&tag=vip&minStays=2&email=reachable&sort=spend&page=3')).toEqual({
      search: 'rossi',
      country: 'IT',
      language: 'de',
      channel: 'Airbnb',
      tag: 'vip',
      minStays: 2,
      email: 'reachable',
      sort: 'spend',
      page: 3,
    });
  });

  it('readProfileFilters_ValuesThatAreNotValid_AreIgnored', () => {
    expect(read('channel=Telegram&sort=drop-table&minStays=0&email=maybe&page=-4')).toMatchObject({
      channel: '',
      sort: 'lastStay',
      minStays: null,
      email: 'any',
      page: 1,
    });
    expect(read('minStays=two&page=1.5').minStays).toBeNull();
    expect(read('page=1.5').page).toBe(1);
  });

  it('applyProfileFilters_AnyChangeButThePage_GoesBackToTheFirstPage', () => {
    const next = applyProfileFilters(new URLSearchParams('channel=Airbnb&page=4'), { channel: 'Direct' });

    expect(next.get('channel')).toBe('Direct');
    expect(next.has('page')).toBe(false);
  });

  it('applyProfileFilters_AChangeOfThePage_KeepsTheFiltersAndWritesThePage', () => {
    const next = applyProfileFilters(new URLSearchParams('q=rossi&email=unreachable'), { page: 2 });

    expect(next.get('q')).toBe('rossi');
    expect(next.get('email')).toBe('unreachable');
    expect(next.get('page')).toBe('2');
    // The first page is the default: it is not written.
    expect(applyProfileFilters(next, { page: 1 }).has('page')).toBe(false);
  });

  it('applyProfileFilters_TheDefaults_AreNotWritten', () => {
    const next = applyProfileFilters(new URLSearchParams('sort=name&email=reachable&minStays=3&tag=vip'), {
      sort: 'lastStay',
      email: 'any',
      minStays: null,
      tag: '  ',
    });

    expect(next.toString()).toBe('');
  });

  it('applyProfileFilters_WhatIsNotTheListsOwn_IsLeftAlone', () => {
    const next = applyProfileFilters(new URLSearchParams('detail=booking%3A3f2a&q=old'), { search: 'new' });

    expect(next.get('detail')).toBe('booking:3f2a');
    expect(next.get('q')).toBe('new');
  });

  it.each([
    ['an e-mail address', 'mario.rossi@example.it', true],
    ['the start of an e-mail address that has its at sign', 'mario@', true],
    ['a phone number with the prefix', '+39 333 1234567', true],
    ['a phone number with separators', '(0831) 55.12.34', true],
    ['a name', 'Mario Rossi', false],
    ['the start of a name', 'ros', false],
    ['the first digits of a number', '3331', false],
    ['nothing', '   ', false],
  ])('looksLikeContact_%s_Is%s', (_name, text, expected) => {
    expect(looksLikeContact(text)).toBe(expected);
  });

  it.each(['mario.rossi@example.it', '+39 333 1234567'])('applyProfileFilters_ASearchBy_%s_IsNeverWrittenToTheAddress', (text) => {
    const next = applyProfileFilters(new URLSearchParams('channel=Airbnb&sort=spend&page=3'), { search: text });

    // The rest of the state stays in the address and the list goes back to the first page; the personal data are not in it.
    expect(next.toString()).toBe('channel=Airbnb&sort=spend');
    expect(next.toString()).not.toContain('rossi');
    expect(next.toString()).not.toContain('1234567');
  });

  it('applyProfileFilters_ASearchByEmailAfterAName_TakesTheNameAwayAndWritesNothing', () => {
    expect(applyProfileFilters(new URLSearchParams('q=rossi&channel=Airbnb'), { search: 'anna.verdi@example.it' }).toString()).toBe('channel=Airbnb');
  });

  it('applyProfileFilters_ASearchByName_IsWrittenToTheAddressAsItWas', () => {
    expect(applyProfileFilters(new URLSearchParams('page=2'), { search: ' Mario Rossi ' }).toString()).toBe('q=Mario+Rossi');
  });

  it('toListParams_TheEmailFilter_IsTrueFalseOrNotAsked', () => {
    expect(toListParams(read('email=reachable')).reachableByEmail).toBe(true);
    expect(toListParams(read('email=unreachable')).reachableByEmail).toBe(false);
    expect(toListParams(read('')).reachableByEmail).toBeUndefined();
  });

  it('toListParams_TheState_IsWhatTheApiIsAskedFor', () => {
    expect(toListParams(read('q=rossi&country=IT&channel=BookingCom&minStays=2&sort=stays&page=2'))).toEqual({
      search: 'rossi',
      country: 'IT',
      language: undefined,
      channel: 'BookingCom',
      tag: undefined,
      minStays: 2,
      reachableByEmail: undefined,
      sort: 'stays',
      page: 2,
      pageSize: 20,
    });
  });
});
