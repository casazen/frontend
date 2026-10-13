import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LOCALE_STORAGE_KEY } from '@/i18n/locale-storage';
import { SEO_HUB_PATH } from '@/features/public-seo/seo-paths';
import { LEGAL_DOCUMENT_PATHS, LEGAL_INDEX_PATH, LEGAL_SUBPROCESSORS_PATH } from '@/features/legal/legal-paths';
import { sitePageById, type SitePageId } from '../site-pages';
import type { SiteLegal } from '../site-config';
import { signupHref } from '../site-links';

interface SiteLayoutProps {
  current: SitePageId;
  legal: SiteLegal;
  /** Year of the copyright line, fixed by the build so the static HTML and the browser render the same text. */
  year: number;
  children: ReactNode;
}

const NAV: { id: SitePageId; key: string }[] = [
  { id: 'features', key: 'site.nav.features' },
  { id: 'pricing', key: 'site.nav.pricing' },
  { id: 'suppliers', key: 'site.nav.suppliers' },
  { id: 'about', key: 'site.nav.about' },
];

/** Header, main area and footer of every page of the public site (SEO-VETRINA). Plain links: no client-side router. */
export function SiteLayout({ current, legal, year, children }: SiteLayoutProps) {
  const { t, i18n } = useTranslation();

  const switchLanguage = () => {
    const next = i18n.language === 'en' ? 'it' : 'en';
    // Same key as the app: the language chosen here is the one the app opens with, and the reverse.
    localStorage.setItem(LOCALE_STORAGE_KEY, next);
    document.documentElement.lang = next;
    void i18n.changeLanguage(next);
  };

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <a href="/" className="text-xl font-semibold tracking-tight" aria-label={t('site.nav.home')}>
            CasaZen
          </a>
          <nav aria-label={t('site.nav.main')} className="order-3 w-full sm:order-none sm:w-auto">
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {NAV.map((item) => (
                <li key={item.id}>
                  <a
                    href={sitePageById(item.id).path}
                    aria-current={current === item.id ? 'page' : undefined}
                    className={current === item.id ? 'font-semibold text-indigo-700' : 'text-slate-700 hover:text-indigo-700'}
                  >
                    {t(item.key)}
                  </a>
                </li>
              ))}
              <li>
                <a href={SEO_HUB_PATH} className="text-slate-700 hover:text-indigo-700">
                  {t('site.nav.guides')}
                </a>
              </li>
            </ul>
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              onClick={switchLanguage}
              aria-label={t('site.nav.switchLanguageLabel')}
              className="text-slate-600 hover:text-indigo-700"
            >
              {t('site.nav.switchLanguage')}
            </button>
            <a href="/login" className="text-slate-700 hover:text-indigo-700">
              {t('site.nav.login')}
            </a>
            <a
              href={signupHref(current, 'header')}
              className="rounded-md bg-indigo-700 px-3 py-2 font-medium text-white hover:bg-indigo-800"
            >
              {t('site.nav.signup')}
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-200 bg-slate-50 text-sm text-slate-600">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-4">
          <div>
            <p className="font-semibold text-slate-900">CasaZen</p>
            <p className="mt-2">{t('site.footer.tagline')}</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">{t('site.footer.productTitle')}</p>
            <ul className="mt-2 space-y-1">
              {NAV.map((item) => (
                <li key={item.id}>
                  <a href={sitePageById(item.id).path} className="hover:text-indigo-700">
                    {t(item.key)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-slate-900">{t('site.footer.resourcesTitle')}</p>
            <ul className="mt-2 space-y-1">
              <li>
                <a href={SEO_HUB_PATH} className="hover:text-indigo-700">
                  {t('site.footer.guides')}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-slate-900">{t('site.footer.legalTitle')}</p>
            <ul className="mt-2 space-y-1">
              <li>
                <a href={LEGAL_DOCUMENT_PATHS.privacy} className="hover:text-indigo-700">
                  {t('site.footer.privacy')}
                </a>
              </li>
              <li>
                <a href={LEGAL_DOCUMENT_PATHS.tos} className="hover:text-indigo-700">
                  {t('site.footer.terms')}
                </a>
              </li>
              <li>
                <a href={LEGAL_SUBPROCESSORS_PATH} className="hover:text-indigo-700">
                  {t('site.footer.subprocessors')}
                </a>
              </li>
              <li>
                <a href={LEGAL_INDEX_PATH} className="hover:text-indigo-700">
                  {t('site.footer.legalIndex')}
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-200">
          {/* Company data on every page, the home page included (art. 35 DPR 633/1972): only what is configured. */}
          <div className="mx-auto flex max-w-6xl flex-wrap gap-x-3 gap-y-1 px-4 py-4 text-xs">
            <span>{t('site.footer.rights', { year })}</span>
            {legal.name && <span>{legal.name}</span>}
            {legal.vatId && <span>{t('site.footer.vatId', { vatId: legal.vatId })}</span>}
            {legal.address && <span>{legal.address}</span>}
            {legal.email && (
              <span>
                {t('site.footer.contact')}:{' '}
                <a href={`mailto:${legal.email}`} className="hover:text-indigo-700">
                  {legal.email}
                </a>
              </span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
