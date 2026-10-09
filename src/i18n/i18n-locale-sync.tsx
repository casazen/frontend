import { useEffect } from 'react';
import i18n from '@/i18n/config';
import { readPersistedLocale } from '@/lib/i18n-labels';

/**
 * `<html lang>` follows the language of the interface (UI-03, a11y): a screen reader picks its voice from it, the browser
 * the hyphenation and the offer to translate the page. `index.html` only carries the default.
 */
function applyHtmlLang(language: string) {
  document.documentElement.lang = language.split('-')[0];
}

export function I18nLocaleSync() {
  useEffect(() => {
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
