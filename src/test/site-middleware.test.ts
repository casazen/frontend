// @vitest-environment node
import { describe, expect, it } from 'vitest';
import middleware, { config, isAppHost, isAuthRedirect, isSiteEnabled, SITE_PAGE_FILES, sitePagePath } from '../../middleware';
import { isPublicSiteEnabled } from '../site/site-gate';
import { SITE_ASSET_DIR, SITE_PAGES } from '../site/site-pages';

/**
 * Routing Middleware of the public site (SEO-VETRINA): the static pages are served only on the web app's own host, and
 * `/` stays the single-page app for the Auth0 login answer and on an org's own host (BK-16).
 */
const PUBLIC_SITE = 'https://public-site.example.test';
/** A preview deployment: the public site is always served there. */
const ENV = { VITE_PUBLIC_SITE_URL: PUBLIC_SITE, VERCEL_ENV: 'preview' };
/** Production with the company data (name and partita IVA). */
const PRODUCTION = { ...ENV, VERCEL_ENV: 'production', VITE_LEGAL_NAME: 'Esempio S.r.l.', VITE_LEGAL_VAT_ID: '01234567890' };

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
    [`${PUBLIC_SITE}/funzionalita`, `/${SITE_ASSET_DIR}/funzionalita.html`],
    [`${PUBLIC_SITE}/?utm_source=newsletter`, `/${SITE_ASSET_DIR}/index.html`],
    ['https://casazen-app-git-feature-x-casazen.vercel.app/chi-siamo', `/${SITE_ASSET_DIR}/chi-siamo.html`],
    ['http://localhost:3000/funzionalita', `/${SITE_ASSET_DIR}/funzionalita.html`],
  ])('sitePagePath_%s_onTheAppsOwnHost_isTheStaticPage', (url, expected) => {
    expect(sitePagePath(request(url), ENV)).toBe(expected);
  });

  it.each([
    // The Auth0 login comes back to the origin: the single-page app completes it there.
    `${PUBLIC_SITE}/?code=abc&state=xyz`,
    `${PUBLIC_SITE}/?error=access_denied&error_description=x&state=xyz`,
    // An org's own host: `/` and the other paths are the org's booking site.
    'https://www.villa-rossi.example.test/',
    'https://www.villa-rossi.example.test/funzionalita',
    // The pricing page does not exist: CasaZen is on private invitation and has no prices.
    `${PUBLIC_SITE}/prezzi`,
    'https://rossi.sites.example.test/',
    // Not a page of the site.
    `${PUBLIC_SITE}/app`,
  ])('sitePagePath_%s_goesOnUnchanged', (url) => {
    expect(sitePagePath(request(url), ENV)).toBeNull();
  });

  it('sitePagePath_withoutPublicSiteUrl_stillServesTheVercelHosts', () => {
    expect(sitePagePath(request('https://casazen-app.vercel.app/'), {})).toBe(`/${SITE_ASSET_DIR}/index.html`);
    expect(sitePagePath(request('https://www.villa-rossi.example.test/'), {})).toBeNull();
  });

  it('sitePagePath_productionWithCompanyData_servesThePublicSite', () => {
    expect(sitePagePath(request(`${PUBLIC_SITE}/`), PRODUCTION)).toBe(`/${SITE_ASSET_DIR}/index.html`);
  });

  it.each([
    ['without any company data', { ...ENV, VERCEL_ENV: 'production' }],
    ['without the partita IVA', { ...PRODUCTION, VITE_LEGAL_VAT_ID: undefined }],
    ['with an invalid partita IVA', { ...PRODUCTION, VITE_LEGAL_VAT_ID: '123' }],
    ['without the company name', { ...PRODUCTION, VITE_LEGAL_NAME: ' ' }],
  ])('sitePagePath_production_%s_keepsTheConsoleAtRoot', (_case, env) => {
    // The company does not exist yet: production serves the public site only once its data is configured.
    expect(sitePagePath(request(`${PUBLIC_SITE}/`), env)).toBeNull();
    expect(sitePagePath(request(`${PUBLIC_SITE}/funzionalita`), env)).toBeNull();
  });

  it.each([
    [{}],
    [{ VERCEL_ENV: 'preview' }],
    [{ VERCEL_ENV: 'production' }],
    [{ VERCEL_ENV: 'production', VITE_LEGAL_NAME: 'Esempio S.r.l.' }],
    [{ VERCEL_ENV: 'production', VITE_LEGAL_NAME: 'Esempio S.r.l.', VITE_LEGAL_VAT_ID: 'IT 012 345 678 90' }],
    [{ VERCEL_ENV: 'production', VITE_LEGAL_NAME: 'Esempio S.r.l.', VITE_LEGAL_VAT_ID: 'DE123456789' }],
    // Without a partita IVA, by the owner's explicit choice, with the holder's name and contact.
    [{ VERCEL_ENV: 'production', VITE_LEGAL_NAME: 'Mario Rossi', VITE_PUBLIC_SITE_WITHOUT_VAT_ID: 'true', VITE_SUPPORT_EMAIL: 'info@example.com' }],
    [{ VERCEL_ENV: 'production', VITE_LEGAL_NAME: 'Mario Rossi', VITE_PUBLIC_SITE_WITHOUT_VAT_ID: ' True ', VITE_SUPPORT_EMAIL: 'info@example.com' }],
    [{ VERCEL_ENV: 'production', VITE_LEGAL_NAME: 'Mario Rossi', VITE_PUBLIC_SITE_WITHOUT_VAT_ID: 'true' }],
    [{ VERCEL_ENV: 'production', VITE_LEGAL_NAME: 'Mario Rossi', VITE_PUBLIC_SITE_WITHOUT_VAT_ID: 'true', VITE_SUPPORT_EMAIL: 'bad' }],
    [{ VERCEL_ENV: 'production', VITE_LEGAL_NAME: 'Mario Rossi', VITE_PUBLIC_SITE_WITHOUT_VAT_ID: 'false', VITE_SUPPORT_EMAIL: 'info@example.com' }],
    [{ VERCEL_ENV: 'production', VITE_PUBLIC_SITE_WITHOUT_VAT_ID: 'true', VITE_SUPPORT_EMAIL: 'info@example.com' }],
  ])('isSiteEnabled_%j_isTheRuleOfTheSiteGate', (env: Record<string, string | undefined>) => {
    // middleware.ts is bundled on its own: its copy of the gate must agree with src/site/site-gate.ts.
    expect(isSiteEnabled(env)).toBe(
      isPublicSiteEnabled({
        vercelEnv: env.VERCEL_ENV,
        legalName: env.VITE_LEGAL_NAME,
        legalVatId: env.VITE_LEGAL_VAT_ID,
        contactEmail: env.VITE_SUPPORT_EMAIL,
        withoutVatId: env.VITE_PUBLIC_SITE_WITHOUT_VAT_ID,
      }),
    );
  });

  it('sitePagePath_productionWithoutPartitaIvaButTheChoiceAndTheHolder_servesThePublicSite', () => {
    const env = { ...ENV, VERCEL_ENV: 'production', VITE_LEGAL_NAME: 'Mario Rossi', VITE_PUBLIC_SITE_WITHOUT_VAT_ID: 'true', VITE_SUPPORT_EMAIL: 'info@example.com' };
    expect(sitePagePath(request(`${PUBLIC_SITE}/`), env)).toBe(`/${SITE_ASSET_DIR}/index.html`);
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
    const previousEnv = process.env.VERCEL_ENV;
    process.env.VITE_PUBLIC_SITE_URL = PUBLIC_SITE;
    delete process.env.VERCEL_ENV;
    try {
      const rewritten = middleware(request(`${PUBLIC_SITE}/`));
      expect(rewritten.headers.get('x-middleware-rewrite')).toBe(`${PUBLIC_SITE}/${SITE_ASSET_DIR}/index.html`);

      const passed = middleware(request('https://www.villa-rossi.example.test/'));
      expect(passed.headers.get('x-middleware-next')).toBe('1');
      expect(passed.headers.get('x-middleware-rewrite')).toBeNull();
    } finally {
      process.env.VITE_PUBLIC_SITE_URL = previous;
      if (previousEnv === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = previousEnv;
    }
  });
});
