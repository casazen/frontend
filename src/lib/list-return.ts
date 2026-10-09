/**
 * Where the lists were left (UI-05): the query string (filters, search, tab) of each list page, kept for the session of the
 * tab, so that the way back from a detail page leads to the list as the user left it. The key of a list is its address
 * (`/app/short-rent/bookings`), which is what a back link and a breadcrumb point at.
 */
export const LIST_RETURN_STORAGE_KEY = 'casazen:list-return';

type RememberedLists = Record<string, string>;

/** What the list asked to remember, nothing when the storage is missing (private mode, a server) or holds something else. */
function readRemembered(): RememberedLists {
  try {
    const raw = window.sessionStorage.getItem(LIST_RETURN_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as RememberedLists) : {};
  } catch {
    return {};
  }
}

/** A query string as `location.search` gives it: starts with "?" and has no fragment. Anything else is not trusted. */
function isQueryString(value: unknown): value is string {
  return typeof value === 'string' && /^\?[^#]+$/.test(value);
}

/** Keeps `search` (`?status=Confirmed`) as the state of the list `listKey`; an empty one forgets it. */
export function rememberList(listKey: string, search: string): void {
  const remembered = readRemembered();
  if (isQueryString(search)) remembered[listKey] = search;
  else delete remembered[listKey];
  try {
    window.sessionStorage.setItem(LIST_RETURN_STORAGE_KEY, JSON.stringify(remembered));
  } catch {
    // A full or blocked storage only means that the way back is the plain list, as it always was.
  }
}

/** The query string the list `listKey` was left with, or an empty string. */
export function recallList(listKey: string): string {
  const search = readRemembered()[listKey];
  return isQueryString(search) ? search : '';
}

/**
 * `to` with the state its list was left in. An address that already has a query or a fragment is the caller's choice and
 * is left as it is, so are the addresses of pages that are not lists (nothing was remembered for them).
 */
export function withListReturn(to: string): string {
  if (to.includes('?') || to.includes('#')) return to;
  return `${to}${recallList(to)}`;
}
