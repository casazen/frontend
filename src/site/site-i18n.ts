import i18next, { type i18n as I18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
// Named imports: Vite keeps only the `site` texts in the bundle of the public site, not the whole app (SEO-VETRINA).
import { site as itSite } from '@/i18n/locales/it.json';
import { site as enSite } from '@/i18n/locales/en.json';

export type SiteLocale = 'it' | 'en';

/**
 * A dedicated i18next instance for the public site: the `site.*` keys of `it.json` and `en.json` only. The static HTML is
 * rendered in Italian (the language of the pages and of their single URL); a visitor who chose English in the app sees the
 * page in English once it starts in the browser (same storage key as the app).
 */
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
