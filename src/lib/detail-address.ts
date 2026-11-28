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

export const DETAIL_PARAM = 'detail';

const KIND = /^[a-z][a-z0-9-]{0,31}$/;

/**
 * An id is what the thing is called in the address: letters, digits, `_`, `-`, `.` and `:`, up to 128, starting with a letter,
 * a digit or `_`. The drawer hands it to a component that builds a request with it, so what is typed or shared in an address
 * (`?detail=booking:../../admin`) must not be able to carry a path, a query or a space into it.
 */
const ID = /^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,127}$/;

const DETAIL_PAIR = new RegExp(`(^|&)${DETAIL_PARAM}=([^&]*)`);

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

export function parseDetailValue(value: string | null | undefined): DetailRef | null {
  if (!value) return null;
  const separator = value.indexOf(':');
  if (separator < 1) return null;
  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1);
  return isValidDetailKind(kind) && isValidDetailId(id) ? { kind, id } : null;
}

export function readDetail(search: string | URLSearchParams): DetailRef | null {
  return parseDetailValue(new URLSearchParams(search).get(DETAIL_PARAM));
}

export function hasDetailParam(search: string | URLSearchParams): boolean {
  return new URLSearchParams(search).has(DETAIL_PARAM);
}

export function searchWithDetail(search: string | URLSearchParams, ref: DetailRef | null): string {
  const params = new URLSearchParams(search);
  if (ref) params.set(DETAIL_PARAM, `${ref.kind}:${ref.id}`);
  else params.delete(DETAIL_PARAM);
  const query = params.toString().replace(DETAIL_PAIR, (_match, lead: string, value: string) => `${lead}${DETAIL_PARAM}=${value.replace(/%3A/gi, ':')}`);
  return query ? `?${query}` : '';
}
