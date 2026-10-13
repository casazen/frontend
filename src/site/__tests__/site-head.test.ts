import { describe, expect, it } from 'vitest';
import { buildOrganizationJsonLd, buildSiteHead } from '../site-head';
import { sitePageById } from '../site-pages';
import type { SiteLegal } from '../site-config';

const NO_LEGAL: SiteLegal = { name: null, vatId: null, address: null, email: null };
const LEGAL: SiteLegal = {
  name: 'Esempio S.r.l.',
  vatId: 'IT01234567890',
  address: 'Via Esempio 1, 22100 Como',
  email: 'info@example.com',
};

describe('buildSiteHead (SEO-VETRINA)', () => {
  it('buildSiteHead_withPublicOrigin_writesCanonicalHreflangAndOgUrlOnThePublicPath', () => {
    const head = buildSiteHead({
      page: sitePageById('pricing'),
      title: 'Piani | CasaZen',
      description: 'Descrizione',
      origin: 'https://site.example.test',
      legal: NO_LEGAL,
    });
    expect(head).toContain('<title>Piani | CasaZen</title>');
    expect(head).toContain('<meta name="description" content="Descrizione" />');
    expect(head).toContain('<link rel="canonical" href="https://site.example.test/prezzi" />');
    expect(head).toContain('<link rel="alternate" hreflang="it" href="https://site.example.test/prezzi" />');
    expect(head).toContain('<link rel="alternate" hreflang="x-default" href="https://site.example.test/prezzi" />');
    expect(head).toContain('<meta property="og:url" content="https://site.example.test/prezzi" />');
    // The JSON-LD Organization is on the home page only.
    expect(head).not.toContain('application/ld+json');
  });

  it('buildSiteHead_withoutPublicOrigin_hasNoCanonical', () => {
    const head = buildSiteHead({ page: sitePageById('home'), title: 'T', description: 'D', origin: null, legal: NO_LEGAL });
    expect(head).not.toContain('rel="canonical"');
    expect(head).not.toContain('hreflang');
    expect(head).not.toContain('og:url');
  });

  it('buildSiteHead_escapesTextAndKeepsTheJsonLdInsideItsScript', () => {
    const head = buildSiteHead({
      page: sitePageById('home'),
      title: 'A & B <x>',
      description: '"quoted"',
      origin: null,
      legal: { ...NO_LEGAL, name: 'Evil</script><script>alert(1)</script>' },
    });
    expect(head).toContain('<title>A &amp; B &lt;x&gt;</title>');
    expect(head).toContain('content="&quot;quoted&quot;"');
    expect(head).not.toContain('</script><script>');
    expect(head.match(/<\/script>/g)).toHaveLength(1);
  });

  it('buildOrganizationJsonLd_containsOnlyConfiguredCompanyData', () => {
    expect(buildOrganizationJsonLd(null, NO_LEGAL)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'CasaZen',
    });
    expect(buildOrganizationJsonLd('https://site.example.test', LEGAL)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'CasaZen',
      url: 'https://site.example.test/',
      legalName: 'Esempio S.r.l.',
      vatID: 'IT01234567890',
      address: 'Via Esempio 1, 22100 Como',
      email: 'info@example.com',
    });
  });
});
