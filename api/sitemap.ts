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
 * Runbook: backend `docs/runbooks/seo-domain.md`.
 */

/** Backend endpoint, relative to `VITE_API_BASE_URL` (which ends with `/api`). */
export const SITEMAP_UPSTREAM_PATH = 'public/sitemap.xml';

const UPSTREAM_TIMEOUT_MS = 8000;
const CACHE_OK = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

/** Absolute URL of the backend sitemap, or null when `VITE_API_BASE_URL` is not an absolute http(s) URL. */
export function sitemapUpstreamUrl(apiBaseUrl: string | undefined): URL | null {
  const trimmed = apiBaseUrl?.trim();
  if (!trimmed) return null;

  let base: URL;
  try {
    base = new URL(trimmed.endsWith('/') ? trimmed : `${trimmed}/`);
  } catch {
    return null;
  }
  if (base.protocol !== 'https:' && base.protocol !== 'http:') return null;

  return new URL(SITEMAP_UPSTREAM_PATH, base);
}

function unavailable(reason: string): Response {
  console.error(`sitemap.xml unavailable: ${reason}`);
  return new Response('Sitemap temporarily unavailable.\n', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '3600' },
  });
}

export async function GET(): Promise<Response> {
  const upstream = sitemapUpstreamUrl(process.env.VITE_API_BASE_URL);
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

  if (!response.ok) return unavailable(`backend answered ${response.status}`);
  if (!body.includes('<urlset')) return unavailable('backend answer is not a sitemap');

  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': CACHE_OK },
  });
}

/** Same status and headers as GET, without a body (e.g. `curl -I`). */
export async function HEAD(): Promise<Response> {
  const response = await GET();
  return new Response(null, { status: response.status, headers: response.headers });
}
