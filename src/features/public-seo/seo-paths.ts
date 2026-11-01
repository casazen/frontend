/**
 * Hub of the published SEO pages (SE-02 / A8-02): the public entry point to every `/p/*` page, linked from the footer
 * of the CasaZen public pages. The backend builds its canonical URL and sitemap entry from the same path.
 */
export const SEO_HUB_PATH = '/p/affitti-brevi';

/** A page of the hub that the home page links to directly: the comune as people write it, and the path of the page. */
export interface SeoFeaturedPage {
  comune: string;
  path: string;
}

/**
 * The guides the home page links to, so that the pages people search for (`affitti brevi Como`) are one click from the strongest page
 * of the site and not two. The list is written by hand because the home page is prerendered at build time, with no access to the
 * API: it holds comuni whose guide is published in the test environment and in production alike (the backend decides what is
 * published; a link to a page that is not shows the not-found state of the app). Add a comune here when its page is approved and
 * worth the link.
 */
export const SEO_FEATURED_GUIDES: readonly SeoFeaturedPage[] = [
  { comune: 'Como', path: '/p/affitti-brevi/lombardia/como' },
  { comune: 'Bellagio', path: '/p/affitti-brevi/lombardia/bellagio' },
  { comune: 'Menaggio', path: '/p/affitti-brevi/lombardia/menaggio' },
  { comune: 'Varenna', path: '/p/affitti-brevi/lombardia/varenna' },
  { comune: 'Bologna', path: '/p/affitti-brevi/emilia-romagna/bologna' },
];

/** The tourist tax pages the home page links to (same rule as `SEO_FEATURED_GUIDES`). */
export const SEO_FEATURED_TAX_PAGES: readonly SeoFeaturedPage[] = [{ comune: 'Como', path: '/p/tassa-soggiorno/como' }];
