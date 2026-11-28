import { hydrateRoot } from 'react-dom/client';
import { readStoredLocale } from '@/i18n/locale-storage';
import { showLoginEntryPoints } from '@/config/login-entry';
import { createSiteI18n } from './site-i18n';
import { SiteApp } from './site-app';
import { readSiteLegal } from './site-config';
import { SITE_PAGES, type SitePageId } from './site-pages';
import './site.css';

const root = document.getElementById('root');
const pageId = root?.dataset.sitePage as SitePageId | undefined;
const year = Number(root?.dataset.siteYear);

if (root && pageId && SITE_PAGES.some((page) => page.id === pageId) && Number.isInteger(year)) {
  const i18n = createSiteI18n('it');
  const legal = readSiteLegal(import.meta.env as Record<string, unknown>);
  const showLogin = showLoginEntryPoints(import.meta.env.VITE_PUBLIC_SITE_URL);
  hydrateRoot(root, <SiteApp page={pageId} i18n={i18n} legal={legal} year={year} showLogin={showLogin} />);

  const locale = readStoredLocale();
  if (locale !== 'it') {
    document.documentElement.lang = locale;
    void i18n.changeLanguage(locale);
  }
}
