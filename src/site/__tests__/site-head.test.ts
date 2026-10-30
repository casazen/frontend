import { describe, expect, it } from 'vitest';
import { buildOrganizationJsonLd, buildSiteHead, buildWebSiteJsonLd } from '../site-head';
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
      page: sitePageById('features'),
      title: 'Funzionalità | CasaZen',
      description: 'Descrizione',
      origin: 'https://site.example.test',
      legal: NO_LEGAL,
    });
    expect(head).toContain('<title>Funzionalità | CasaZen</title>');
    expect(head).toContain('<meta name="description" content="Descrizione" />');
    expect(head).toContain('<link rel="canonical" href="https://site.example.test/funzionalita" />');
    expect(head).toContain('<link rel="alternate" hreflang="it" href="https://site.example.test/funzionalita" />');
    expect(head).toContain('<link rel="alternate" hreflang="x-default" href="https://site.example.test/funzionalita" />');
    expect(head).toContain('<meta property="og:url" content="https://site.example.test/funzionalita" />');
    // The JSON-LD Organization is on the home page only.
    expect(head).not.toContain('application/ld+json');
  });

  it('buildSiteHead_homeWithPublicOrigin_declaresTheSearchOfHomesAsTheSearchOfTheSite', () => {
    const head = buildSiteHead({ page: sitePageById('home'), title: 'T', description: 'D', origin: 'https://site.example.test', legal: NO_LEGAL });

    // The Organization and the WebSite with its SearchAction: two scripts, the second one points at the search of the app.
    expect(head.match(/application\/ld\+json/g)).toHaveLength(2);
    expect(head).toContain('"urlTemplate":"https://site.example.test/search?where={search_term_string}"');
    expect(buildWebSiteJsonLd('https://site.example.test')).toMatchObject({
      '@type': 'WebSite',
      url: 'https://site.example.test/',
      potentialAction: { '@type': 'SearchAction', 'query-input': 'required name=search_term_string' },
    });
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

  it('buildOrganizationJsonLd_holderWithoutPartitaIva_isNotDeclaredAsALegalEntity', () => {
    // A person is shown in the page, never as the legal name of an organization.
    expect(buildOrganizationJsonLd('https://site.example.test', { ...NO_LEGAL, name: 'Mario Rossi', email: 'info@example.com' })).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'CasaZen',
      url: 'https://site.example.test/',
      logo: 'https://site.example.test/icon-512.png',
      email: 'info@example.com',
    });
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
      logo: 'https://site.example.test/icon-512.png',
      legalName: 'Esempio S.r.l.',
      vatID: 'IT01234567890',
      address: 'Via Esempio 1, 22100 Como',
      email: 'info@example.com',
    });
  });
});
