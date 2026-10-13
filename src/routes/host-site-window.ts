import { createPath, parsePath } from 'react-router-dom';

/**
 * First path segments of an org site's pages. On the org's own host they are written without the `/book/:orgSlug`
 * prefix (`https://www.villa.example/property/casa-mare`), inside the app they are the routes `/book/:orgSlug/property/…`.
 */
export const HOST_SITE_SEGMENTS: readonly string[] = ['property', 'my-bookings', 'booking', 'requests'];

function firstSegment(pathname: string): string {
  return pathname.split('/')[1] ?? '';
}

function prefixOf(slug: string): string {
  return `/book/${encodeURIComponent(slug)}`;
}

/** Path of the browser (clean addresses of the org's own host) → path of the router (`/book/:orgSlug/…`). */
export function toAppPath(hostPath: string, slug: string): string {
  if (hostPath === '/' || hostPath === '') return prefixOf(slug);
  // Any other path (`/book/…` links and Stripe return URLs, `/legale/…`) is the route itself.
  return HOST_SITE_SEGMENTS.includes(firstSegment(hostPath)) ? `${prefixOf(slug)}${hostPath}` : hostPath;
}

/** Path of the router → path of the browser: the inverse of `toAppPath` for the pages of this org only. */
export function toHostPath(appPath: string, slug: string): string {
  const prefix = prefixOf(slug);
  if (appPath === prefix || appPath === `${prefix}/`) return '/';
  if (appPath.startsWith(`${prefix}/`)) {
    const rest = appPath.slice(prefix.length);
    return HOST_SITE_SEGMENTS.includes(firstSegment(rest)) ? rest : appPath;
  }
  return appPath;
}

/** `url` (path, query and hash of the router) with the path written the way the browser shows it. */
function toHostUrl(url: string | URL | null | undefined, slug: string): string | URL | null | undefined {
  // Only an address of this site is rewritten; an absolute URL (other host) is not ours to change.
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) return url;
  const path = parsePath(url);
  return createPath({ ...path, pathname: toHostPath(path.pathname ?? '/', slug) });
}

/** A native method of the real object, kept bound to it (`Location`, `History` and `Window` methods need their receiver). */
function bound(target: object, property: string | symbol): unknown {
  const value = Reflect.get(target, property, target);
  return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
}

/**
 * The `window` the router of an org's own host sees (BK-16, A3-08), for `createBrowserRouter(routes, { window })`: the
 * browser shows clean addresses (`/`, `/property/casa-mare`, `/my-bookings`) and the router keeps its `/book/:orgSlug/…`
 * routes, so no page and no link had to change. Reading `location.pathname` gives the router path, writing an address
 * (`history.pushState`, `replaceState`, `location.assign`/`replace`) stores the clean one. Everything else is the real window.
 */
export function createHostSiteWindow(real: Window, slug: string): Window {
  const location = new Proxy(real.location, {
    get(target, property) {
      if (property === 'pathname') return toAppPath(target.pathname, slug);
      if (property === 'assign') return (url: string | URL) => target.assign(toHostUrl(String(url), slug) as string);
      if (property === 'replace') return (url: string | URL) => target.replace(toHostUrl(String(url), slug) as string);
      return bound(target, property);
    },
  });

  const history = new Proxy(real.history, {
    get(target, property) {
      if (property === 'pushState') {
        return (state: unknown, unused: string, url?: string | URL | null) =>
          target.pushState(state, unused, toHostUrl(url, slug));
      }
      if (property === 'replaceState') {
        return (state: unknown, unused: string, url?: string | URL | null) =>
          target.replaceState(state, unused, toHostUrl(url, slug));
      }
      return bound(target, property);
    },
  });

  return new Proxy(real, {
    get(target, property) {
      if (property === 'location') return location;
      if (property === 'history') return history;
      return bound(target, property);
    },
    set(target, property, value) {
      return Reflect.set(target, property, value, target);
    },
  });
}
