/**
 * Vercel Function that serves crawlers the HTML of the public pages (BK-15, A3-20 / A8-09 / A8-29).
 *
 * The web app is a single-page app: `index.html` is empty (title, description, canonical, Open Graph and JSON-LD would
 * only exist after JavaScript and API calls), so search engines and link previews (WhatsApp, Facebook, LinkedIn, ...)
 * saw nothing of a booking site or a guide. `vercel.json` sends the requests of known crawlers (`user-agent` rewrites)
 * for `/book/:orgSlug`, `/book/:orgSlug/property/:property`, `/p/affitti-brevi`, `/p/affitti-brevi/:region/:comune` and
 * `/p/tassa-soggiorno/:comune` here. People never reach this function: they keep getting the single-page app, so a
 * failure here can only affect crawlers, which retry later.
 *
 * BK-16 adds the org's own hosts (a subdomain or a verified custom domain): `/` and `/property/:property` there are the org's
 * landing page and a property (`kind=host`), asked to the backend by the Host of the request, which alone knows which host
 * serves which org. The same two paths on the web app's own host (the app root, a path nobody serves) are not crawler
 * pages: the function serves the single-page app there, as without it. A host nobody serves (a custom domain still waiting
 * for its verification) answers 404 with a noindex page.
 *
 * The function does not build anything: the backend (`GET {VITE_API_BASE_URL}/public/seo/...`) owns the content and the
 * rules (published data only, `noindex` for what must not be indexed, canonical on `App__PublicSiteBaseUrl`, JSON-LD with
 * real data), so they are tested once, there. Here: the route table, input validation, the Host of the request (the
 * backend decides from it whether the page may be indexed on that host: an unverified custom domain is `noindex`),
 * statuses (a real 404, a 301 to the canonical path on the same host) and headers. No domain is written here (decision D3).
 *
 * Preview and test deployments (`VERCEL_ENV` is not `production`) answer with `X-Robots-Tag: noindex` besides the
 * `Disallow: /` of their `robots.txt`. Self-contained on purpose (no imports): Vercel bundles each file of `api/` on its
 * own. Runbook: backend `docs/runbooks/seo-domain.md`.
 */

/** What a crawler page is (the `kind` of the rewrite in `vercel.json`) and the parameters it needs. */
export type SeoKind = 'org' | 'property' | 'guide' | 'tourist-tax' | 'hub' | 'host';

export interface SeoRoute {
  kind: SeoKind;
  /** Segments of the backend path (after `public/seo/`), already URL-encoded. */
  path: string;
  /** Whether the backend needs the Host of the request to decide the indexing. */
  needsHost: boolean;
  /** `kind=host` only: the path on the org's own host (`/` or `/property/{slug or id}`). */
  hostPath?: string;
}

const UPSTREAM_TIMEOUT_MS = 8000;

/** Slugs of orgs, properties, regions and comuni: the same alphabet the backend accepts. */
const SLUG = /^[A-Za-z0-9-]{1,100}$/;

/** The paths of an org's own host that have a crawler page. */
const HOST_PAGE_PATH = /^\/(?:property\/[A-Za-z0-9._~%-]{1,150})?$/;

/** A same-host canonical path the backend may redirect to (never a URL on another host). */
const SAFE_REDIRECT_PATH = /^\/(?:(?:book|p)(?:\/[A-Za-z0-9._~%-]+)*|property\/[A-Za-z0-9._~%-]+)?$/;

/** Only a path of the public pages, without dot segments (also percent-encoded: browsers resolve `%2e%2e` too). */
function isSafeRedirectPath(location: string): boolean {
  return (
    SAFE_REDIRECT_PATH.test(location) &&
    !/%2e/i.test(location) &&
    !location.split('/').some((segment) => segment === '.' || segment === '..')
  );
}

function slug(value: string | null): string | null {
  return value !== null && SLUG.test(value) ? value : null;
}

/** The backend route for the query of a rewrite, or null when the kind is unknown or a parameter is not a slug. */
export function seoRoute(searchParams: URLSearchParams): SeoRoute | null {
  const kind = searchParams.get('kind');
  switch (kind) {
    case 'org': {
      const org = slug(searchParams.get('orgSlug'));
      return org ? { kind, path: `orgs/${org}`, needsHost: true } : null;
    }
    case 'property': {
      const org = slug(searchParams.get('orgSlug'));
      const property = slug(searchParams.get('propertySlugOrId'));
      return org && property ? { kind, path: `orgs/${org}/properties/${property}`, needsHost: true } : null;
    }
    case 'guide': {
      const region = slug(searchParams.get('region'));
      const comune = slug(searchParams.get('comune'));
      return region && comune ? { kind, path: `guides/${region}/${comune}`, needsHost: false } : null;
    }
    case 'tourist-tax': {
      const comune = slug(searchParams.get('comune'));
      return comune ? { kind, path: `tourist-tax/${comune}`, needsHost: false } : null;
    }
    case 'hub':
      return { kind, path: 'hub', needsHost: false };
    case 'host': {
      const hostPath = searchParams.get('path');
      return hostPath !== null && HOST_PAGE_PATH.test(hostPath)
        ? { kind, path: 'hosts/page', needsHost: true, hostPath }
        : null;
    }
    default:
      return null;
  }
}

