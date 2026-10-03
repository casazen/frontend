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
    const robots = buildRobotsTxt({ vercelEnv: 'production', publicSiteUrl: `${PUBLIC_SITE}/` });

    expect(directives(robots)).toEqual([
      'User-agent: *',
      'Allow: /',
      'Disallow: /app/',
      'Disallow: /checkin/',
      'Disallow: /login',
      'Disallow: /book/*/my-bookings',
      'Disallow: /book/*/booking/',
      'Disallow: /book/*/requests/',
      'Disallow: /book/*/property/*/checkout',
      'Disallow: /fornitori/',
      'Disallow: /my-bookings',
      'Disallow: /booking/',
      'Disallow: /requests/',
      'Disallow: /property/*/checkout',
      `Sitemap: ${PUBLIC_SITE}/sitemap.xml`,
      `Sitemap: ${PUBLIC_SITE}/sitemap-book.xml`,
    ]);
  });

  it('buildRobotsTxt_VercelProduction_KeepsTheBookingSitesAndGuidesCrawlable', () => {
    // BK-15: only the private pages are disallowed; the pages that are indexed (org landing, property, /p/*) are not.
    // Robots rules are prefix matches where `*` is any text, as Google and Bing read them.
    const isDisallowed = (path: string) =>
      DISALLOWED_PATHS.some((rule) => new RegExp(`^${rule.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}`).test(path));

    for (const indexed of [
      '/book/x',
      '/book/x/property/villa',
      '/book/x/sitemap.xml',
      '/p/affitti-brevi',
      '/p/affitti-brevi/lombardia/como',
      // An org's own host: the landing page, a property and the sitemap.
      '/',
      '/property/villa',
      '/sitemap.xml',
    ]) {
      expect(isDisallowed(indexed), indexed).toBe(false);
    }
    for (const hidden of [
      '/app/short-rent/bookings',
      '/checkin/abc',
      '/login',
      '/book/x/my-bookings',
      '/book/x/booking/123',
      '/book/x/requests/123/confirm',
      '/book/x/property/villa/checkout',
      // SU-13: the supplier showcase is noindex in v0.
      '/fornitori/pulizie-roma',
      '/my-bookings',
      '/booking/0f6c',
      '/requests/0f6c/confirm',
      '/property/villa/checkout',
    ]) {
      expect(isDisallowed(hidden), hidden).toBe(true);
    }
  });

  it.each([['preview'], ['development'], [undefined]])(
    'buildRobotsTxt_NotProduction_%s_DisallowsEverythingWithoutSitemap',
    (vercelEnv) => {
      // Preview deployments, the develop test deployment, local and CI builds are never indexed.
      const robots = buildRobotsTxt({ vercelEnv, publicSiteUrl: PUBLIC_SITE });

      expect(directives(robots)).toEqual(['User-agent: *', 'Disallow: /']);
    },
  );

  it('buildRobotsTxt_NotProductionWithoutPublicSite_DoesNotNeedIt', () => {
    expect(() => buildRobotsTxt({ vercelEnv: 'preview', publicSiteUrl: undefined })).not.toThrow();
  });

  it.each([
    [undefined, /missing/],
    ['', /missing/],
    ['public-site.example.test', /not an absolute URL/],
    ['http://public-site.example.test', /https/],
    [`${PUBLIC_SITE}/app`, /site root/],
    [`${PUBLIC_SITE}/?utm=1`, /site root/],
  ])('buildRobotsTxt_ProductionWithInvalidPublicSite_%s_FailsTheBuild', (publicSiteUrl, message) => {
    // Decision D3: no default domain, so a production build cannot guess one.
    expect(() => buildRobotsTxt({ vercelEnv: 'production', publicSiteUrl })).toThrow(message);
  });

  it('parsePublicSiteUrl_UppercaseHostWithTrailingSlash_ReturnsNormalizedOrigin', () => {
    expect(parsePublicSiteUrl(' https://Public-Site.Example.test/ ')).toEqual({ origin: PUBLIC_SITE });
  });
});
