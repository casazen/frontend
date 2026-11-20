import { isEmbedPath } from '@/lib/embed-path';
import { languageOfTag } from '@/lib/site-language';

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

  // A page of the embeddable widgets (NF-144) is a frame of another site and never reads the storage (a browser that blocks it must
  // not break the widget): it opens in the language its address asks for (`?lang=it|en`), else in Italian. This runs at import time.
  if (isEmbedPath(window.location.pathname)) {
    return languageOfTag(new URLSearchParams(window.location.search).get('lang') ?? '') ?? 'it';
  }

  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === 'it' || stored === 'en') {
    return stored;
  }

  return 'it';
}
