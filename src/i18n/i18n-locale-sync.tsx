import { useEffect } from 'react';
import i18n from '@/i18n/config';
import { readPersistedLocale } from '@/lib/i18n-labels';

export function I18nLocaleSync() {
  useEffect(() => {
    const stored = readPersistedLocale();
    if (stored && stored !== i18n.language) {
      void i18n.changeLanguage(stored);
    }
  }, []);

  return null;
}
