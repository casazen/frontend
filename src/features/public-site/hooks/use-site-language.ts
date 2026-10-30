import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import i18n from '@/i18n/config';
import { persistLocale, readPersistedLocale } from '@/lib/i18n-labels';
import { SITE_LANGUAGE_QUERY_KEY, languageOfTag } from '@/lib/site-language';

/**
 * Opens the booking site in the language of the guest (DB-02b): the language of the address (`?lang=`), else the one the guest
 * chose before; with neither, the interface keeps the language it started with (Italian). An address that asks for a language
 * keeps it for the pages that follow (their links do not carry it), as the switch of the header does. The `<html lang>`
 * follows the language of the interface (`I18nLocaleSync`). Only for the site of a host: the pages of CasaZen itself keep the
 * language of the app.
 */
export function useSiteLanguage(enabled: boolean): void {
  const [searchParams] = useSearchParams();
  const asked = searchParams.get(SITE_LANGUAGE_QUERY_KEY);

  useEffect(() => {
    if (!enabled) return;
    const fromAddress = asked ? languageOfTag(asked) : null;
    if (fromAddress) persistLocale(fromAddress);
    const wanted = fromAddress ?? readPersistedLocale();
    if (wanted && !i18n.language.startsWith(wanted)) void i18n.changeLanguage(wanted);
  }, [enabled, asked]);
}
