import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { z } from 'zod';
import { i18nZodErrorMap, setZodErrorMapI18n } from './zod-error-map';
import { APP_RESOURCES } from './resources';
import { readStoredLocale } from './locale-storage';

export { LOCALE_STORAGE_KEY, type AppLocale } from './locale-storage';

void i18n.use(initReactI18next).init({
  resources: APP_RESOURCES,
  lng: readStoredLocale(),
  fallbackLng: { default: ['it'], de: ['en', 'it'], fr: ['en', 'it'], es: ['en', 'it'] },
  interpolation: { escapeValue: false },
});

setZodErrorMapI18n(i18n);
z.setErrorMap(i18nZodErrorMap);

export default i18n;
