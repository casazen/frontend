import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { showLoginEntryPoints } from '@/config/login-entry';
import { createSiteI18n } from './site-i18n';
import { SiteApp } from './site-app';
import { readSiteLegal, readSiteOrigin } from './site-config';
import { isPublicSiteEnabled } from './site-gate';
import { buildSiteHead } from './site-head';
import { buildSiteSitemap, SITE_ASSET_DIR, SITE_PAGES, type SitePage } from './site-pages';

export interface RenderedSitePage {
  page: SitePage;
  head: string;
  root: string;
}

export { SITE_ASSET_DIR };

export function renderSitePages(year: number): RenderedSitePage[] {
  const env = import.meta.env as Record<string, unknown>;
  const legal = readSiteLegal(env);
  const origin = readSiteOrigin(env.VITE_PUBLIC_SITE_URL);
  const showLogin = showLoginEntryPoints(env.VITE_PUBLIC_SITE_URL);

  return SITE_PAGES.map((page) => {
    const i18n = createSiteI18n('it');
    const html = renderToString(createElement(SiteApp, { page: page.id, i18n, legal, year, showLogin }));
    const head = buildSiteHead({
      page,
      title: i18n.t(`site.meta.${page.id}.title`),
      description: i18n.t(`site.meta.${page.id}.description`),
      origin,
      legal,
    });
    const root = `<div id="root" data-site-page="${page.id}" data-site-year="${year}">${html}</div>`;
    return { page, head, root };
  });
}

/** Whether this build serves the public site: always outside Vercel production, in production only with the company data. */
export function isSiteServed(vercelEnv: string | undefined): boolean {
  const env = import.meta.env as Record<string, unknown>;
  return isPublicSiteEnabled({
    vercelEnv,
    legalName: env.VITE_LEGAL_NAME,
    legalVatId: env.VITE_LEGAL_VAT_ID,
    contactEmail: env.VITE_SUPPORT_EMAIL,
    withoutVatId: env.VITE_PUBLIC_SITE_WITHOUT_VAT_ID,
  });
}

export function renderSiteSitemap(vercelEnv: string | undefined): string | null {
  const origin = readSiteOrigin((import.meta.env as Record<string, unknown>).VITE_PUBLIC_SITE_URL);
  return origin && isSiteServed(vercelEnv) ? buildSiteSitemap(origin) : null;
}
