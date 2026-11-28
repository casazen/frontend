import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import i18n from '@/i18n/config';
import { persistLocale, readPersistedLocale } from '@/lib/i18n-labels';
import { SITE_LANGUAGE_QUERY_KEY, languageOfTag } from '@/lib/site-language';

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
