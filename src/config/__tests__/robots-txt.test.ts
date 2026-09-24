import { describe, expect, it } from 'vitest';
import { buildRobotsTxt, parsePublicSiteUrl } from '../robots-txt';

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

    expect(directives(robots)).toEqual(['User-agent: *', 'Allow: /', `Sitemap: ${PUBLIC_SITE}/sitemap.xml`]);
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
