import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { z } from 'zod';
import { i18nZodErrorMap, setZodErrorMapI18n } from './zod-error-map';
import it from './locales/it.json';
import en from './locales/en.json';
import ownerSetupIt from './locales/property-owner-it.json';
import ownerSetupEn from './locales/property-owner-en.json';
import { readStoredLocale } from './locale-storage';

export { LOCALE_STORAGE_KEY, type AppLocale } from './locale-storage';

void i18n.use(initReactI18next).init({
  resources: {
    it: { translation: it },
    en: { translation: en },
  },
  lng: readStoredLocale(),
  // A text a language lacks falls back to Italian. The three languages of the guest check-in page (their subset files are
  // loaded when chosen) fall back to English first, then to Italian.
  fallbackLng: { default: ['it'], de: ['en', 'it'], fr: ['en', 'it'], es: ['en', 'it'] },
  interpolation: { escapeValue: false },
});

i18n.addResourceBundle('it', 'translation', ownerSetupIt, true, true);
i18n.addResourceBundle('en', 'translation', ownerSetupEn, true, true);

// Break circular dependency: zod-error-map no longer imports i18n directly.
setZodErrorMapI18n(i18n);
z.setErrorMap(i18nZodErrorMap);

export default i18n;
