import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createSiteI18n } from './site-i18n';
import { SiteApp } from './site-app';
import { readSiteLegal, readSiteOrigin } from './site-config';
import { buildSiteHead } from './site-head';
import { buildSiteSitemap, SITE_ASSET_DIR, SITE_PAGES, type SitePage } from './site-pages';

/**
 * Build-time render of the public site (SEO-VETRINA), bundled by `vite build --ssr` and run by `scripts/prerender-site.mjs`:
 * the static HTML of every page (Italian, the language of the single URL) and the sitemap. The browser then starts the same
 * tree on it (`entry-client.tsx`), so people and search engines get the same page.
 */

export interface RenderedSitePage {
  page: SitePage;
  /** Tags for the `<head>`: title, description, canonical, Open Graph, JSON-LD. */
  head: string;
  /** The `#root` element with the rendered page. */
  root: string;
}

export { SITE_ASSET_DIR };

export function renderSitePages(year: number): RenderedSitePage[] {
  const env = import.meta.env as Record<string, unknown>;
  const legal = readSiteLegal(env);
  const origin = readSiteOrigin(env.VITE_PUBLIC_SITE_URL);

  return SITE_PAGES.map((page) => {
    const i18n = createSiteI18n('it');
    const html = renderToString(createElement(SiteApp, { page: page.id, i18n, legal, year }));
    const head = buildSiteHead({
      page,
      title: i18n.t(`site.meta.${page.id}.title`),
      description: i18n.t(`site.meta.${page.id}.description`),
      origin,
      legal,
    });
    // The page and the year travel with the HTML: the browser renders exactly what was rendered here.
    const root = `<div id="root" data-site-page="${page.id}" data-site-year="${year}">${html}</div>`;
    return { page, head, root };
  });
}

/** The sitemap of the public site, or null without a public origin (preview and local builds are never indexed). */
export function renderSiteSitemap(): string | null {
  const origin = readSiteOrigin((import.meta.env as Record<string, unknown>).VITE_PUBLIC_SITE_URL);
  return origin ? buildSiteSitemap(origin) : null;
}
