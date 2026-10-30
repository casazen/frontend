import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CasaZenLogo } from '@/components/brand/casazen-mark';
import { LOCALE_STORAGE_KEY } from '@/i18n/locale-storage';
import { SEO_HUB_PATH } from '@/features/public-seo/seo-paths';
import { LEGAL_DOCUMENT_PATHS, LEGAL_INDEX_PATH, LEGAL_SUBPROCESSORS_PATH } from '@/features/legal/legal-paths';
import { SEARCH_PATH, sitePageById, type SitePageId } from '../site-pages';
import type { SiteLegal } from '../site-config';
import { inviteHref } from '../site-links';

interface SiteLayoutProps {
  current: SitePageId;
  legal: SiteLegal;
  /** Year of the copyright line, fixed by the build so the static HTML and the browser render the same text. */
  year: number;
  /** The "Accedi" link of the header: not on the production site (`src/config/login-entry.ts`). */
  showLogin: boolean;
  children: ReactNode;
}

const NAV: { id: SitePageId; key: string }[] = [
  { id: 'features', key: 'site.nav.features' },
  { id: 'suppliers', key: 'site.nav.suppliers' },
  { id: 'about', key: 'site.nav.about' },
];

const FOOTER_LINK = 'text-ink-200 hover:text-white hover:underline underline-offset-4';

/** Header, main area and footer of every page of the public site (SEO-VETRINA). Plain links: no client-side router. */
export function SiteLayout({ current, legal, year, showLogin, children }: SiteLayoutProps) {
  const { t, i18n } = useTranslation();
  // The invitation request in the header (only with a contact address): on the production site, where there is no "Accedi",
  // it is the one action the header offers.
  const inviteLink = inviteHref(legal.email, t('site.invite.subject'));

  const switchLanguage = () => {
    const next = i18n.language === 'en' ? 'it' : 'en';
    // Same key as the app: the language chosen here is the one the app opens with, and the reverse.
    localStorage.setItem(LOCALE_STORAGE_KEY, next);
    document.documentElement.lang = next;
    void i18n.changeLanguage(next);
  };

  return (
    <div className="flex min-h-screen flex-col bg-cream-50 text-ink-700">
      <header className="sticky top-0 z-30 border-b border-ink-700/10 bg-cream-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-5 py-3">
          <a href="/" aria-label={t('site.nav.home')} className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-terra-700">
            <CasaZenLogo size={36} />
          </a>
          <nav aria-label={t('site.nav.main')} className="order-3 w-full md:order-none md:w-auto md:flex-1">
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[0.95rem] font-medium sm:gap-x-6">
              {NAV.map((item) => (
                <li key={item.id}>
                  <a
                    href={sitePageById(item.id).path}
                    aria-current={current === item.id ? 'page' : undefined}
                    className={
                      current === item.id
                        ? 'border-b-2 border-terra-500 pb-1 font-semibold text-ink-800'
                        : 'border-b-2 border-transparent pb-1 text-ink-500 hover:text-ink-800'
                    }
                  >
                    {t(item.key)}
                  </a>
                </li>
              ))}
              <li>
                <a href={SEO_HUB_PATH} className="border-b-2 border-transparent pb-1 text-ink-500 hover:text-ink-800">
                  {t('site.nav.guides')}
                </a>
              </li>
              {/* The search of homes is a page of the app (not prerendered): a plain link, like the guides. */}
              <li>
                <a href={SEARCH_PATH} className="border-b-2 border-transparent pb-1 text-ink-500 hover:text-ink-800">
                  {t('site.nav.search')}
                </a>
              </li>
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-4 text-sm font-medium">
            <button
              type="button"
              onClick={switchLanguage}
              aria-label={t('site.nav.switchLanguageLabel')}
              className="text-ink-500 hover:text-ink-800"
            >
              {t('site.nav.switchLanguage')}
            </button>
            {inviteLink ? (
              <a href={inviteLink} className="rounded-full bg-terra-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-terra-800">
                {t('site.invite.cta')}
              </a>
            ) : null}
            {showLogin ? (
              <a href="/login" className="rounded-full bg-ink-700 px-4 py-2 font-semibold text-white transition-colors hover:bg-ink-600">
                {t('site.nav.login')}
              </a>
            ) : null}
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-ink-800 text-sm text-ink-200">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <a href="/" aria-label={t('site.nav.home')} className="inline-block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
              <CasaZenLogo tone="dark" size={40} />
            </a>
            <p className="mt-4 max-w-xs leading-relaxed">{t('site.footer.tagline')}</p>
          </div>
          <div>
            <p className="font-semibold text-white">{t('site.footer.productTitle')}</p>
            <ul className="mt-3 space-y-2">
              {NAV.map((item) => (
                <li key={item.id}>
                  <a href={sitePageById(item.id).path} className={FOOTER_LINK}>
                    {t(item.key)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-white">{t('site.footer.resourcesTitle')}</p>
            <ul className="mt-3 space-y-2">
              <li>
                <a href={SEO_HUB_PATH} className={FOOTER_LINK}>
                  {t('site.footer.guides')}
                </a>
              </li>
              <li>
                <a href={SEARCH_PATH} className={FOOTER_LINK}>
                  {t('site.footer.search')}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-white">{t('site.footer.legalTitle')}</p>
            <ul className="mt-3 space-y-2">
              <li>
                <a href={LEGAL_DOCUMENT_PATHS.privacy} className={FOOTER_LINK}>
                  {t('site.footer.privacy')}
                </a>
              </li>
              <li>
                <a href={LEGAL_DOCUMENT_PATHS.tos} className={FOOTER_LINK}>
                  {t('site.footer.terms')}
                </a>
              </li>
              <li>
                <a href={LEGAL_SUBPROCESSORS_PATH} className={FOOTER_LINK}>
                  {t('site.footer.subprocessors')}
                </a>
              </li>
              <li>
                <a href={LEGAL_INDEX_PATH} className={FOOTER_LINK}>
                  {t('site.footer.legalIndex')}
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          {/* Company data on every page, the home page included (art. 35 DPR 633/1972): only what is configured. */}
          <div className="mx-auto flex max-w-6xl flex-wrap gap-x-4 gap-y-1 px-5 py-5 text-xs">
            <span>{t('site.footer.rights', { year })}</span>
            {legal.name && <span>{legal.name}</span>}
            {legal.vatId && <span>{t('site.footer.vatId', { vatId: legal.vatId })}</span>}
            {legal.address && <span>{legal.address}</span>}
            {legal.email && (
              <span>
                {t('site.footer.contact')}:{' '}
                <a href={`mailto:${legal.email}`} className="underline underline-offset-4 hover:text-white">
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
