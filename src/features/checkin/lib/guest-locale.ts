import { useEffect, useRef } from 'react';
import i18n from '@/i18n/config';

/**
 * The languages of the guest check-in page (NF-40): Italian, English, German, French and Spanish. This is the language of the page
 * only, for the time the guest is on it: it is not the language of the app (`AppLocale`, `it` or `en`, kept for the host in the
 * browser), which this module never reads or writes.
 */
export const GUEST_LOCALES = ['it', 'en', 'de', 'fr', 'es'] as const;

export type GuestLocale = (typeof GUEST_LOCALES)[number];

/** The language when nothing else is known. */
export const DEFAULT_GUEST_LOCALE: GuestLocale = 'it';

/**
 * The languages in the order the page offers them, each with the key of its name written in the language itself ("Deutsch"). The keys
 * are written out so that the i18n test finds a missing translation.
 */
export const GUEST_LOCALE_OPTIONS: ReadonlyArray<{ locale: GuestLocale; nameKey: string }> = [
  { locale: 'it', nameKey: 'checkin.language.names.it' },
  { locale: 'en', nameKey: 'checkin.language.names.en' },
  { locale: 'de', nameKey: 'checkin.language.names.de' },
  { locale: 'fr', nameKey: 'checkin.language.names.fr' },
  { locale: 'es', nameKey: 'checkin.language.names.es' },
];

/** `it` and `en` come with the app; the other three are loaded when the guest chooses them. */
type LazyGuestLocale = Exclude<GuestLocale, 'it' | 'en'>;

const LAZY_BUNDLES: Record<LazyGuestLocale, () => Promise<{ default: Record<string, unknown> }>> = {
  de: () => import('@/i18n/locales/guest-checkin.de.json'),
  fr: () => import('@/i18n/locales/guest-checkin.fr.json'),
  es: () => import('@/i18n/locales/guest-checkin.es.json'),
};

function isGuestLocale(value: string): value is GuestLocale {
  return (GUEST_LOCALES as readonly string[]).includes(value);
}

/** The language of the page a tag stands for (as the API writes it, `de`, or as a browser does, `de-CH`), or null for any other. */
function knownLocaleOf(language: string): GuestLocale | null {
  const primary = language.trim().toLowerCase().split(/[-_]/)[0];
  return isGuestLocale(primary) ? primary : null;
}

/**
 * The language of the page from what the API resolved (the guest's earlier choice, else the one of the browser): a language the
 * page offers, as the API wrote it (`de`) or as a browser does (`de-CH`), else Italian. Pure.
 */
export function resolveGuestLocale(language: string | null | undefined): GuestLocale {
  return knownLocaleOf(language ?? '') ?? DEFAULT_GUEST_LOCALE;
}

/**
 * The languages the guest can choose: those of `supportedLanguages` that the page has texts for, in the order of the page; all five
 * when the API says nothing (a page that is not an open session).
 */
export function offeredGuestLocales(supportedLanguages: readonly string[] | null | undefined): GuestLocale[] {
  const all = GUEST_LOCALE_OPTIONS.map((option) => option.locale);
  const offered = new Set((supportedLanguages ?? []).map(knownLocaleOf).filter((locale): locale is GuestLocale => locale !== null));
  return offered.size === 0 ? all : all.filter((locale) => offered.has(locale));
}

/**
 * Makes the texts of `locale` available: nothing for Italian and English, the subset file of the page (only the keys of the `checkin`
 * namespace) for the other three, added to the app's i18n instance the first time they are chosen. A key a subset file lacks falls
 * back to English, then Italian (`src/i18n/config.ts`).
 */
export async function ensureGuestLocale(locale: GuestLocale): Promise<void> {
  if (locale === 'it' || locale === 'en') return;
  if (i18n.hasResourceBundle(locale, 'translation')) return;
  const bundle = await LAZY_BUNDLES[locale]();
  i18n.addResourceBundle(locale, 'translation', bundle.default, true, false);
}

/**
 * Shows the page in `locale` for as long as it is mounted: the subset file of the language is loaded when it is needed, the i18n
 * instance changes language, and `<html lang>` follows, so that a screen reader and the browser pick the right voice and hyphenation. The
 * choice lives for the page only: nothing is written to the browser (the language the host chose for the app, `AppLocale`, stays
 * where it is), and when the page closes the app goes back to the language it had when the page opened.
 *
 * If the texts of the language cannot be loaded (the network), the page keeps the language it has, `<html lang>` says so, and `onLoadFailed`
 * receives that language so the page can show it again and tell the guest. It must be stable (a `useCallback`): it is a dependency.
 */
export function useGuestPageLocale(locale: GuestLocale, onLoadFailed?: (stayedIn: GuestLocale) => void): void {
  // The app's own instance, not the one `useTranslation` hands back: that one is a new object for each language, and an effect that
  // depends on it would run again (and undo) every time the language changes.
  const opened = useRef(i18n.language);

  useEffect(() => {
    let current = true;
    document.documentElement.lang = locale;
    ensureGuestLocale(locale)
      .then(() => {
        if (current) void i18n.changeLanguage(locale);
      })
      .catch(() => {
        if (!current) return;
        const stayedIn = resolveGuestLocale(i18n.language);
        document.documentElement.lang = stayedIn;
        onLoadFailed?.(stayedIn);
      });
    return () => {
      current = false;
    };
  }, [locale, onLoadFailed]);

  useEffect(() => {
    const appLanguage = opened.current;
    return () => {
      void i18n.changeLanguage(appLanguage);
      document.documentElement.lang = appLanguage.split('-')[0];
    };
  }, []);
}
