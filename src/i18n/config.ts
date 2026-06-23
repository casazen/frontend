import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { z } from 'zod';
import { i18nZodErrorMap } from './zod-error-map';
import it from './locales/it.json';
import en from './locales/en.json';

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

void i18n.use(initReactI18next).init({
  resources: {
    it: { translation: it },
    en: { translation: en },
  },
  lng: readStoredLocale(),
  fallbackLng: 'it',
  interpolation: { escapeValue: false },
});

z.setErrorMap(i18nZodErrorMap);

export default i18n;
