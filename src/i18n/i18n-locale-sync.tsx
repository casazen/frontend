import { useEffect } from 'react';
import i18n from '@/i18n/config';
import { isEmbedPath } from '@/lib/embed-path';
import { readPersistedLocale } from '@/lib/i18n-labels';

function applyHtmlLang(language: string) {
  document.documentElement.lang = language.split('-')[0];
}

export function I18nLocaleSync() {
  useEffect(() => {
    if (isEmbedPath(window.location.pathname)) return;
    const stored = readPersistedLocale();
    if (stored && stored !== i18n.language) {
      void i18n.changeLanguage(stored);
    }
  }, []);

  useEffect(() => {
    applyHtmlLang(i18n.language);
    i18n.on('languageChanged', applyHtmlLang);
    return () => {
      i18n.off('languageChanged', applyHtmlLang);
    };
  }, []);

  return null;
}
