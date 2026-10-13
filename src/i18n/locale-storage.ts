/**
 * Language chosen by the user, kept in the browser. Its own module without side effects, so the public site (SEO-VETRINA)
 * can read it without loading the app's i18n instance and every translation (`./config`).
 */
export const LOCALE_STORAGE_KEY = 'casazen.locale';

export type AppLocale = 'it' | 'en';

export function readStoredLocale(): AppLocale {
  if (typeof window === 'undefined') {
    return 'it';
  }

  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === 'it' || stored === 'en') {
    return stored;
  }

  return 'it';
}
