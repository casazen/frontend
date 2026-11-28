import { hasDetailParam, searchWithDetail } from '@/lib/detail-address';

/**
 * Where the lists were left (UI-05): the query string (filters, search, tab) of each list page, kept for the session of the
 * tab, so that the way back from a detail page leads to the list as the user left it. The key of a list is its address
 * (`/app/short-rent/bookings`), which is what a back link and a breadcrumb point at.
 */
export const LIST_RETURN_STORAGE_KEY = 'casazen:list-return';

type RememberedLists = Record<string, string>;

function readRemembered(): RememberedLists {
  try {
    const raw = window.sessionStorage.getItem(LIST_RETURN_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as RememberedLists) : {};
  } catch {
    return {};
  }
}

function isQueryString(value: unknown): value is string {
  return typeof value === 'string' && /^\?[^#]+$/.test(value);
}

export function rememberList(listKey: string, search: string): void {
  const remembered = readRemembered();
  const kept = hasDetailParam(search) ? searchWithDetail(search, null) : search;
  if (isQueryString(kept)) remembered[listKey] = kept;
  else delete remembered[listKey];
  try {
    window.sessionStorage.setItem(LIST_RETURN_STORAGE_KEY, JSON.stringify(remembered));
  } catch {
    // A full or blocked storage only means that the way back is the plain list, as it always was.
  }
}

export function recallList(listKey: string): string {
  const search = readRemembered()[listKey];
  return isQueryString(search) ? search : '';
}

export function withListReturn(to: string): string {
  if (to.includes('?') || to.includes('#')) return to;
  return `${to}${recallList(to)}`;
}
