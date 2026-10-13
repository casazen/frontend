import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readRecents, recentsKey, rememberRecent, type RecentScope } from '../recents';

const SCOPE: RecentScope = { userId: 'auth0|demo-user', area: 'short-rent' };

describe('recents of the palette (UI-06)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('RememberRecent_ThingsChosen_ComeBackLatestFirstWithoutRepeats', () => {
    rememberRecent(SCOPE, 'page:/app/short-rent/bookings');
    rememberRecent(SCOPE, 'property:p1');
    rememberRecent(SCOPE, 'page:/app/short-rent/bookings');

    expect(readRecents(SCOPE)).toEqual(['page:/app/short-rent/bookings', 'property:p1']);
  });

  it('RememberRecent_MoreThanEight_ForgetsTheOldest', () => {
    for (let index = 1; index <= 10; index += 1) rememberRecent(SCOPE, `page:${index}`);

    const recents = readRecents(SCOPE);

    expect(recents).toHaveLength(8);
    expect(recents[0]).toBe('page:10');
    expect(recents).not.toContain('page:1');
    expect(recents).not.toContain('page:2');
  });

  it('RememberRecent_Keeps_OnlyTheIdsAndNothingTheUserTyped', () => {
    rememberRecent(SCOPE, 'guest:g1');

    const stored = Object.entries(localStorage);

    // One entry, which is a list of ids: no name of a guest, no label, no text of a search.
    expect(stored).toHaveLength(1);
    expect(JSON.parse(stored[0][1])).toEqual(['guest:g1']);
  });

  it('RecentsKey_UserAndArea_AreInTheKeyAndNeverMixed', () => {
    rememberRecent(SCOPE, 'a');
    rememberRecent({ ...SCOPE, area: 'long-rent' }, 'b');
    rememberRecent({ ...SCOPE, userId: 'someone-else' }, 'c');

    expect(readRecents(SCOPE)).toEqual(['a']);
    expect(readRecents({ ...SCOPE, area: 'long-rent' })).toEqual(['b']);
    expect(readRecents({ ...SCOPE, userId: 'someone-else' })).toEqual(['c']);
    expect(readRecents({ ...SCOPE, area: 'admin' })).toEqual([]);
    // The id of the user is written so that it cannot break the key.
    expect(recentsKey(SCOPE)).toBe('casazen:palette:recent:auth0%7Cdemo-user:short-rent');
  });

  it('ReadRecents_DamagedStorage_GivesNothingInsteadOfBreaking', () => {
    localStorage.setItem(recentsKey(SCOPE), '{not json');
    expect(readRecents(SCOPE)).toEqual([]);

    localStorage.setItem(recentsKey(SCOPE), JSON.stringify({ a: 1 }));
    expect(readRecents(SCOPE)).toEqual([]);

    localStorage.setItem(recentsKey(SCOPE), JSON.stringify(['ok', 3, null, '', { id: 'x' }]));
    expect(readRecents(SCOPE)).toEqual(['ok']);
  });

  it('Recents_StorageThatThrows_IsTheSameAsNoRecents', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });

    expect(() => rememberRecent(SCOPE, 'a')).not.toThrow();
    expect(readRecents(SCOPE)).toEqual([]);
  });
});
