import { hydrateRoot } from 'react-dom/client';
import { readStoredLocale } from '@/i18n/locale-storage';
import { createSiteI18n } from './site-i18n';
import { SiteApp } from './site-app';
import { readSiteLegal } from './site-config';
import { SITE_PAGES, type SitePageId } from './site-pages';
import './site.css';

/**
 * Browser start of a page of the public site (SEO-VETRINA): hydrates the static HTML in Italian, as it was rendered, then
 * switches to English when the visitor chose it in the app. The page links work without this script.
 */
const root = document.getElementById('root');
const pageId = root?.dataset.sitePage as SitePageId | undefined;
const year = Number(root?.dataset.siteYear);

if (root && pageId && SITE_PAGES.some((page) => page.id === pageId) && Number.isInteger(year)) {
  const i18n = createSiteI18n('it');
  const legal = readSiteLegal(import.meta.env as Record<string, unknown>);
  hydrateRoot(root, <SiteApp page={pageId} i18n={i18n} legal={legal} year={year} />);

  const locale = readStoredLocale();
  if (locale !== 'it') {
    document.documentElement.lang = locale;
    void i18n.changeLanguage(locale);
  }
}