/** Absolute URL of the backend page, or null when `VITE_API_BASE_URL` is not an absolute http(s) URL. */
export function seoUpstreamUrl(apiBaseUrl: string | undefined, route: SeoRoute, host: string | null): URL | null {
  const trimmed = apiBaseUrl?.trim();
  if (!trimmed) return null;

  let base: URL;
  try {
    base = new URL(trimmed.endsWith('/') ? trimmed : `${trimmed}/`);
  } catch {
    return null;
  }
  if (base.protocol !== 'https:' && base.protocol !== 'http:') return null;

  const url = new URL(`public/seo/${route.path}`, base);
  if (route.needsHost && host) url.searchParams.set('host', host);
  if (route.hostPath !== undefined) url.searchParams.set('path', route.hostPath);
  return url;
}

/**
 * The host the crawler used. Vercel sets `x-forwarded-host` to the original host of a rewritten request; the backend
 * only compares it with the domains it knows (never writes it into a page) and rejects what is not a host name.
 */
export function requestHost(headers: Headers): string | null {
  const value = (headers.get('x-forwarded-host') ?? headers.get('host') ?? '').split(',')[0].trim();
  return value ? value : null;
}

/** Hosts of the app itself, never an org's own site: local development and the Vercel deployments. */
const APP_HOST_SUFFIXES = ['localhost', 'vercel.app'];

/**
 * True for the web app's own hosts: the public domain (`VITE_PUBLIC_SITE_URL`, no domain written here, D3), local development
 * and the Vercel deployments. Same rule as `isDefaultAppHost` of the app: any other host may be an org's own site.
 */
export function isAppHost(host: string, publicSiteUrl: string | undefined): boolean {
  const name = host.split(':')[0].toLowerCase();
  let publicSiteHost: string | null = null;
  try {
    publicSiteHost = publicSiteUrl?.trim() ? new URL(publicSiteUrl.trim()).hostname.toLowerCase() : null;
  } catch {
    publicSiteHost = null;
  }
  if (publicSiteHost && name === publicSiteHost) return true;
  if (name === '127.0.0.1' || name === '[::1]') return true;
  return APP_HOST_SUFFIXES.some((suffix) => name === suffix || name.endsWith(`.${suffix}`));
}

/** A plain host name (letters, digits, hyphens and dots, optional port): the only kind of value used to build a URL. */
const PLAIN_HOST = /^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*(:\d{1,5})?$/;

/**
 * The single-page app (`/index.html` of the same deployment, a static file the rewrites never touch) for a crawler that asked
 * for a path that is not a crawler page on the app's own host, exactly what it would have got without this function.
 */
async function singlePageApp(headers: Headers, host: string): Promise<Response> {
  const protocol = headers.get('x-forwarded-proto')?.split(',')[0].trim() === 'http' ? 'http' : 'https';
  if (!PLAIN_HOST.test(host)) return notFound();

  let shell: Response;
  let body: string;
  try {
    shell = await fetch(`${protocol}://${host}/index.html`, { redirect: 'manual', signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    body = await shell.text();
  } catch (error) {
    return unavailable(error instanceof Error ? error.name : 'request failed');
  }
  if (!shell.ok || !body.includes('id="root"')) return unavailable(`index.html answered ${shell.status}`);

  return new Response(body, {
    status: 200,
    headers: { ...baseHeaders(), 'Cache-Control': 'public, max-age=0, must-revalidate' },
  });
}

function baseHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'text/html; charset=utf-8',
    // Never kept by the CDN: the same URL is served to people by the single-page app, and crawlers must see the current
    // data (an unpublished property, a changed domain) at once.
    'Cache-Control': 'no-store',
    Vary: 'User-Agent',
  };
  if (process.env.VERCEL_ENV !== 'production') headers['X-Robots-Tag'] = 'noindex, nofollow';
  return headers;
}

function unavailable(reason: string): Response {
  console.error(`seo page unavailable: ${reason}`);
  return new Response('Page temporarily unavailable.\n', {
    status: 503,
    headers: { ...baseHeaders(), 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '3600' },
  });
}

function notFound(): Response {
  return new Response('Not found.\n', {
    status: 404,
    headers: { ...baseHeaders(), 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' },
  });
}

export async function GET(request: Request): Promise<Response> {
  const route = seoRoute(new URL(request.url).searchParams);
  if (!route) return notFound();

  const host = requestHost(request.headers);
  if (route.kind === 'host') {
    if (!host) return notFound();
    // `/` and `/property/…` of the app's own host are not an org's pages: the single-page app, as before.
    if (isAppHost(host, process.env.VITE_PUBLIC_SITE_URL)) return singlePageApp(request.headers, host);
  }

  const upstream = seoUpstreamUrl(process.env.VITE_API_BASE_URL, route, host);
  if (!upstream) return unavailable('VITE_API_BASE_URL is missing or not an absolute URL');

  let response: Response;
  let body: string;
  try {
    response = await fetch(upstream, {
      // No Accept-Language: the backend answers in its default language (Italian), the language of the pages.
      headers: { Accept: 'text/html' },
      redirect: 'manual',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    body = await response.text();
  } catch (error) {
    return unavailable(error instanceof Error ? error.name : 'request failed');
  }

  if (response.status === 301) {
    // Old slug of an org, property reached by id: the canonical path, on the host the crawler asked.
    const location = response.headers.get('location') ?? '';
    if (!isSafeRedirectPath(location)) return unavailable('backend redirect is not a path of the site');
    return new Response(null, { status: 301, headers: { ...baseHeaders(), Location: location } });
  }

  if (response.status !== 200 && response.status !== 404) return unavailable(`backend answered ${response.status}`);
  if (!body.includes('<html')) return unavailable('backend answer is not an HTML page');

  return new Response(body, { status: response.status, headers: baseHeaders() });
}

/** Same status and headers as GET, without a body (e.g. `curl -I`). */
export async function HEAD(request: Request): Promise<Response> {
  const response = await GET(request);
  return new Response(null, { status: response.status, headers: response.headers });
}
