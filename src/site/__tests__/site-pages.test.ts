import { describe, expect, it } from 'vitest';
import { buildSiteSitemap, SITE_PAGES, sitePageByPath, sitePageUrl } from '../site-pages';
import { inviteHref } from '../site-links';
import { readSiteLegal, readSiteOrigin } from '../site-config';
import { isPublicSiteEnabled, normalizeVatId } from '../site-gate';

describe('site pages (SEO-VETRINA)', () => {
  it('sitePages_pathsAndFiles_areUnique', () => {
    expect(new Set(SITE_PAGES.map((page) => page.path)).size).toBe(SITE_PAGES.length);
    expect(new Set(SITE_PAGES.map((page) => page.file)).size).toBe(SITE_PAGES.length);
    expect(SITE_PAGES.find((page) => page.id === 'home')?.path).toBe('/');
  });

  it.each([
    ['/', 'home'],
    ['/funzionalita/', 'features'],
    ['/per-i-fornitori', 'suppliers'],
  ])('sitePageByPath_%s_isThePage', (path, id) => {
    expect(sitePageByPath(path)?.id).toBe(id);
  });

  it.each(['/app', '/fornitori/pulizie-roma', '/p/affitti-brevi', '/prezzi', '/signup', '/funzionalita/extra'])('sitePageByPath_%s_isNotAPage', (path) => {
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
  it('inviteHref_withAContactAddress_isAMailtoWithTheSubject', () => {
    expect(inviteHref('info@example.com', 'Richiesta di invito a CasaZen')).toBe(
      'mailto:info@example.com?subject=Richiesta%20di%20invito%20a%20CasaZen',
    );
  });

  it('inviteHref_withoutAContactAddress_isNull', () => {
    // No address is invented: the site only says that the access is by invitation.
    expect(inviteHref(null, 'x')).toBeNull();
  });

  it('sitePages_doNotIncludeThePricingPageOrAnySignupPath', () => {
    // CasaZen is on private invitation and prices are not defined (product owner, 2026-10-13).
    expect(SITE_PAGES.map((page) => page.path)).toEqual(['/', '/funzionalita', '/per-i-fornitori', '/chi-siamo']);
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

describe('site gate (SEO-VETRINA)', () => {
  it.each([undefined, 'preview', 'development'])('isPublicSiteEnabled_%s_isAlwaysOn', (vercelEnv) => {
    expect(isPublicSiteEnabled({ vercelEnv, legalName: undefined, legalVatId: undefined })).toBe(true);
  });

  it('isPublicSiteEnabled_productionWithNameAndPartitaIva_isOn', () => {
    expect(isPublicSiteEnabled({ vercelEnv: 'production', legalName: 'Esempio S.r.l.', legalVatId: '01234567890' })).toBe(true);
  });

  it.each([
    [undefined, undefined],
    ['Esempio S.r.l.', undefined],
    [undefined, '01234567890'],
    ['  ', '01234567890'],
    ['Esempio S.r.l.', '0123456789'],
  ])('isPublicSiteEnabled_productionWith_%s_%s_isOff', (legalName, legalVatId) => {
    // The company does not exist yet: production keeps / as the console until name and partita IVA are set.
    expect(isPublicSiteEnabled({ vercelEnv: 'production', legalName, legalVatId })).toBe(false);
  });
});
