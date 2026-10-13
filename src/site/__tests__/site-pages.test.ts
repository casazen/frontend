import { describe, expect, it } from 'vitest';
import { SIGNUP_PATH, readUtm } from '@/lib/signup-attribution';
import { buildSiteSitemap, SITE_PAGES, sitePageByPath, sitePageUrl } from '../site-pages';
import { signupHref, SITE_SIGNUP_PATH } from '../site-links';
import { normalizeVatId, readSiteLegal, readSiteOrigin } from '../site-config';

describe('site pages (SEO-VETRINA)', () => {
  it('sitePages_pathsAndFiles_areUnique', () => {
    expect(new Set(SITE_PAGES.map((page) => page.path)).size).toBe(SITE_PAGES.length);
    expect(new Set(SITE_PAGES.map((page) => page.file)).size).toBe(SITE_PAGES.length);
    expect(SITE_PAGES.find((page) => page.id === 'home')?.path).toBe('/');
  });

  it.each([
    ['/', 'home'],
    ['/prezzi', 'pricing'],
    ['/prezzi/', 'pricing'],
    ['/per-i-fornitori', 'suppliers'],
  ])('sitePageByPath_%s_isThePage', (path, id) => {
    expect(sitePageByPath(path)?.id).toBe(id);
  });

  it.each(['/app', '/fornitori/pulizie-roma', '/p/affitti-brevi', '/prezzi/extra'])('sitePageByPath_%s_isNotAPage', (path) => {
    expect(sitePageByPath(path)).toBeNull();
  });

  it('buildSiteSitemap_listsEveryPageOnThePublicOrigin', () => {
    const sitemap = buildSiteSitemap('https://site.example.test');
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    expect(locs).toEqual(SITE_PAGES.map((page) => sitePageUrl('https://site.example.test', page)));
    expect(locs[0]).toBe('https://site.example.test/');
    expect(sitemap).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  });
});

describe('site links (SEO-VETRINA)', () => {
  it('siteSignupPath_isTheSignupPathOfTheApp', () => {
    expect(SITE_SIGNUP_PATH).toBe(SIGNUP_PATH);
  });

  it('signupHref_carriesUtmValuesTheSignupAttributionAccepts', () => {
    const href = signupHref('home', 'hero');
    expect(href.startsWith(`${SIGNUP_PATH}?`)).toBe(true);
    // The same reader as /signup: values outside the attribution rules would be dropped here.
    expect(readUtm(href.slice(href.indexOf('?')))).toEqual({
      utm_source: 'casazen-site',
      utm_medium: 'cta',
      utm_content: 'home-hero',
    });
  });
});

describe('site company data (SEO-VETRINA)', () => {
  it.each([
    ['01234567890', 'IT01234567890'],
    ['IT01234567890', 'IT01234567890'],
    [' it 012 345 678 90 ', 'IT01234567890'],
  ])('normalizeVatId_%s_isWrittenWithThePrefix', (value, expected) => {
    expect(normalizeVatId(value)).toBe(expected);
  });

  it.each(['', '0123456789', 'DE123456789', '0123456789A', undefined])('normalizeVatId_%s_isNull', (value) => {
    expect(normalizeVatId(value)).toBeNull();
  });

  it('readSiteLegal_keepsOnlyValidValues', () => {
    expect(
      readSiteLegal({
        VITE_LEGAL_NAME: '  Esempio   S.r.l. ',
        VITE_LEGAL_VAT_ID: '01234567890',
        VITE_LEGAL_ADDRESS: 'Via Esempio 1, 22100 Como',
        VITE_SUPPORT_EMAIL: 'not-an-email',
      }),
    ).toEqual({ name: 'Esempio S.r.l.', vatId: 'IT01234567890', address: 'Via Esempio 1, 22100 Como', email: null });
    expect(readSiteLegal({})).toEqual({ name: null, vatId: null, address: null, email: null });
  });

  it.each([
    ['https://site.example.test', 'https://site.example.test'],
    ['https://site.example.test/', 'https://site.example.test'],
    ['http://site.example.test', null],
    ['not a url', null],
    [undefined, null],
  ])('readSiteOrigin_%s', (value, expected) => {
    expect(readSiteOrigin(value)).toBe(expected);
  });
});
