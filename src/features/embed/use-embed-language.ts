import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { AppLocale } from '@/i18n/locale-storage';
import { SITE_LANGUAGE_QUERY_KEY, languageOfTag } from '@/lib/site-language';

/**
 * The language of a page of the embeddable widgets (NF-144): the one `?lang=it|en` of the address asks for, else Italian. It is kept
 * in memory only, in the interface (`i18n.changeLanguage`) and on `<html lang>`; it is never written to the storage, which
 * `useSiteLanguage` does and which the frame of another site must not need (a browser that blocks it must not break the widget), and
 * it is never read from there. `override` is the language the page that loaded the widget asked for (`config.lang`): it wins over the address.
 */
export function useEmbedLanguage(override: AppLocale | null = null): AppLocale {
  const [searchParams] = useSearchParams();
  const fromAddress = languageOfTag(searchParams.get(SITE_LANGUAGE_QUERY_KEY) ?? '') ?? 'it';
  const lang = override ?? fromAddress;

  useEffect(() => {
    if (!i18n.language.startsWith(lang)) void i18n.changeLanguage(lang);
    document.documentElement.lang = lang;
  }, [lang]);

  return lang;
}
