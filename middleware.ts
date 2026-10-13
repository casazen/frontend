import { next, rewrite } from '@vercel/functions';

/**
 * Routing Middleware of the web app (SEO-VETRINA): serves the static pages of the public site of CasaZen
 * (`dist/_site/*.html`, prerendered at build time by `scripts/prerender-site.mjs`) at their public paths, only on the web
 * app's own host. Vercel runs it before the static files and the rewrites of `vercel.json`, and only on the paths of
 * `config.matcher`, never on the rest of the app.
 *
 * - On an org's own host (a subdomain or a verified custom domain, BK-16) the same paths are the org's booking site: the
 *   request goes on unchanged (`next()`), as before.
 * - `/` with the answer of the Auth0 login (`code` or `error` with `state`, the OAuth 2.0 authorization response) is the
 *   single-page app, which completes the login there (`redirect_uri` is the origin, `src/config/auth.config.ts`).
 * - The web app's own hosts are the host of `VITE_PUBLIC_SITE_URL` (read at runtime, no domain written here, decision D3),
 *   `localhost` and the Vercel deployments: the same rule as `isAppHost` of `api/seo.ts`.
 *
 * Self-contained on purpose (no imports from `src/`): Vercel bundles it on its own. `src/test/site-middleware.test.ts`
 * checks that the paths below are the pages of `src/site/site-pages.ts`.
 */

/** Public path → file under `dist/_site/` (`SITE_PAGES` of `src/site/site-pages.ts`). */
export const SITE_PAGE_FILES: Readonly<Record<string, string>> = {
  '/': 'index.html',
  '/funzionalita': 'funzionalita.html',
  '/prezzi': 'prezzi.html',
  '/per-i-fornitori': 'per-i-fornitori.html',
  '/chi-siamo': 'chi-siamo.html',
};

export const config = {
  matcher: ['/', '/funzionalita', '/prezzi', '/per-i-fornitori', '/chi-siamo'],
};

const SITE_ASSET_DIR = '_site';

/** Hosts of the app itself, never an org's own site: local development and the Vercel deployments. */
const APP_HOST_SUFFIXES = ['localhost', 'vercel.app'];

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

/** True for the redirect back from the Auth0 login (OAuth 2.0 authorization response: `code` or `error`, with `state`). */
export function isAuthRedirect(url: URL): boolean {
  return url.searchParams.has('state') && (url.searchParams.has('code') || url.searchParams.has('error'));
}

/** Path of the static page to serve for the request, or null when the request must go on unchanged. */
export function sitePagePath(request: Request, publicSiteUrl: string | undefined): string | null {
  const url = new URL(request.url);
  const file = SITE_PAGE_FILES[url.pathname];
  if (!file) return null;
  if (url.pathname === '/' && isAuthRedirect(url)) return null;
  if (!isAppHost(url.host, publicSiteUrl)) return null;
  return `/${SITE_ASSET_DIR}/${file}`;
}

export default function middleware(request: Request): Response {
  const path = sitePagePath(request, process.env.VITE_PUBLIC_SITE_URL);
  return path ? rewrite(new URL(path, request.url)) : next();
}
