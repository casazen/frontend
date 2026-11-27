import { createPath, parsePath } from 'react-router-dom';

export const HOST_SITE_SEGMENTS: readonly string[] = ['property', 'my-bookings', 'booking', 'requests', 'search'];

function firstSegment(pathname: string): string {
  return pathname.split('/')[1] ?? '';
}

function prefixOf(slug: string): string {
  return `/book/${encodeURIComponent(slug)}`;
}

export function toAppPath(hostPath: string, slug: string): string {
  if (hostPath === '/' || hostPath === '') return prefixOf(slug);
  return HOST_SITE_SEGMENTS.includes(firstSegment(hostPath)) ? `${prefixOf(slug)}${hostPath}` : hostPath;
}

export function toHostPath(appPath: string, slug: string): string {
  const prefix = prefixOf(slug);
  if (appPath === prefix || appPath === `${prefix}/`) return '/';
  if (appPath.startsWith(`${prefix}/`)) {
    const rest = appPath.slice(prefix.length);
    return HOST_SITE_SEGMENTS.includes(firstSegment(rest)) ? rest : appPath;
  }
  return appPath;
}

function toHostUrl(url: string | URL | null | undefined, slug: string): string | URL | null | undefined {
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) return url;
  const path = parsePath(url);
  return createPath({ ...path, pathname: toHostPath(path.pathname ?? '/', slug) });
}

function bound(target: object, property: string | symbol): unknown {
  const value = Reflect.get(target, property, target);
  return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
}

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
