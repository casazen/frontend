import { isEmbedPath } from '@/lib/embed-path';
import { languageOfTag } from '@/lib/site-language';

export const LOCALE_STORAGE_KEY = 'casazen.locale';

export type AppLocale = 'it' | 'en';

export function readStoredLocale(): AppLocale {
  if (typeof window === 'undefined') {
    return 'it';
  }

  if (isEmbedPath(window.location.pathname)) {
    return languageOfTag(new URLSearchParams(window.location.search).get('lang') ?? '') ?? 'it';
  }

  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === 'it' || stored === 'en') {
    return stored;
  }

  return 'it';
}
