import { sitePageUrl, type SitePage } from './site-pages';
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
  /** `https://host` of `VITE_PUBLIC_SITE_URL`, or null when it is not configured. */
  origin: string | null;
  legal: SiteLegal;
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

/** JSON for a `<script>` element: `<` is escaped, so no value can close the element. */
function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function buildOrganizationJsonLd(origin: string | null, legal: SiteLegal): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'CasaZen',
    ...(origin ? { url: `${origin}/` } : {}),
    ...(legal.name ? { legalName: legal.name } : {}),
    ...(legal.vatId ? { vatID: legal.vatId } : {}),
    ...(legal.address ? { address: legal.address } : {}),
    ...(legal.email ? { email: legal.email } : {}),
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
    );
  }

  if (page.id === 'home') {
    tags.push(`<script type="application/ld+json">${jsonForScript(buildOrganizationJsonLd(origin, legal))}</script>`);
  }

  return tags.join('\n    ');
}
