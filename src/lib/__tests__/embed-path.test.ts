import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOCALE_STORAGE_KEY, readStoredLocale } from '@/i18n/locale-storage';
import { isEmbedPath } from '@/lib/embed-path';
import { isPublicUnauthenticatedPath } from '@/lib/secure-origin';
import { toAppPath, toHostPath } from '@/routes/host-site-window';

/**
 * The pages of the embeddable widgets (NF-144) are frames of other sites: they never mount the sign-in and never read the storage. What
 * recognises them is `isEmbedPath`, which the start-up (the language, the sign-in gate, the landing touch) asks before anything else.
 */
describe('isEmbedPath', () => {
  it.each([
    '/embed',
    '/embed/',
    '/embed/booking',
    '/embed/property/casa-mare',
    '/embed/guest-access',
    '/embed/villa-rossi/booking',
    '/embed/villa-rossi/property/casa-mare',
    '/embed/booking?lang=en&v=1',
    // The router matches a path without looking at the case: what it renders as a widget must read nothing either.
    '/EMBED/booking',
  ])('isEmbedPath_%s_IsAnEmbedPage', (path) => {
    expect(isEmbedPath(path)).toBe(true);
  });

  it.each(['', '/', '/embedded', '/embedx/booking', '/book/embed', '/book/villa-rossi', '/app/embed', '/api/embed/x', '/em'])(
    'isEmbedPath_%s_IsNotAnEmbedPage',
    (path) => {
      expect(isEmbedPath(path)).toBe(false);
    },
  );
});

describe('the pages of the widgets and the rest of the app', () => {
  it.each(['/embed/booking', '/embed/property/casa-mare', '/embed/guest-access'])(
    'isPublicUnauthenticatedPath_%s_NeverMountsTheSignIn',
    (path) => {
      expect(isPublicUnauthenticatedPath(path)).toBe(true);
      expect(isPublicUnauthenticatedPath(`/embed/villa-rossi${path.slice('/embed'.length)}`)).toBe(true);
      expect(isPublicUnauthenticatedPath(`${path}?lang=en&v=1`)).toBe(true);
    },
  );

  it('isPublicUnauthenticatedPath_ConsolePathsThatOnlyLookLikeEmbed_StayBehindTheSignIn', () => {
    expect(isPublicUnauthenticatedPath('/app/embed')).toBe(false);
    expect(isPublicUnauthenticatedPath('/embedded')).toBe(false);
  });

  it.each(['/embed/booking', '/embed/property/casa-mare', '/embed/guest-access'])(
    'toAppPath_%s_IsUnchangedOnAnAgencyHost',
    (path) => {
      // The router window of an agency's domain only rewrites the segments of the booking site: `/embed/…` is the route itself.
      expect(toAppPath(path, 'villa-rossi')).toBe(path);
      expect(toHostPath(path, 'villa-rossi')).toBe(path);
    },
  );
});

describe('readStoredLocale', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it.each([
    ['/embed/booking?lang=en&v=1', 'en'],
    ['/embed/villa-rossi/booking?lang=EN-gb', 'en'],
    ['/embed/booking?lang=it', 'it'],
    ['/embed/booking?lang=de', 'it'],
    ['/embed/booking?lang=', 'it'],
    ['/embed/booking', 'it'],
  ])('readStoredLocale_EmbedPage_%s_IsTheLanguageOfTheAddressAndNeverReadsTheStorage', (address, expected) => {
    // A language chosen on the site is in the storage, and the frame of another site must not see it.
    localStorage.setItem(LOCALE_STORAGE_KEY, expected === 'en' ? 'it' : 'en');
    window.history.replaceState({}, '', address);
    const getItem = vi.spyOn(Storage.prototype, 'getItem');

    expect(readStoredLocale()).toBe(expected);
    expect(getItem).not.toHaveBeenCalled();
  });

  it('readStoredLocale_AnyOtherPage_StillReadsTheLanguageTheGuestChose', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
    window.history.replaceState({}, '', '/book/villa-rossi?lang=it');
    const getItem = vi.spyOn(Storage.prototype, 'getItem');

    expect(readStoredLocale()).toBe('en');
    expect(getItem).toHaveBeenCalledWith(LOCALE_STORAGE_KEY);
  });
});
