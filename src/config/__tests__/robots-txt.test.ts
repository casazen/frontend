import { describe, expect, it } from 'vitest';
import { buildRobotsTxt, DISALLOWED_PATHS, parsePublicSiteUrl } from '../robots-txt';

const PUBLIC_SITE = 'https://public-site.example.test';

function directives(robots: string): string[] {
  return robots
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

describe('buildRobotsTxt (SE-02, A8-02)', () => {
  it('buildRobotsTxt_VercelProduction_AllowsIndexingAndDeclaresSitemapOnPublicDomain', () => {
    const robots = buildRobotsTxt({ vercelEnv: 'production', publicSiteUrl: `${PUBLIC_SITE}/`, publicSiteEnabled: true });

    expect(directives(robots)).toEqual([
      'User-agent: *',
      'Allow: /',
      'Disallow: /app/',
      'Disallow: /checkin/',
      'Disallow: /s/',
      'Disallow: /invite/',
      'Disallow: /benvenuto/',
      'Disallow: /login',
      'Disallow: /book/*/my-bookings',
      'Disallow: /book/*/search',
      'Disallow: /book/*/booking/',
      'Disallow: /book/*/bookings/',
      'Disallow: /book/*/requests/',
      'Disallow: /book/*/property/*/checkout',
      'Disallow: /fornitori/*/prenota',
      'Disallow: /fornitori/*/conferma',
      'Disallow: /fornitori/*/richiesta',
      'Disallow: /fornitori/*/preventivo',
      'Disallow: /service/pay/',
      'Disallow: /documents/view/',
      'Disallow: /my-bookings',
      'Disallow: /booking/',
      'Disallow: /requests/',
      'Disallow: /property/*/checkout',
      'Disallow: /_site/',
      `Sitemap: ${PUBLIC_SITE}/sitemap.xml`,
      `Sitemap: ${PUBLIC_SITE}/sitemap-book.xml`,
      `Sitemap: ${PUBLIC_SITE}/sitemap-supplier.xml`,
      `Sitemap: ${PUBLIC_SITE}/sitemap-site.xml`,
    ]);
  });

  it('buildRobotsTxt_VercelProductionWithoutThePublicSite_DoesNotDeclareItsSitemap', () => {
    const robots = buildRobotsTxt({ vercelEnv: 'production', publicSiteUrl: PUBLIC_SITE, publicSiteEnabled: false });
    expect(robots).not.toContain('sitemap-site.xml');
    expect(robots).toContain(`Sitemap: ${PUBLIC_SITE}/sitemap.xml`);
    expect(robots).toContain(`Sitemap: ${PUBLIC_SITE}/sitemap-book.xml`);
  });

  it('buildRobotsTxt_VercelProduction_KeepsTheBookingSitesAndGuidesCrawlable', () => {
    const isDisallowed = (path: string) =>
      DISALLOWED_PATHS.some((rule) => new RegExp(`^${rule.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}`).test(path));

    for (const indexed of [
      '/book/x',
      '/book/x/property/villa',
      '/book/x/sitemap.xml',
      '/p/affitti-brevi',
      '/p/affitti-brevi/lombardia/como',
      '/',
      '/property/villa',
      '/sitemap.xml',
      '/fornitori/pulizie-roma',
      '/sitemap-supplier.xml',
      '/affitti-brevi',
      '/affitti-lunghi',
      '/funzionalita',
      '/per-i-fornitori',
      '/chi-siamo',
      '/sitemap-site.xml',
    ]) {
      expect(isDisallowed(indexed), indexed).toBe(false);
    }
    for (const hidden of [
      '/app/short-rent/bookings',
      '/checkin/abc',
      '/s/0123456789abcdefghijklmnopqrstuv',
      '/login',
      '/book/x/my-bookings',
      '/book/x/search',
      '/book/x/booking/123',
      '/book/x/bookings/123/cancel',
      '/book/x/requests/123/confirm',
      '/book/x/property/villa/checkout',
      '/fornitori/pulizie-roma/prenota',
      '/fornitori/pulizie-roma/conferma',
      '/fornitori/pulizie-roma/richiesta',
      '/fornitori/pulizie-roma/preventivo',
      '/service/pay/0f6c1c2e-7a4b-4d52-9d3e-2b1f6a8c9d10',
      '/benvenuto/TEST-benvenuto-villa-lago',
      '/my-bookings',
      '/booking/0f6c',
      '/requests/0f6c/confirm',
      '/property/villa/checkout',
      '/_site/index.html',
    ]) {
      expect(isDisallowed(hidden), hidden).toBe(true);
    }
  });

  it.each([['preview'], ['development'], [undefined]])(
    'buildRobotsTxt_NotProduction_%s_DisallowsEverythingWithoutSitemap',
    (vercelEnv) => {
      const robots = buildRobotsTxt({ vercelEnv, publicSiteUrl: PUBLIC_SITE, publicSiteEnabled: true });

      expect(directives(robots)).toEqual(['User-agent: *', 'Disallow: /']);
    },
  );

  it('buildRobotsTxt_NotProductionWithoutPublicSite_DoesNotNeedIt', () => {
    expect(() => buildRobotsTxt({ vercelEnv: 'preview', publicSiteUrl: undefined, publicSiteEnabled: true })).not.toThrow();
  });

  it.each([
    [undefined, /missing/],
    ['', /missing/],
    ['public-site.example.test', /not an absolute URL/],
    ['http://public-site.example.test', /https/],
    [`${PUBLIC_SITE}/app`, /site root/],
    [`${PUBLIC_SITE}/?utm=1`, /site root/],
  ])('buildRobotsTxt_ProductionWithInvalidPublicSite_%s_FailsTheBuild', (publicSiteUrl, message) => {
    expect(() => buildRobotsTxt({ vercelEnv: 'production', publicSiteUrl, publicSiteEnabled: true })).toThrow(message);
  });

  it('parsePublicSiteUrl_UppercaseHostWithTrailingSlash_ReturnsNormalizedOrigin', () => {
    expect(parsePublicSiteUrl(' https://Public-Site.Example.test/ ')).toEqual({ origin: PUBLIC_SITE });
  });
});
