/**
 * Vercel Function behind `/sitemap.xml` of the web app (rewrite in `vercel.json`), SE-02 / A8-02.
 *
 * The sitemap must live on the public domain declared in `robots.txt`, but only the backend knows which SEO pages are
 * published and builds their URLs on `App__PublicSiteBaseUrl`. A static rewrite in `vercel.json` cannot do it: it
 * cannot read environment variables, and the same file serves the preview deployments (test API) and production
 * (production API). This function reads `VITE_API_BASE_URL` of its own Vercel environment at runtime and returns the
 * backend sitemap (`GET {VITE_API_BASE_URL}/public/sitemap.xml`) unchanged. No domain is written here (decision D3).
 *
 * The Vercel CDN keeps a good answer for an hour (and serves it while refreshing it for a day), so crawlers rarely
 * reach the API. A failure is a 503 that is never cached: crawlers retry later, and an error page is never served as
 * a sitemap. Self-contained on purpose (no imports): Vercel bundles each file of `api/` on its own.
 *
 * BK-15 adds the sitemaps of the booking sites through the same function: `/sitemap-book.xml` (`?name=book`, the index of
 * the orgs that have a published property) and `/book/:orgSlug/sitemap.xml` (`?org=:orgSlug`, the landing page and the
 * published properties of one org, under the org's own path as the sitemap protocol requires). Unknown orgs are a 404.
 *
 * Runbook: backend `docs/runbooks/seo-domain.md`.
 */

/** Backend endpoint, relative to `VITE_API_BASE_URL` (which ends with `/api`). */
export const SITEMAP_UPSTREAM_PATH = 'public/sitemap.xml';

/** Backend endpoint of the index of the booking sites' sitemaps (`/sitemap-book.xml`). */
export const BOOKING_SITEMAP_INDEX_UPSTREAM_PATH = 'public/sitemap-book.xml';

/** Same alphabet as the org slugs the backend accepts: anything else is a 404 before the backend is called. */
const ORG_SLUG = /^[A-Za-z0-9-]{1,100}$/;

/**
 * Backend path of the sitemap a rewrite asks for, or null when the request names an org that cannot exist:
 * no parameter is the compliance sitemap, `name=book` the index of the booking sites, `org` one org's sitemap.
 */
export function sitemapUpstreamPath(searchParams: URLSearchParams): string | null {
  const org = searchParams.get('org');
  if (org !== null) return ORG_SLUG.test(org) ? `public/orgs/${org}/sitemap.xml` : null;
  if (searchParams.get('name') === 'book') return BOOKING_SITEMAP_INDEX_UPSTREAM_PATH;
  return SITEMAP_UPSTREAM_PATH;
}

const UPSTREAM_TIMEOUT_MS = 8000;
const CACHE_OK = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

/** Absolute URL of a backend sitemap, or null when `VITE_API_BASE_URL` is not an absolute http(s) URL. */
export function sitemapUpstreamUrl(apiBaseUrl: string | undefined, path: string = SITEMAP_UPSTREAM_PATH): URL | null {
  const trimmed = apiBaseUrl?.trim();
  if (!trimmed) return null;

  let base: URL;
  try {
    base = new URL(trimmed.endsWith('/') ? trimmed : `${trimmed}/`);
  } catch {
    return null;
  }
  if (base.protocol !== 'https:' && base.protocol !== 'http:') return null;

  return new URL(path, base);
}

function unavailable(reason: string): Response {
  console.error(`sitemap.xml unavailable: ${reason}`);
  return new Response('Sitemap temporarily unavailable.\n', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '3600' },
  });
}

function notFound(): Response {
  return new Response('Sitemap not found.\n', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function GET(request?: Request): Promise<Response> {
  const path = sitemapUpstreamPath(request ? new URL(request.url).searchParams : new URLSearchParams());
  if (!path) return notFound();

  const upstream = sitemapUpstreamUrl(process.env.VITE_API_BASE_URL, path);
  if (!upstream) return unavailable('VITE_API_BASE_URL is missing or not an absolute URL');

  let response: Response;
  let body: string;
  try {
    response = await fetch(upstream, {
      headers: { Accept: 'application/xml' },
      redirect: 'error',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    body = await response.text();
  } catch (error) {
    return unavailable(error instanceof Error ? error.name : 'request failed');
  }

  // An org that is unknown, renamed or has nothing published has no sitemap (not an outage).
  if (response.status === 404 && upstream.pathname.includes('/orgs/')) return notFound();
  if (!response.ok) return unavailable(`backend answered ${response.status}`);
  if (!body.includes('<urlset') && !body.includes('<sitemapindex')) return unavailable('backend answer is not a sitemap');

  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': CACHE_OK },
  });
}

/** Same status and headers as GET, without a body (e.g. `curl -I`). */
export async function HEAD(request?: Request): Promise<Response> {
  const response = await GET(request);
  return new Response(null, { status: response.status, headers: response.headers });
}
