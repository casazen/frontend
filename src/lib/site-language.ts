import type { AppLocale } from '@/i18n/locale-storage';

/**
 * The language of a booking site (DB-02b). A guest reads the site in Italian or in English. The address decides first
 * (`?lang=`, a link that someone sends); without it the guest's own earlier choice (kept in the browser) does; without that
 * the site stays in the language the product is written in, Italian. The language of the browser does not decide: the product
 * has always opened in Italian, and the switch of the header is one tap away.
 */

export const SITE_LANGUAGE_QUERY_KEY = 'lang';

export function languageOfTag(tag: string): AppLocale | null {
  const base = tag.trim().toLowerCase().split('-')[0];
  return base === 'it' || base === 'en' ? base : null;
}

export function siteLocale(language: string | undefined): string {
  return language?.toLowerCase().startsWith('en') ? 'en-GB' : 'it-IT';
}
