// @vitest-environment node
import { describe, expect, it } from 'vitest';
import middleware, { config, isAppHost, isAuthRedirect, SITE_PAGE_FILES, sitePagePath } from '../../middleware';
import { SITE_ASSET_DIR, SITE_PAGES } from '../site/site-pages';

/**
 * Routing Middleware of the public site (SEO-VETRINA): the static pages are served only on the web app's own host, and
 * `/` stays the single-page app for the Auth0 login answer and on an org's own host (BK-16).
 */
const PUBLIC_SITE = 'https://public-site.example.test';

function request(url: string): Request {
  return new Request(url);
}

describe('site middleware (SEO-VETRINA)', () => {
  it('pathsAndFiles_areThePagesOfTheSite', () => {
    // middleware.ts is bundled on its own by Vercel: its copy of the pages must match src/site/site-pages.ts.
    expect(SITE_PAGE_FILES).toEqual(Object.fromEntries(SITE_PAGES.map((page) => [page.path, page.file])));
    expect([...config.matcher].sort()).toEqual(SITE_PAGES.map((page) => page.path).sort());
  });

  it.each([
    [`${PUBLIC_SITE}/`, `/${SITE_ASSET_DIR}/index.html`],
    [`${PUBLIC_SITE}/prezzi`, `/${SITE_ASSET_DIR}/prezzi.html`],
    [`${PUBLIC_SITE}/?utm_source=newsletter`, `/${SITE_ASSET_DIR}/index.html`],
    ['https://casazen-app-git-feature-x-casazen.vercel.app/chi-siamo', `/${SITE_ASSET_DIR}/chi-siamo.html`],
    ['http://localhost:3000/funzionalita', `/${SITE_ASSET_DIR}/funzionalita.html`],
  ])('sitePagePath_%s_onTheAppsOwnHost_isTheStaticPage', (url, expected) => {
    expect(sitePagePath(request(url), PUBLIC_SITE)).toBe(expected);
  });

  it.each([
    // The Auth0 login comes back to the origin: the single-page app completes it there.
    `${PUBLIC_SITE}/?code=abc&state=xyz`,
    `${PUBLIC_SITE}/?error=access_denied&error_description=x&state=xyz`,
    // An org's own host: `/` and the other paths are the org's booking site.
    'https://www.villa-rossi.example.test/',
    'https://www.villa-rossi.example.test/prezzi',
    'https://rossi.sites.example.test/',
    // Not a page of the site.
    `${PUBLIC_SITE}/app`,
  ])('sitePagePath_%s_goesOnUnchanged', (url) => {
    expect(sitePagePath(request(url), PUBLIC_SITE)).toBeNull();
  });

  it('sitePagePath_withoutPublicSiteUrl_stillServesTheVercelHosts', () => {
    expect(sitePagePath(request('https://casazen-app.vercel.app/'), undefined)).toBe(`/${SITE_ASSET_DIR}/index.html`);
    expect(sitePagePath(request('https://www.villa-rossi.example.test/'), undefined)).toBeNull();
  });

  it.each([
    ['public-site.example.test', true],
    ['PUBLIC-SITE.example.test:443', true],
    ['casazen-app.vercel.app', true],
    ['localhost', true],
    ['127.0.0.1', true],
    ['www.villa-rossi.example.test', false],
    ['evil-vercel.app.example.test', false],
  ])('isAppHost_%s_is_%s', (host, expected) => {
    expect(isAppHost(host, PUBLIC_SITE)).toBe(expected);
  });

  it.each([
    ['?code=a&state=b', true],
    ['?error=x&state=b', true],
    ['?state=b', false],
    ['?code=a', false],
    ['', false],
  ])('isAuthRedirect_%s_is_%s', (search, expected) => {
    expect(isAuthRedirect(new URL(`${PUBLIC_SITE}/${search}`))).toBe(expected);
  });

  it('middleware_rewritesTheAppHostAndPassesTheOrgHostOn', () => {
    const previous = process.env.VITE_PUBLIC_SITE_URL;
    process.env.VITE_PUBLIC_SITE_URL = PUBLIC_SITE;
    try {
      const rewritten = middleware(request(`${PUBLIC_SITE}/`));
      expect(rewritten.headers.get('x-middleware-rewrite')).toBe(`${PUBLIC_SITE}/${SITE_ASSET_DIR}/index.html`);

      const passed = middleware(request('https://www.villa-rossi.example.test/'));
      expect(passed.headers.get('x-middleware-next')).toBe('1');
      expect(passed.headers.get('x-middleware-rewrite')).toBeNull();
    } finally {
      process.env.VITE_PUBLIC_SITE_URL = previous;
    }
  });
});
