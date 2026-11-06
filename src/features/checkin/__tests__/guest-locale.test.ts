import { afterEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import { GUEST_LOCALES, ensureGuestLocale, offeredGuestLocales, resolveGuestLocale } from '../lib/guest-locale';

describe('resolveGuestLocale', () => {
  it.each(['it', 'en', 'de', 'fr', 'es'] as const)('resolveGuestLocale_SupportedLanguage_%s_IsKept', (language) => {
    expect(resolveGuestLocale(language)).toBe(language);
  });

  it('resolveGuestLocale_RegionAndCase_ReadsThePrimaryLanguage', () => {
    expect(resolveGuestLocale('DE')).toBe('de');
    expect(resolveGuestLocale('de-CH')).toBe('de');
    expect(resolveGuestLocale('fr_BE')).toBe('fr');
    expect(resolveGuestLocale(' es ')).toBe('es');
  });

  it('resolveGuestLocale_UnsupportedOrMissing_IsItalian', () => {
    expect(resolveGuestLocale('pt')).toBe('it');
    expect(resolveGuestLocale('zh-Hans')).toBe('it');
    expect(resolveGuestLocale('')).toBe('it');
    expect(resolveGuestLocale(undefined)).toBe('it');
    expect(resolveGuestLocale(null)).toBe('it');
  });

  it('guestLocales_ThePageOffers_AreTheFiveOfNf40InTheOrderOfThePage', () => {
    expect([...GUEST_LOCALES]).toEqual(['it', 'en', 'de', 'fr', 'es']);
  });
});

describe('offeredGuestLocales', () => {
  it('offeredGuestLocales_NothingSaid_OffersAllFive', () => {
    expect(offeredGuestLocales(undefined)).toEqual(['it', 'en', 'de', 'fr', 'es']);
    expect(offeredGuestLocales([])).toEqual(['it', 'en', 'de', 'fr', 'es']);
  });

  it('offeredGuestLocales_ApiList_KeepsTheLanguagesThePageHasInTheOrderOfThePage', () => {
    expect(offeredGuestLocales(['es', 'zz', 'en'])).toEqual(['en', 'es']);
  });
});

// The first import of a subset file is a dynamic import: on a loaded machine it takes longer than the default 5 s.
describe('ensureGuestLocale', { timeout: 20_000 }, () => {
  afterEach(() => {
    for (const language of ['de', 'fr', 'es']) i18n.removeResourceBundle(language, 'translation');
  });

  it('ensureGuestLocale_ItalianAndEnglish_LoadNothing', async () => {
    await ensureGuestLocale('it');
    await ensureGuestLocale('en');

    expect(i18n.hasResourceBundle('de', 'translation')).toBe(false);
  });

  it.each([
    ['de', 'Weiter'],
    ['fr', 'Suivant'],
    ['es', 'Siguiente'],
  ] as const)('ensureGuestLocale_%s_LoadsTheSubsetFileOnlyWhenChosen', async (language, next) => {
    expect(i18n.hasResourceBundle(language, 'translation')).toBe(false);

    await ensureGuestLocale(language);

    expect(i18n.hasResourceBundle(language, 'translation')).toBe(true);
    expect(i18n.getFixedT(language)('checkin.next')).toBe(next);
    // The subset holds the keys of the page only: the app's own texts are not duplicated in it.
    expect(i18n.getResource(language, 'translation', 'nav')).toBeUndefined();
  });

  it('ensureGuestLocale_CalledTwice_KeepsOneBundle', async () => {
    await ensureGuestLocale('de');
    await ensureGuestLocale('de');

    expect(i18n.getFixedT('de')('checkin.back')).toBe('Zurück');
  });

  it('fallbackChain_KeyMissingInGerman_FallsBackToEnglishThenItalian', async () => {
    await ensureGuestLocale('de');

    // A key of the host side, not in the German subset: English answers.
    expect(i18n.getFixedT('de')('checkin.link.copyTitle')).toBe(i18n.getFixedT('en')('checkin.link.copyTitle'));
    expect(i18n.getFixedT('de')('checkin.link.copyTitle')).not.toBe(i18n.getFixedT('it')('checkin.link.copyTitle'));
    // A key only Italian has: Italian answers.
    i18n.addResource('it', 'translation', 'test.onlyItalian', 'Solo in italiano');
    expect(i18n.getFixedT('de')('test.onlyItalian')).toBe('Solo in italiano');
  });
});
