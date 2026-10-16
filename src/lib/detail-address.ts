/**
 * The address of the global detail drawer (UI-15): one parameter, `?detail=<kind>:<id>`, in the query of whatever page is
 * open, so that a link opens the drawer, Back closes it and the other parameters (the filters of a list, the tab) stay as they
 * are. This file is the pure part, with no React in it: from the address to the thing that is open and back.
 *
 *     /app/short-rent/bookings?chip=pending&detail=booking:3f2a9c1e
 *
 * What is not valid is not "open": an address that is stale, typed or shared with a mistake never breaks a page, it just
 * opens nothing.
 */

/** The name of the parameter. A list does not use it (`list-state`), nor the tabs (`?tab=`). */
export const DETAIL_PARAM = 'detail';

/** A kind is a short lowercase word (`booking`, `service-request`): it names what the drawer shows and travels in the address. */
const KIND = /^[a-z][a-z0-9-]{0,31}$/;

/**
 * An id is what the thing is called in the address: letters, digits, `_`, `-`, `.` and `:`, up to 128, starting with a letter,
 * a digit or `_`. The drawer hands it to a component that builds a request with it, so what is typed or shared in an address
 * (`?detail=booking:../../admin`) must not be able to carry a path, a query or a space into it.
 */
const ID = /^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,127}$/;

/** What a drawer shows: the kind that was registered, and the id of the thing. */
export interface DetailRef {
  kind: string;
  id: string;
}

export function isValidDetailKind(kind: string): boolean {
  return KIND.test(kind);
}

export function isValidDetailId(id: string): boolean {
  return ID.test(id);
}

/** `booking:3f2a9c1e` as a ref. The id is what follows the first colon, so it can hold colons; null if either part is not valid. */
export function parseDetailValue(value: string | null | undefined): DetailRef | null {
  if (!value) return null;
  const separator = value.indexOf(':');
  if (separator < 1) return null;
  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1);
  return isValidDetailKind(kind) && isValidDetailId(id) ? { kind, id } : null;
}

/** The drawer an address asks for, or null when it asks for none (or for one that is not valid). */
export function readDetail(search: string | URLSearchParams): DetailRef | null {
  return parseDetailValue(new URLSearchParams(search).get(DETAIL_PARAM));
}

/** The address carries the parameter, valid or not: closing the drawer takes a stale one away too. */
export function hasDetailParam(search: string | URLSearchParams): boolean {
  return new URLSearchParams(search).has(DETAIL_PARAM);
}

/**
 * `search` with the drawer of `ref` open, or with no drawer when `ref` is null; every other parameter is kept as it was. The
 * result is a query string as `location.search` has it: `?a=b` or an empty string. The colon of the value is written as it is
 * (a legal character of a query), not as `%3A`: this address is read by people and pasted in emails.
 */
export function searchWithDetail(search: string | URLSearchParams, ref: DetailRef | null): string {
  const params = new URLSearchParams(search);
  if (ref) params.set(DETAIL_PARAM, `${ref.kind}:${ref.id}`);
  else params.delete(DETAIL_PARAM);
  const query = params
    .toString()
    .replace(new RegExp(`(^|&)${DETAIL_PARAM}=([^&]*)`), (_match, lead: string, value: string) => `${lead}${DETAIL_PARAM}=${value.replace(/%3A/gi, ':')}`);
  return query ? `?${query}` : '';
}
