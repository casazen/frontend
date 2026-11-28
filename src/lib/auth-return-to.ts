import { searchWithoutOctorateCallback } from '@/features/integrations/octorate/octorate-callback';

export function safeReturnTo(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (value.includes('\\') || [...value].some((ch) => ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f)) {
    return null;
  }
  return value;
}

/**
 * Path, query and hash of a location: the `returnTo` that brings the user back to that page. A `returnTo` lasts (a history entry, the
 * state Auth0 keeps while the user signs in), so the single-use `code` and `state` of the callback of the channel manager are left out of
 * it (see `searchWithoutOctorateCallback`).
 */
export function currentReturnTo(location: { pathname: string; search: string; hash: string }): string {
  return `${location.pathname}${searchWithoutOctorateCallback(location.pathname, location.search)}${location.hash}`;
}
