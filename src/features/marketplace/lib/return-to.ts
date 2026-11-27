import { safeReturnTo } from '@/lib/auth-return-to';

/**
 * Where a marketplace wizard goes back to (E09): the page that sent the person there (the suggestion sub-step of a process sends them to a
 * wizard and the wizard brings them back) puts its own address in the `returnTo` parameter of the wizard. This is the one place that
 * decides whether such an address can be trusted, so that a wizard can never send the person out of the app (no open redirect). It has no
 * React in it. The validator is `safeReturnTo` of the login (a path of this origin, no backslash, no control character), plus the rule
 * the login page adds: only a page of the app, `/app/…`, once the path is normalised (`/app/../login` is `/login`, outside the app).
 */

/** The parameter of the address of a wizard that holds the address to go back to. */
export const MARKETPLACE_RETURN_TO_PARAM = 'returnTo';

const APP_PATH_PREFIX = '/app/';

/** `value` when it is a page of the app of this origin, else `null`. */
function appPathOrNull(value: unknown): string | null {
  const path = safeReturnTo(value);
  if (path === null || !path.startsWith(APP_PATH_PREFIX)) return null;
  return new URL(path, window.location.origin).pathname.startsWith(APP_PATH_PREFIX) ? path : null;
}

/**
 * The address a wizard goes back to: the `returnTo` of a query string (`location.search`, with or without the leading `?`), or `null`
 * when there is none or it is not a page of this app.
 */
export function readMarketplaceReturnTo(search: string): string | null {
  return appPathOrNull(new URLSearchParams(search).get(MARKETPLACE_RETURN_TO_PARAM));
}

/**
 * `path` (which may already have a query string, and a fragment) with `returnTo` added, encoded. A `returnTo` that is not a page of
 * this app leaves the path as it was; `readMarketplaceReturnTo` of the result gives `returnTo` back unchanged.
 */
export function withReturnTo(path: string, returnTo: string | null | undefined): string {
  const accepted = appPathOrNull(returnTo);
  if (accepted === null) return path;

  const hashAt = path.indexOf('#');
  const fragment = hashAt === -1 ? '' : path.slice(hashAt);
  const withoutFragment = hashAt === -1 ? path : path.slice(0, hashAt);
  const queryAt = withoutFragment.indexOf('?');
  const pathname = queryAt === -1 ? withoutFragment : withoutFragment.slice(0, queryAt);
  const params = new URLSearchParams(queryAt === -1 ? '' : withoutFragment.slice(queryAt + 1));
  params.set(MARKETPLACE_RETURN_TO_PARAM, accepted);

  return `${pathname}?${params.toString()}${fragment}`;
}
