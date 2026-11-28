import i18next, { type i18n as I18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { site as itSite } from '@/i18n/locales/it.json';
import { site as enSite } from '@/i18n/locales/en.json';

export type SiteLocale = 'it' | 'en';

export function createSiteI18n(lng: SiteLocale): I18n {
  const instance = i18next.createInstance();
  void instance.use(initReactI18next).init({
    resources: {
      it: { translation: { site: itSite } },
      en: { translation: { site: enSite } },
    },
    lng,
    fallbackLng: 'it',
    interpolation: { escapeValue: false },
    initAsync: false,
  });
  return instance;
}
