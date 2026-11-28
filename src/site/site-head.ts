import { SEARCH_PATH, sitePageUrl, type SitePage } from './site-pages';
import type { SiteLegal } from './site-config';

/**
 * The `<head>` tags of a page of the public site, written into the static HTML at build time (SEO-VETRINA): title,
 * description, canonical, `hreflang`, Open Graph, Twitter card and, on the home page, the JSON-LD `Organization` with the
 * company data that is configured (nothing is invented). Pure: no DOM, no React.
 *
 * Without a public origin (a preview or local build) there is no canonical, no `og:url` and no `hreflang`: those builds are
 * never indexed (`Disallow: /`), and a relative canonical would point at the preview host.
 */
export interface SiteHeadInput {
  page: SitePage;
  title: string;
  description: string;
  origin: string | null;
  legal: SiteLegal;
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

const LOGO_PATH = '/icon-512.png';

export function buildOrganizationJsonLd(origin: string | null, legal: SiteLegal): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'CasaZen',
    ...(origin ? { url: `${origin}/`, logo: `${origin}${LOGO_PATH}` } : {}),
    // A legal entity only: a holder without a partita IVA (a person) is shown in the page, not declared as an organization.
    ...(legal.name && legal.vatId ? { legalName: legal.name, vatID: legal.vatId } : {}),
    ...(legal.address ? { address: legal.address } : {}),
    ...(legal.email ? { email: legal.email } : {}),
  };
}

/**
 * The `WebSite` of the home page with its search (SEARCH-GLOBAL): the place typed is the `where` of the public search of homes. Only with
 * a public origin, since the address of the search has to be absolute.
 */
export function buildWebSiteJsonLd(origin: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'CasaZen',
    url: `${origin}/`,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${origin}${SEARCH_PATH}?where={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildSiteHead({ page, title, description, origin, legal }: SiteHeadInput): string {
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="CasaZen" />`,
    `<meta property="og:locale" content="it_IT" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
  ];

  if (origin) {
    const url = escapeHtml(sitePageUrl(origin, page));
    tags.push(
      `<link rel="canonical" href="${url}" />`,
      `<link rel="alternate" hreflang="it" href="${url}" />`,
      `<link rel="alternate" hreflang="x-default" href="${url}" />`,
      `<meta property="og:url" content="${url}" />`,
      `<meta property="og:image" content="${escapeHtml(`${origin}${LOGO_PATH}`)}" />`,
      `<meta name="twitter:image" content="${escapeHtml(`${origin}${LOGO_PATH}`)}" />`,
    );
  }

  if (page.id === 'home') {
    tags.push(`<script type="application/ld+json">${jsonForScript(buildOrganizationJsonLd(origin, legal))}</script>`);
    if (origin) tags.push(`<script type="application/ld+json">${jsonForScript(buildWebSiteJsonLd(origin))}</script>`);
  }

  return tags.join('\n    ');
}
