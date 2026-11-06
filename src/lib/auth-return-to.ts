import { searchWithoutOctorateCallback } from '@/features/integrations/octorate/octorate-callback';

/**
 * Path the app goes back to after an Auth0 login started with `login({ returnTo })` (carried in the
 * SDK `appState`, protected by its `state` check). Only a path of this origin is accepted: anything
 * else (absolute or protocol-relative URL, backslashes, control characters) gives `null`.
 */
export function safeReturnTo(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  // Browsers treat "\" like "/" in URLs; control characters could hide a scheme.
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
