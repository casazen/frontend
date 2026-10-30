/**
 * Pages of the public site of CasaZen (SEO-VETRINA): the home page and the product pages that present CasaZen to hosts and
 * suppliers. Pure module (no React, no DOM): the build-time prerender, the sitemap, `robots.txt` and the tests read it.
 *
 * Each page is rendered to static HTML at build time (`scripts/prerender-site.mjs`) into `dist/_site/{file}` and served at
 * its public path by the Routing Middleware (`middleware.ts`) only on the web app's own host: on an org's own host (BK-16)
 * the same paths stay the org's booking site. `middleware.ts` is bundled by Vercel on its own, so it keeps its own copy of
 * the paths; `src/test/site-middleware.test.ts` checks that both lists are the same.
 */

export type SitePageId = 'home' | 'features' | 'suppliers' | 'about';

export interface SitePage {
  id: SitePageId;
  /** Public path on the web app's own host. */
  path: string;
  /** File under `dist/_site/` that holds the prerendered page. */
  file: string;
}

/** Folder of `dist/` holding the prerendered pages: never linked, kept out of crawling by `robots.txt`. */
export const SITE_ASSET_DIR = '_site';

/** Sitemap of the public site on the web app's own host (static, written by the prerender). */
export const SITE_SITEMAP_PATH = '/sitemap-site.xml';

export const SITE_PAGES: readonly SitePage[] = [
  { id: 'home', path: '/', file: 'index.html' },
  { id: 'features', path: '/funzionalita', file: 'funzionalita.html' },
  { id: 'suppliers', path: '/per-i-fornitori', file: 'per-i-fornitori.html' },
  { id: 'about', path: '/chi-siamo', file: 'chi-siamo.html' },
];

export function sitePageById(id: SitePageId): SitePage {
  const page = SITE_PAGES.find((candidate) => candidate.id === id);
  if (!page) throw new Error(`Unknown site page ${id}`);
  return page;
}

/** The page served at a public path, or null when the path is not a page of the public site. */
export function sitePageByPath(pathname: string): SitePage | null {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return SITE_PAGES.find((page) => page.path === path) ?? null;
}

/** Absolute URL of a page on the public origin (`https://host`), the form of the canonical and of the sitemap. */
export function sitePageUrl(origin: string, page: SitePage): string {
  return page.path === '/' ? `${origin}/` : `${origin}${page.path}`;
}

/**
 * The public search of homes, a page of the app (not prerendered, so not one of `SITE_PAGES`): the pages of the site link to it and its
 * sitemap lists it. The page without a search is for the crawlers; the address of a search is `noindex,follow` (see the page).
 */
export const SEARCH_PATH = '/search';

/** The sitemap of the public site: one `<loc>` per page on the public origin, then the public pages of the app that belong to it. */
export function buildSiteSitemap(origin: string): string {
  const urls = [
    ...SITE_PAGES.map((page) => `  <url><loc>${sitePageUrl(origin, page)}</loc></url>`),
    `  <url><loc>${origin}${SEARCH_PATH}</loc></url>`,
  ];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}
